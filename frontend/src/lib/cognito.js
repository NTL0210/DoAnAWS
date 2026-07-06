/**
 * Cognito Amplify Auth — conditional initialization.
 *
 * Only configures Amplify when Cognito env vars are populated.
 */

const userPoolId =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID : '') || '';
const userPoolClientId =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID : '') || '';

if (userPoolId && userPoolClientId) {
  // Dynamic import keeps Amplify out of bundles that do not configure Cognito.
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
    // Auth bootstrap failure is surfaced by login/register calls.
  });
}
