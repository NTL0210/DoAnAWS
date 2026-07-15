/**
 * Cognito Amplify Auth — conditional initialization.
 *
 * Only configures Amplify when Cognito env vars are populated.
 */

import { cloudDeploymentConfig } from '@/config/cloudDeploymentConfig';

const userPoolId = cloudDeploymentConfig.cognitoUserPoolId;
const userPoolClientId = cloudDeploymentConfig.cognitoClientId;

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
