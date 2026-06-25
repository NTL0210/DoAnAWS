/**
 * Tasks Lambda — Entry point
 *
 * API Gateway resource: /tasks, /tasks/{proxy+}
 * Methods: GET, POST, PATCH, DELETE
 * Auth: Cognito JWT
 */

import { withAuth } from '../shared/cognitoAuth.js';
import { createRouter } from '../shared/router.js';
import * as controller from './controller.js';

const router = createRouter(controller);

export const handler = withAuth(router);
export default handler;
