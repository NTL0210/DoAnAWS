/**
 * Request validation middleware for API routes.
 *
 * Usage:
 *   import { withValidation } from '@/middleware/withValidation';
 *
 *   const schema = {
 *     body: {
 *       title: { required: true, type: 'string' },
 *       priority: { required: false, type: 'string', oneOf: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
 *     },
 *     query: {
 *       status: { required: false, type: 'string' },
 *     },
 *   };
 *
 *   export default withValidation(handler, schema);
 */

/**
 * Validates a value against a field rule.
 *
 * @param {*} value
 * @param {Object} rule - { required, type, oneOf }
 * @param {string} fieldName - For error messages
 * @returns {string|null} Error message or null
 */
function validateField(value, rule, fieldName) {
  if (value === undefined || value === null || value === '') {
    if (rule.required) {
      return `${fieldName} is required`;
    }
    return null; // optional and empty = skip further checks
  }

  if (rule.type === 'string' && typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (rule.type === 'number' && typeof value !== 'number') {
    return `${fieldName} must be a number`;
  }
  if (rule.type === 'boolean' && typeof value !== 'boolean') {
    return `${fieldName} must be a boolean`;
  }
  if (rule.type === 'array' && !Array.isArray(value)) {
    return `${fieldName} must be an array`;
  }

  if (rule.oneOf && !rule.oneOf.includes(value)) {
    return `${fieldName} must be one of: ${rule.oneOf.join(', ')}`;
  }

  if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
    return `${fieldName} must be at least ${rule.minLength} characters`;
  }

  return null;
}

/**
 * Wraps an API handler with request validation.
 *
 * @param {Function} handler
 * @param {Object} schema - { body: {...}, query: {...}, params: {...} }
 * @returns {Function}
 */
export function withValidation(handler, schema = {}) {
  return async function validatedHandler(req, res) {
    const errors = [];

    // Validate request body
    if (schema.body) {
      for (const [field, rule] of Object.entries(schema.body)) {
        const err = validateField(req.body?.[field], rule, `body.${field}`);
        if (err) errors.push(err);
      }
    }

    // Validate query params
    if (schema.query) {
      for (const [field, rule] of Object.entries(schema.query)) {
        const err = validateField(req.query?.[field], rule, `query.${field}`);
        if (err) errors.push(err);
      }
    }

    // Validate path params
    if (schema.params) {
      for (const [field, rule] of Object.entries(schema.params)) {
        const err = validateField(req.query?.[field], rule, `params.${field}`);
        if (err) errors.push(err);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    return handler(req, res);
  };
}
