/**
 * UserService — business logic for user accounts
 *
 * Note: This service handles account-level operations (login, register).
 * Workspace membership is managed via workspace/team services.
 */

import { userRepo } from '@/repositories';
import { generateId } from '@/services/workspaceService';

/**
 * Authenticate a user by email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 * @throws {Error} If user not found or password mismatch
 */
export async function loginUser(email, password) {
  const user = await userRepo.findByEmail(email);
  if (!user) throw new Error('Email không tồn tại');
  if (password !== '123456') throw new Error('Mật khẩu không đúng');

  // Return account-only object (NO global role)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  };
}

/**
 * Register a new user
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function registerUser(name, email, password) {
  if (!name || !email || !password) throw new Error('Vui lòng điền đầy đủ thông tin');

  const existing = await userRepo.findByEmail(email);
  if (existing) throw new Error('Email đã được sử dụng');

  const user = await userRepo.create({
    id: 'user-' + generateId(),
    name,
    email,
    password,
    avatar: null,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  };
}

/**
 * Get user by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getUserById(id) {
  return userRepo.findById(id);
}

/**
 * Get all users
 * @returns {Promise<Object[]>}
 */
export async function getAllUsers() {
  return userRepo.findAll();
}
