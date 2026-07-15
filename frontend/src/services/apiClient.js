/**
 * API Client — Abstraction layer for backend calls
 *
 * Calls backend services through API Gateway/Cognito.
 *
 * @module services/apiClient
 */

import { cloudDeploymentConfig } from '@/config/cloudDeploymentConfig';

/**
 * Check if the app is running in cloud (API Gateway) mode.
 * @returns {boolean}
 */
export function isCloudMode() {
  return true;
}

/**
 * Get the API base URL for cloud mode.
 * @returns {string}
 */
export function getApiBaseUrl() {
  if (typeof process !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
  }
  return '/api';
}

/**
 * Get the API Gateway URL (for cloud deployments).
 * Reads from env or defaults to the CloudFront distribution.
 * @returns {string}
 */
export function getApiGatewayUrl() {
  return cloudDeploymentConfig.apiGatewayUrl;
}

// ─── Token Management ─────────────────────────────────

const TOKEN_KEY = 'meetingAppAuthToken';

/**
 * Store the auth token from Cognito.
 * @param {string} token
 */
export function setAuthToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Get the stored auth token.
 * @returns {string|null}
 */
export function getAuthToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

/**
 * Remove the auth token (logout).
 */
export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('meetingAppUser');
  }
}

// ─── API HTTP Client ──────────────────────────────────

/**
 * Make an authenticated API call to the backend.
 *
 * @param {string} path - API path (e.g., '/users', '/meetings')
 * @param {Object} [options]
 * @param {string} [options.method='GET']
 * @param {Object} [options.body]
 * @param {Object} [options.params] - Query parameters
 * @param {boolean} [options.noAuth=false] - Skip auth header
 * @returns {Promise<Object>} Response data
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, params, noAuth = false } = options;
  const token = getAuthToken();

  // Build URL
  const baseUrl = getApiGatewayUrl() || getApiBaseUrl();
  let url = `${baseUrl}${path}`;

  // Add query parameters
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

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token && !noAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
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
      throw new ApiError(
        json.message || `HTTP ${response.status}`,
        json.error || 'API_ERROR',
        response.status,
        json
      );
    }

    return json;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err.message || 'Network error',
      'NETWORK_ERROR',
      0
    );
  }
}

// ─── API Error Class ──────────────────────────────────

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} statusCode
   * @param {Object} [details]
   */
  constructor(message, code = 'API_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    // Common error codes
    if (code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID_TOKEN') {
      this.isAuthError = true;
    }
    if (code === 'FORBIDDEN') {
      this.isForbidden = true;
    }
  }
}

// ─── Convenience Methods ──────────────────────────────

export const api = {
  get: (path, params) => apiRequest(path, { method: 'GET', params }),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
};

export default {
  apiRequest,
  api,
  isCloudMode,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  getApiBaseUrl,
  ApiError,
};
