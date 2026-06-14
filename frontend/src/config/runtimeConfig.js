export const runtimeConfig = {
  appMode: process.env.NEXT_PUBLIC_APP_MODE || 'mock',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
};

export function isApiMode() {
  return runtimeConfig.appMode === 'api';
}
