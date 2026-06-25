/**
 * Users Lambda — Entry point
 *
 * API Gateway resource: /users, /users/{proxy+}
 * Methods: GET, POST, PATCH, DELETE
 *
 * Auth: Cognito JWT (all endpoints require authentication)
 */

import { withAuth } from '../shared/cognitoAuth.js';
import { createRouter } from '../shared/router.js';
import * as controller from './controller.js';

const router = createRouter(controller);

/**
 * Lambda handler for users resource.
 * Wrapped with Cognito auth.
 * - ADMIN can access all users
 * - MANAGER can access department users
 * - EMPLOYEE can only access their own profile
 */
export const handler = withAuth(router);

export default handler;
