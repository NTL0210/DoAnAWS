/**
 * Cloud API Client — calls API Gateway Lambda endpoints
 *
 * Used when NEXT_PUBLIC_APP_MODE=cloud.
 * Every request is authenticated with the Cognito access token.
 *
 * @module services/cloudClient
 */

import { runtimeConfig } from '@/config/runtimeConfig';
import { getAuthToken, clearAuthToken } from './apiClient';

const BASE_URL = runtimeConfig.apiGatewayUrl;

/**
 * Make an authenticated API Gateway request.
 *
 * @param {string} path - e.g. '/users', '/meetings/{id}'
 * @param {Object} [options]
 * @param {string} [options.method='GET']
 * @param {Object} [options.body]
 * @param {Object} [options.params] - Query parameters
 * @returns {Promise<Object>} Parsed JSON body
 */
async function request(path, options = {}) {
  const { method = 'GET', body, params } = options;

  const token = getAuthToken();
  if (!token) {
    throw new CloudError('Authentication required', 'AUTH_REQUIRED', 401);
  }

  // Build URL
  let url = `${BASE_URL}${path}`;

  // Add query params
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return { success: true, data: null };
  }

  const json = await response.json();

  if (!response.ok) {
    // Token expired — clear auth
    if (response.status === 401) {
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    throw new CloudError(
      json.message || `HTTP ${response.status}`,
      json.error || 'API_ERROR',
      response.status,
      json
    );
  }

  // API Gateway Lambda responses come as { success: true, data: ... }
  // Return the data field directly for convenience
  return json.data !== undefined ? json.data : json;
}

// ─── Error Class ──────────────────────────────────

export class CloudError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} statusCode
   * @param {Object} [details]
   */
  constructor(message, code = 'API_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = 'CloudError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ─── Auth API ─────────────────────────────────────

export const authApi = {
  /** POST /auth/login — returns { token, user }. No auth token required. */
  login: (email, password) => {
    // For login, we bypass the auth check and pass credentials directly
    const url = `${BASE_URL}/auth/login`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(async (response) => {
      if (!response.ok) {
        const json = await response.json();
        throw new CloudError(
          json.message || 'Login failed',
          json.error || 'AUTH_ERROR',
          response.status
        );
      }
      const json = await response.json();
      return json.data !== undefined ? json.data : json;
    });
  },

  /** GET /auth/me — returns current user */
  me: () => request('/auth/me'),
};

// ─── Users API ────────────────────────────────────

export const usersApi = {
  list: (params) => request('/users', { params }),
  get: (id) => request(`/users/${id}`),
  getByEmail: (email) => request('/users/by-email', { params: { email } }),
  create: (data) => request('/users', { method: 'POST', body: data }),
  update: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};

// ─── Meetings API ─────────────────────────────────

export const meetingsApi = {
  list: (params) => request('/meetings', { params }),
  get: (id) => request(`/meetings/${id}`),
  create: (data) => request('/meetings', { method: 'POST', body: data }),
  update: (id, data) => request(`/meetings/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/meetings/${id}`, { method: 'DELETE' }),
  process: (id) => request(`/meetings/${id}/process`, { method: 'POST' }),
};

// ─── Tasks API ────────────────────────────────────

export const tasksApi = {
  list: (params) => request('/tasks', { params }),
  get: (id) => request(`/tasks/${id}`),
  create: (data) => request('/tasks', { method: 'POST', body: data }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
};

// ─── Workspaces API ───────────────────────────────

export const workspacesApi = {
  list: (params) => request('/workspaces', { params }),
  get: (id) => request(`/workspaces/${id}`),
  create: (data) => request('/workspaces', { method: 'POST', body: data }),
  update: (id, data) => request(`/workspaces/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/workspaces/${id}`, { method: 'DELETE' }),
  getMembers: (id) => request(`/workspaces/${id}/members`),
  addMember: (id, data) => request(`/workspaces/${id}/members`, { method: 'POST', body: data }),
  removeMember: (id, userId) => request(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
};

export default { request, authApi, usersApi, meetingsApi, tasksApi, workspacesApi, CloudError };
