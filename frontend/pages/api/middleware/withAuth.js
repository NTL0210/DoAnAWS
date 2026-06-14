/**
 * Authentication + Authorization middleware for API routes.
 *
 * Usage:
 *   import { withAuth } from '@/middleware/withAuth';
 *
 *   async function handler(req, res) {
 *     // req.user is available here
 *     const { userId, role, workspaceId } = req.user;
 *   }
 *
 *   export default withAuth(handler, { roles: ['ADMIN', 'MANAGER'] });
 *
 * Notes:
 * - Currently uses a simplified JWT check (suitable for mock/dev).
 * - Replace with Amazon Cognito verification in production.
 * - Always return safe error messages — never leak token internals.
 */

/**
 * Wraps an API handler with authentication and optional role-based authorization.
 *
 * @param {Function} handler - The route handler (req, res) => void
 * @param {Object} [options]
 * @param {string[]} [options.roles] - Allowed roles. Omit to allow any authenticated user.
 * @returns {Function} Wrapped handler
 */
export function withAuth(handler, options = {}) {
  return async function authenticatedHandler(req, res) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED',
        });
      }

      const token = authHeader.split(' ')[1];

      // Simplified JWT verification for MVP.
      // TODO: Replace with Amazon Cognito JWT verification in production.
      let decoded;
      try {
        const base64Payload = token.split('.')[1];
        const payload = JSON.parse(
          Buffer.from(base64Payload, 'base64').toString('utf-8')
        );
        decoded = payload;
      } catch {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
          error: 'AUTH_INVALID_TOKEN',
        });
      }

      // Attach user info to request
      req.user = {
        userId: decoded.sub || decoded.userId,
        role: decoded.role,
        email: decoded.email,
        workspaceId: decoded.workspaceId,
        departmentId: decoded.departmentId,
      };

      // Role-based guard
      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to access this resource',
            error: 'FORBIDDEN',
          });
        }
      }

      return handler(req, res);
    } catch (err) {
      console.error('[withAuth] Unexpected error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR',
      });
    }
  };
}
