/**
 * UserService - business logic for user accounts.
 *
 * Supports three modes:
 *   mock  → localStorage via repositories
 *   api   → Next.js API routes
 *   cloud → API Gateway + Cognito
 *
 * Workspace membership is managed via workspace/team services.
 */

import { isCloudMode, isApiMode } from '@/config/runtimeConfig';
import { userRepo } from '@/repositories';
import { generateId } from '@/services/workspaceService';
import { usersApi, authApi } from './cloudClient';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const loginAttempts = new Map();

export function validatePasswordStrength(password) {
  const value = String(password || '');
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(value)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include a special character';
  return '';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getAttemptState(email) {
  const key = normalizeEmail(email);
  const state = loginAttempts.get(key);
  if (!state || state.lockedUntil <= Date.now()) return { count: 0, lockedUntil: 0 };
  return state;
}

function assertNotLocked(email) {
  const state = getAttemptState(email);
  if (state.lockedUntil > Date.now()) {
    const seconds = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    throw new Error(`Account is temporarily locked. Try again in ${seconds} seconds.`);
  }
}

function recordFailedLogin(email) {
  const key = normalizeEmail(email);
  const state = getAttemptState(email);
  const count = state.count + 1;
  loginAttempts.set(key, {
    count,
    lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
  });
}

function clearFailedLogins(email) {
  loginAttempts.delete(normalizeEmail(email));
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    phone: user.phone || '',
    avatarHistory: user.avatarHistory || [],
    role: user.role || 'EMPLOYEE',
    departmentId: user.departmentId || null,
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

export async function loginUser(email, password) {
  // Cloud mode: authenticate via Cognito through API Gateway
  if (isCloudMode()) {
    const result = await authApi.login(email, password);
    const { token, user } = result;
    if (token && typeof window !== 'undefined') {
      const { setAuthToken } = await import('@/services/apiClient');
      setAuthToken(token);
    }
    return toPublicUser(user);
  }

  // API mode: authenticate via Next.js API routes
  if (isApiMode()) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Login failed');
    }
    const { token, user } = json.data;
    if (token && typeof window !== 'undefined') {
      const { setAuthToken } = await import('@/services/apiClient');
      setAuthToken(token);
    }
    return toPublicUser(user);
  }

  // Mock mode: local user repository
  const normalizedEmail = normalizeEmail(email);
  assertNotLocked(normalizedEmail);

  const user = await userRepo.findByEmail(normalizedEmail);
  if (!user) throw new Error('Email does not exist');
  if (password !== user.password) {
    recordFailedLogin(normalizedEmail);
    throw new Error('Incorrect password');
  }

  clearFailedLogins(normalizedEmail);
  return toPublicUser(user);
}

export async function registerUser(name, email, password) {
  if (!name || !email || !password) throw new Error('Please fill in all fields');
  const passwordError = validatePasswordStrength(password);
  if (passwordError) throw new Error(passwordError);

  // Cloud mode: register via API Gateway
  if (isCloudMode()) {
    const user = await usersApi.create({ name, email, password });
    return toPublicUser(user);
  }

  // API mode: register via Next.js API route
  if (isApiMode()) {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Registration failed');
    }
    return toPublicUser(json.data?.user || json.data);
  }

  // Mock mode: local user repository
  const normalizedEmail = normalizeEmail(email);
  const existing = await userRepo.findByEmail(normalizedEmail);
  if (existing) throw new Error('Email is already in use');

  const user = await userRepo.create({
    id: 'user-' + generateId(),
    name: String(name).trim(),
    email: normalizedEmail,
    password,
    avatar: null,
    role: 'EMPLOYEE',
    departmentId: null,
  });

  return toPublicUser(user);
}

export async function getUserById(id) {
  if (isCloudMode()) {
    return usersApi.get(id);
  }
  if (isApiMode()) {
    const response = await fetch(`/api/users/${id}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to fetch user');
    return json.data?.user || json.data;
  }
  return userRepo.findById(id);
}

export async function getAllUsers() {
  if (isCloudMode()) {
    return usersApi.list();
  }
  if (isApiMode()) {
    const response = await fetch('/api/users');
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to fetch users');
    return json.data?.users || json.data;
  }
  return userRepo.findAll();
}

/**
 * Update a user profile.
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateUserProfile(id, updates) {
  if (isCloudMode()) {
    return usersApi.update(id, updates);
  }
  if (isApiMode()) {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to update profile');
    return json.data?.user || json.data;
  }
  // Mock mode: use repository directly
  const user = await userRepo.findById(id);
  if (!user) throw new Error('User not found');
  const updated = await userRepo.update(id, updates, user.version);
  return toPublicUser(updated);
}
