/**
 * Workspace View Utilities
 *
 * Single source of truth for valid workspace views.
 * Used across WorkspaceChannelView, AppShell, Sidebar, and other components
 * to ensure consistent view navigation without URL/state conflicts.
 */

/**
 * Valid workspace view names — these are the ONLY views that should
 * appear in the URL query param and be accepted as activeView values.
 */
export const VALID_WORKSPACE_VIEWS = [
  'home',
  'meetings',
  'tasks',
  'analytics',
  'members',
  'teams',
  'team-chat',
  'settings',
];

/**
 * Checks if a given string is a valid workspace view.
 * @param {string|null|undefined} view
 * @returns {boolean}
 */
export function isValidWorkspaceView(view) {
  return VALID_WORKSPACE_VIEWS.includes(view);
}

/**
 * Normalizes a view string to a valid workspace view.
 * Returns null for invalid/missing views (will fall back to 'home').
 * @param {string|null|undefined} view
 * @returns {string|null}
 */
export function normalizeWorkspaceView(view) {
  if (isValidWorkspaceView(view)) return view;
  return null;
}

/**
 * Safely extracts the view from a Next.js router.query object.
 * Handles both string and string[] query values.
 * @param {Object} query - router.query object
 * @returns {string|null} - the view string or null
 */
export function getQueryView(query) {
  if (!query) return null;
  const view = Array.isArray(query.view) ? query.view[0] : query.view;
  return view || null;
}
