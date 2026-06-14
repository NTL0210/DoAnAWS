/**
 * Default features for new workspaces
 * Extracted from src/lib/workspaceData.js
 */

/** @type {Array<{id: string, name: string, icon: string, enabled: boolean}>} */
export const DEFAULT_FEATURES = [
  { id: 'meetings', name: 'Meetings', icon: 'FiUploadCloud', enabled: true },
  { id: 'tasks', name: 'Tasks', icon: 'FiCheckSquare', enabled: true },
  { id: 'analytics', name: 'Analytics', icon: 'FiBarChart2', enabled: true },
  { id: 'members', name: 'Members', icon: 'FiUsers', enabled: true },
  { id: 'teams', name: 'Teams', icon: 'FiBriefcase', enabled: true },
  { id: 'settings', name: 'Settings', icon: 'FiSettings', enabled: true },
];
