'use client';

import { useState, useCallback } from 'react';
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { loginUser, registerUser } from '@/services/userService';
import { isMockMode, isCloudMode, setAuthToken } from '@/services/apiClient';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Standalone delay helper — avoids calling setTimeout during render */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalize a user object from any source (API, localStorage, mock).
 */
export function toHydratedUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || null,
    phone: user.phone || '',
    avatarHistory: user.avatarHistory || [],
    role: user.role || 'EMPLOYEE',
    departmentId: user.departmentId || null,
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

/**
 * useAuthState — manages auth state and actions.
 *
 * @returns {{
 *   currentUser: Object|null,
 *   loading: boolean,
 *   login: (email: string, password: string) => Promise<Object>,
 *   register: (name: string, email: string, password: string) => Promise<Object>,
 *   setUser: (user: Object|null) => void,
 *   updateCurrentUser: (updates: Object) => void,
 *   logout: () => void,
 * }}
 */
export default function useAuthState() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(async (email, password) => {
    if (isCloudMode()) {
      // Cognito sign in
      await signIn({ username: email, password });

      // Store access token for API Gateway calls
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      if (token) setAuthToken(token);

      // Build user object from Cognito response
      const cognitoUser = await getCurrentUser();
      return {
        id: cognitoUser.userId,
        email: cognitoUser.signInDetails?.loginId || email,
        name: email.split('@')[0],
        avatar: null,
        role: 'EMPLOYEE',
        departmentId: null,
        createdAt: new Date().toISOString(),
      };
    }

    await delay(800);
    return loginUser(email, password);
  }, []);

  const register = useCallback(async (name, email, password) => {
    if (isCloudMode()) {
      await signUp({
        username: email,
        password,
        attributes: { email, name, preferred_username: name },
      });
      return {
        id: email,
        email,
        name: name || email.split('@')[0],
        avatar: null,
        role: 'EMPLOYEE',
        departmentId: null,
        createdAt: new Date().toISOString(),
      };
    }

    await delay(800);
    return registerUser(name, email, password);
  }, []);

  const setUser = useCallback((user) => {
    setCurrentUser(user);
    if (user) {
      // Mock-only account profile persistence. Real auth should use secure server/session storage.
      localStorage.setItem('meetingAppUser', JSON.stringify({
        user,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
      }));
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('meetingAppUser');
      localStorage.removeItem('user');
    }
  }, []);

  const updateCurrentUser = useCallback((updates) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('meetingAppUser', JSON.stringify({
        user: next,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
      }));
      localStorage.setItem('user', JSON.stringify(next));
      // Sync update to API Gateway/Next.js API in non-mock modes
      if (!isMockMode()) {
        import('@/services/cloudClient').then((m) => {
          m.usersApi.update(prev.id, updates).catch(() => {});
        });
      }
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    // Cognito sign out in cloud mode
    if (isCloudMode()) {
      signOut();
    }

    setCurrentUser(null);
    localStorage.removeItem('meetingAppUser');
    localStorage.removeItem('user');
    localStorage.removeItem('activeWorkspaceId');
    localStorage.removeItem('activeChannelId');
    // Clear ALL user-specific cached data to prevent account cross-contamination
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('voiceSettings_') || key?.startsWith('workspaceSidebar_') || key?.startsWith('workspaces') || key?.startsWith('messages_') || key?.startsWith('aiWorkforce_voiceSettings_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    // Clear auth token in cloud/api modes
    if (!isMockMode()) {
      import('@/services/apiClient').then((m) => m.clearAuthToken());
    }
  }, []);

  return {
    currentUser,
    loading,
    setLoading,
    setCurrentUser,
    login,
    register,
    setUser,
    updateCurrentUser,
    logout,
  };
}
