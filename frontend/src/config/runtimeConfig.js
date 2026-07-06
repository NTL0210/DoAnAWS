/**
 * Runtime Configuration - API Gateway and Cognito settings.
 */

export const runtimeConfig = {
  /** @type {'api'|'cloud'} */
  appMode: (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_APP_MODE
    : 'cloud') || 'cloud',

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

export default runtimeConfig;
