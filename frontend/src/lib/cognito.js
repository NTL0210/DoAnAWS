/**
 * Cognito Amplify Auth — conditional initialization.
 *
 * Only configures Amplify when Cognito env vars are actually populated.
 * In mock mode (empty credentials) this module is a no-op to prevent
 * Amplify from auto-initializing Auth and causing spurious 400 errors
 * from Cognito and E353 csPostMessage timeouts.
 */

const userPoolId =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID : '') || '';
const userPoolClientId =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID : '') || '';

if (userPoolId && userPoolClientId) {
  // Dynamic import to avoid loading Amplify Auth in mock mode
  import('aws-amplify').then(({ Amplify }) => {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
          loginWith: {
            email: true,
          },
        },
      },
    });
  }).catch(() => {
    // Silently ignore — not critical for mock mode
  });
}
