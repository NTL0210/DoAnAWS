import { cloudDeploymentConfig } from './cloudDeploymentConfig';

/** Runtime configuration for the cloud-only application. */

export const runtimeConfig = {
  /** @type {'cloud'} */
  appMode: cloudDeploymentConfig.appMode,

  /** @type {string} */
  apiBaseUrl: (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : '/api') || '/api',

  /** @type {string} */
  apiGatewayUrl: cloudDeploymentConfig.apiGatewayUrl,

  /** @type {boolean} Enable CloudFront/Cognito integration */
  enableCloudAuth: true,
};

/**
 * Check if the app should use Next.js API routes.
 * @returns {boolean}
 */
export function isApiMode() {
  return false;
}

/**
 * Check if the app should use production AWS (API Gateway + Cognito).
 * @returns {boolean}
 */
export function isCloudMode() {
  return true;
}

export default runtimeConfig;
