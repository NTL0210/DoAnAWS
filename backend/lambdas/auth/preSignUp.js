/**
 * PreSignUp Lambda Trigger — Auto-confirm users
 *
 * Khi một user đăng ký qua Cognito signUp, Lambda này tự động:
 * - Confirm user (không cần email verification code)
 * - Verify email
 *
 * Triển khai: Thêm vào Cognito User Pool → Triggers → Pre sign-up
 *
 * @module lambdas/auth/preSignUp
 */
export async function handler(event) {
  // Auto-confirm user
  event.response.autoConfirmUser = true;

  // Auto-verify email
  if (event.request.userAttributes?.email) {
    event.response.autoVerifyEmail = true;
  }

  console.log(`[PreSignUp] Auto-confirmed: ${event.userName}`);
  return event;
}

export default { handler };
