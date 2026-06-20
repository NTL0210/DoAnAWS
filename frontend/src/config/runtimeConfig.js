/**
 * Runtime Configuration — controls app behavior based on environment
 *
 * Modes:
 *   mock (default)  → Uses WorkspaceContext + localStorage directly
 *   api             → Calls Next.js API routes (pages/api/*)
 *   cloud           → Calls API Gateway + Cognito auth (production AWS)
 *
 * @module config/runtimeConfig
 */

export const runtimeConfig = {
  /** @type {'mock'|'api'|'cloud'} */
  appMode: (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_APP_MODE
    : 'mock') || 'mock',

  /** @type {string} */
  apiBaseUrl: (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : '/api') || '/api',

  /** @type {string} */
  apiGatewayUrl: (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_GATEWAY_URL
    : '') || '',

  /** @type {boolean} Enable CloudFront/Cognito integration */
  enableCloudAuth: (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_ENABLE_CLOUD_AUTH
    : 'false') === 'true',
};

/**
 * Check if the app should use Next.js API routes.
 * @returns {boolean}
 */
export function isApiMode() {
  return runtimeConfig.appMode === 'api';
}

/**
 * Check if the app should use production AWS (API Gateway + Cognito).
 * @returns {boolean}
 */
export function isCloudMode() {
  return runtimeConfig.appMode === 'cloud';
}

/**
 * Check if the app is in local mock/development mode.
 * @returns {boolean}
 */
export function isMockMode() {
  return runtimeConfig.appMode === 'mock';
}

export default runtimeConfig;
