/**
 * Lambda Controller — Users
 *
 * CRUD operations for user accounts.
 *
 * Routes:
 *   GET    /users              — List all users (admin only)
 *   POST   /users              — Create user (admin only)
 *   GET    /users/{id}         — Get user by ID
 *   PATCH  /users/{id}         — Update user profile
 *   DELETE /users/{id}         — Delete user (admin only)
 *   GET    /users/by-email     — Find user by email (query: ?email=)
 *
 * @module lambdas/users/controller
 */

import { findById, findByEmail, findAll, create, update, delete_ } from '../../src/dynamodb/repositories/userRepository.js';
import { success, created, noContent, notFound, badRequest } from '../shared/router.js';

// ─── Helpers ──────────────────────────────────────────

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, password, ...safe } = user;
  return safe;
}

// ─── Handlers ─────────────────────────────────────────

/**
 * GET /users — List all users.
 * Admin only. Manager can filter by department. Employee sees only self.
 */
export async function list(event) {
  const { authUser } = event;

  // Role-based access
  if (authUser.role === 'ADMIN') {
    const users = await findAll();
    return success({ users: users.map(toSafeUser) });
  }

  if (authUser.role === 'MANAGER') {
    const allUsers = await findAll();
    const deptUsers = allUsers.filter((u) => u.departmentId === authUser.departmentId);
    return success({ users: deptUsers.map(toSafeUser) });
  }

  // Employee: only see self
  const user = await findById(authUser.userId);
  return success({ users: user ? [toSafeUser(user)] : [] });
}

/**
 * POST /users — Create a new user.
 * Admin only. Creates user in DynamoDB + Cognito (if configured).
 */
export async function create(event) {
  const { parsedBody, authUser } = event;

  // Only admin can create users
  if (authUser.role !== 'ADMIN') {
    return badRequest('Only admins can create users', 'FORBIDDEN');
  }

  const { name, email, password, role, departmentId, avatar } = parsedBody || {};

  if (!name || !email || !password) {
    return badRequest('Name, email, and password are required');
  }

  // Check for duplicate email
  const existing = await findByEmail(email);
  if (existing) {
    return badRequest('Email already in use', 'CONFLICT');
  }

  const user = await create({
    id: parsedBody.id,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    avatar: avatar || null,
    role: role || 'EMPLOYEE',
    departmentId: departmentId || null,
  });

  return created({ user: toSafeUser(user) });
}

/**
 * GET /users/{id} — Get a user by ID.
 * Employee can only access their own profile.
 * Manager can access users in their department.
 */
export async function get(event) {
  const { resourceId, authUser } = event;

  if (!resourceId) {
    return badRequest('User ID is required');
  }

  const user = await findById(resourceId);
  if (!user) {
    return notFound('User not found');
  }

  // Permission check
  if (authUser.role === 'EMPLOYEE' && authUser.userId !== resourceId) {
    return badRequest('You can only view your own profile', 'FORBIDDEN');
  }

  if (authUser.role === 'MANAGER' && authUser.userId !== resourceId) {
    if (user.departmentId !== authUser.departmentId) {
      return badRequest('You can only view users in your department', 'FORBIDDEN');
    }
  }

  return success({ user: toSafeUser(user) });
}

/**
 * GET /users/by-email — Find user by email.
 * Query parameter: ?email=user@example.com
 */
export async function getByEmail(event) {
  const email = event.queryStringParameters?.email;
  if (!email) {
    return badRequest('Email query parameter is required');
  }

  const user = await findByEmail(email);
  if (!user) {
    return notFound('User not found');
  }

  return success({ user: toSafeUser(user) });
}

/**
 * PATCH /users/{id} — Update user profile.
 * Users can update their own profile.
 * Admin full access; others limited to allowed fields.
 */
export async function updateProfile(event) {
  const { resourceId, parsedBody, authUser } = event;

  if (!resourceId) {
    return badRequest('User ID is required');
  }

  // Permission check
  if (authUser.role !== 'ADMIN' && authUser.userId !== resourceId) {
    return badRequest('You can only update your own profile', 'FORBIDDEN');
  }

  const current = await findById(resourceId);
  if (!current) {
    return notFound('User not found');
  }

  // Allowed update fields
  const ALLOWED_FIELDS = ['name', 'avatar', 'phone', 'avatarHistory'];
  const updates = {};

  for (const field of ALLOWED_FIELDS) {
    if (parsedBody[field] !== undefined) {
      updates[field] = parsedBody[field];
    }
  }

  // Admin-only fields
  if (authUser.role === 'ADMIN') {
    if (parsedBody.role) updates.role = parsedBody.role;
    if (parsedBody.departmentId !== undefined) updates.departmentId = parsedBody.departmentId;
  }

  // Validate avatarHistory max 5
  if (updates.avatarHistory && updates.avatarHistory.length > 5) {
    updates.avatarHistory = updates.avatarHistory.slice(0, 5);
  }

  const updated = await update(resourceId, updates, current.version);
  if (!updated) {
    return badRequest('Failed to update user. Version conflict?', 'CONFLICT');
  }

  return success({ user: toSafeUser(updated) });
}

/**
 * DELETE /users/{id} — Delete a user.
 * Admin only.
 */
export async function deleteUser(event) {
  const { resourceId, authUser } = event;

  if (authUser.role !== 'ADMIN') {
    return badRequest('Only admins can delete users', 'FORBIDDEN');
  }

  if (!resourceId) {
    return badRequest('User ID is required');
  }

  const user = await findById(resourceId);
  if (!user) {
    return notFound('User not found');
  }

  await delete_(resourceId);
  return noContent();
}

export default { list, create, get, getByEmail, updateProfile, deleteUser };
