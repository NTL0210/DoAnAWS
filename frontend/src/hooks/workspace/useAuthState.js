'use client';

import { useState, useCallback } from 'react';
import { isCloudMode, setAuthToken } from '@/services/apiClient';

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

export default function useAuthState() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(async (email, password) => {
    if (!isCloudMode()) {
      throw new Error('Cloud authentication is required.');
    }

    const { signIn, signOut, fetchAuthSession, getCurrentUser } = await import('aws-amplify/auth');

    try {
      await signOut();
    } catch {
      // No active session.
    }

    try {
      await signIn({
        username: email,
        password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      });
    } catch (err) {
      console.error('[Auth:login] Cognito signIn failed:', {
        name: err.name,
        message: err.message,
        code: err.code,
      });

      if (err.name === 'UserNotConfirmedException') {
        throw new Error('Tai khoan chua duoc xac thuc. Vui long kiem tra email de xac nhan.');
      }
      if (err.name === 'NotAuthorizedException') {
        throw new Error('Email hoac mat khau khong dung.');
      }
      if (err.name === 'UserNotFoundException') {
        throw new Error('Tai khoan khong ton tai.');
      }
      if (err.name === 'InvalidParameterException' || err.name === 'InvalidLambdaResponseException') {
        throw new Error('Loi cau hinh Cognito. Vui long kiem tra PreSignUp Lambda.');
      }
      if (err.message?.includes('already a signed in user')) {
        try {
          await signOut({ global: true });
        } catch {
          // Ignore cleanup failure.
        }
        throw new Error('Da xoa session cu, vui long dang nhap lai.');
      }
      throw err;
    }

    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (token) setAuthToken(token);

    const { authApi } = await import('@/services/cloudClient');
    try {
      return toHydratedUser(await authApi.me());
    } catch {
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
  }, []);

  const register = useCallback(async (name, email, password) => {
    if (!isCloudMode()) {
      throw new Error('Cloud authentication is required.');
    }

    const { signUp, signIn, fetchAuthSession, getCurrentUser } = await import('aws-amplify/auth');

    await signUp({
      username: email,
      password,
      attributes: { email, name, preferred_username: name },
    });

    await signIn({ username: email, password });

    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (token) setAuthToken(token);

    const cognitoUser = await getCurrentUser();
    const { authApi, usersApi } = await import('@/services/cloudClient');
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const userRecord = await authApi.me();
        if (userRecord) return toHydratedUser(userRecord);
      } catch {
        try {
          const userRecord = await usersApi.get(cognitoUser.userId);
          if (userRecord) return toHydratedUser(userRecord);
        } catch {
          // The confirmation trigger can take a moment to create the row.
        }
      }
    }

    return {
      id: cognitoUser.userId,
      email,
      name: name || email.split('@')[0],
      avatar: null,
      role: 'EMPLOYEE',
      departmentId: null,
      createdAt: new Date().toISOString(),
    };
  }, []);

  const setUser = useCallback((user) => {
    setCurrentUser(user);
  }, []);

  const updateCurrentUser = useCallback((updates) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      import('@/services/cloudClient').then((m) => {
        m.usersApi.update(prev.id, updates).catch(() => {});
      });
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    if (isCloudMode()) {
      import('aws-amplify/auth').then(({ signOut }) => signOut()).catch(() => {});
    }

    setCurrentUser(null);
    localStorage.removeItem('meetingAppUser');
    localStorage.removeItem('user');
    localStorage.removeItem('activeWorkspaceId');
    localStorage.removeItem('activeChannelId');

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key?.startsWith('meetingApp') ||
        key?.startsWith('voiceSettings_') ||
        key?.startsWith('workspaceSidebar_') ||
        key?.startsWith('workspaces') ||
        key?.startsWith('messages_') ||
        key?.startsWith('aiWorkforce_voiceSettings_')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    import('@/services/apiClient').then((m) => m.clearAuthToken());
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
