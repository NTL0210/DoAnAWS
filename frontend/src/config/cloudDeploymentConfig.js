/**
 * Public production endpoints used by the browser bundle.
 *
 * These identifiers are versioned with the application so an ignored local
 * .env file cannot make a production rollback use a mock or static-data path.
 * Environment variables remain supported as overrides.
 */

const DEFAULT_API_GATEWAY_URL = 'https://13svn03xe4.execute-api.ap-southeast-1.amazonaws.com/prod';
const DEFAULT_COGNITO_USER_POOL_ID = 'ap-southeast-1_nGbFbM2mf';
const DEFAULT_COGNITO_CLIENT_ID = '7d7k9htoc247sogo2qdj394na9';

function publicEnv(value) {
  return String(value || '').trim();
}

export const cloudDeploymentConfig = Object.freeze({
  appMode: 'cloud',
  apiGatewayUrl: publicEnv(process.env.NEXT_PUBLIC_API_GATEWAY_URL) || DEFAULT_API_GATEWAY_URL,
  cognitoUserPoolId: publicEnv(process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) || DEFAULT_COGNITO_USER_POOL_ID,
  cognitoClientId: publicEnv(process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID) || DEFAULT_COGNITO_CLIENT_ID,
});

export default cloudDeploymentConfig;
