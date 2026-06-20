/**
 * Lambda Router — Universal request router for API Gateway → Lambda
 *
 * Converts API Gateway proxy events into controller calls.
 * Each Lambda function serves one resource (users, meetings, tasks, etc.)
 * and routes based on HTTP method + path.
 *
 * Usage in Lambda handler:
 *   import { createRouter } from '../shared/router.js';
 *   import * as userController from './userController.js';
 *
 *   export const handler = createRouter(userController);
 *
 * @module lambdas/shared/router
 */

import { apiResponse } from './cognitoAuth.js';

/**
 * @typedef {Object} RouteMap
 * @property {Function} GET - handler(event, context) => response
 * @property {Function} POST
 * @property {Function} PATCH
 * @property {Function} DELETE
 * @property {Function} [GET_/:id]
 * @property {Function} [PATCH_/:id]
 * @property {Function} [DELETE_/:id]
 * @property {Function} [POST_/:id/action]
 */

/**
 * Create a Lambda handler that routes API Gateway requests to controller methods.
 *
 * Controller methods receive (event, context) and must return an API Gateway
 * response object { statusCode, headers, body }.
 *
 * Use the built-in helpers:
 *   - success(data, statusCode = 200)
 *   - created(data)
 *   - noContent()
 *   - notFound(message)
 *   - error(statusCode, code, message)
 *
 * @param {Object} controller - Object with methods named by HTTP method + path
 * @returns {Function} Lambda handler
 */
export function createRouter(controller) {
  return async (event, context) => {
    try {
      // Handle CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return apiResponse(200, {});
      }

      const method = event.httpMethod;
      const path = event.path || '';
      const pathParams = event.pathParameters || {};
      const resource = event.resource || '';
      const hasId = !!pathParams.proxy || !!pathParams.id;

      // Determine the controller method to call
      // Priority: specific method > general method
      let controllerMethod = null;

      if (method === 'GET') {
        if (hasId) {
          controllerMethod = controller.get || controller.GET_ID;
        } else {
          controllerMethod = controller.list || controller.GET;
        }
      } else if (method === 'POST') {
        // Check for action sub-resources (e.g., POST /meetings/{id}/process)
        if (hasId && path.includes('/')) {
          const action = extractAction(path);
          const actionMethodName = `POST_${toCamel(action)}`;
          controllerMethod = controller[actionMethodName];
        }
        if (!controllerMethod) {
          controllerMethod = controller.create || controller.POST;
        }
      } else if (method === 'PATCH') {
        controllerMethod = controller.update || controller.PATCH;
      } else if (method === 'DELETE') {
        controllerMethod = controller.delete_ || controller.DELETE;
      }

      if (!controllerMethod) {
        return apiResponse(405, {
          success: false,
          error: 'METHOD_NOT_ALLOWED',
          message: `Method ${method} not allowed on this resource`,
        });
      }

      // Parse request body
      let body = {};
      if (event.body) {
        try {
          body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch {
          return apiResponse(400, {
            success: false,
            error: 'INVALID_JSON',
            message: 'Request body is not valid JSON',
          });
        }
      }

      // Extract resource ID from path
      const resourceId = extractId(event);

      return await controllerMethod({
        ...event,
        resourceId,
        parsedBody: body,
        authUser: event.authUser,
      }, context);
    } catch (err) {
      console.error('[router] Unhandled error:', err);
      return apiResponse(500, {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    }
  };
}

// ─── Helpers ──────────────────────────────────────────

/**
 * Extract resource ID from API Gateway path parameters.
 *
 * @param {Object} event
 * @returns {string|null}
 */
function extractId(event) {
  const params = event.pathParameters || {};
  if (params.id) return params.id;
  if (params.proxy) {
    // path: /users/user-123 -> id = user-123
    const segments = params.proxy.split('/');
    // If proxy is "user-123" or "user-123/some-action"
    return segments[0] || null;
  }
  return null;
}

/**
 * Extract the action from a POST path like /meetings/{id}/process
 * @param {string} path
 * @returns {string}
 */
function extractAction(path) {
  const segments = path.split('/').filter(Boolean);
  // /api/meetings/{id}/process -> ["api", "meetings", "{id}", "process"]
  // In API Gateway, the path might resolve the id
  if (segments.length >= 4) {
    return segments[segments.length - 1];
  }
  // If path like /meetings/abc123/process
  if (segments.length === 3) {
    return segments[2];
  }
  return '';
}

/**
 * Convert kebab-case or slash-separated to camelCase.
 * "process-meeting" -> "processMeeting"
 *
 * @param {string} str
 * @returns {string}
 */
function toCamel(str) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr?.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
    || 'action';
}

// ─── Response Helpers ─────────────────────────────────

/**
 * Create a success response.
 *
 * @param {Object} data - Response data
 * @param {number} [statusCode=200]
 * @returns {Object} API Gateway response
 */
export function success(data, statusCode = 200) {
  return apiResponse(statusCode, {
    success: true,
    data,
  });
}

/**
 * Create a 201 Created response.
 * @param {Object} data
 * @returns {Object}
 */
export function created(data) {
  return success(data, 201);
}

/**
 * Create a 204 No Content response.
 * @returns {Object}
 */
export function noContent() {
  return apiResponse(204, null);
}

/**
 * Create a 404 Not Found response.
 * @param {string} [message='Resource not found']
 * @returns {Object}
 */
export function notFound(message = 'Resource not found') {
  return apiResponse(404, {
    success: false,
    error: 'RESOURCE_NOT_FOUND',
    message,
  });
}

/**
 * Create a 400 Bad Request response.
 * @param {string} message
 * @param {string} [code='VALIDATION_ERROR']
 * @returns {Object}
 */
export function badRequest(message, code = 'VALIDATION_ERROR') {
  return apiResponse(400, {
    success: false,
    error: code,
    message,
  });
}

/**
 * Create a typed error response.
 * @param {number} statusCode
 * @param {string} code
 * @param {string} message
 * @returns {Object}
 */
export function error(statusCode, code, message) {
  return apiResponse(statusCode, {
    success: false,
    error: code,
    message,
  });
}

export default { createRouter, success, created, noContent, notFound, badRequest, error };
