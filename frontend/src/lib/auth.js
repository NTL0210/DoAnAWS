// Auth service mock - handles login/logout and session management

export const authService = {
  // Login user
  login: async (email, password, role) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // In a real app, this would validate credentials against a database
    // For demo, we accept any email/password and find user by role

    // Import users from legacyDataService
    const { getUsers } = await import('@/services/legacyDataService');
    const users = await getUsers();

    // Find user matching role (simplified for demo)
    const user = users.find(u =>
      u.role.toLowerCase() === role.toLowerCase() &&
      u.status === 'ACTIVE'
    );

    if (!user) {
      throw new Error('No active user found for this role');
    }

    // Return user object (in real app, this would include JWT token)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      avatar: user.avatar
    };
  },

  // Logout user
  logout: async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    // In real app, this would invalidate token on server
    return { success: true };
  },

  // Get current user from session
  getCurrentUser: async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Get from localStorage (mock session)
    const userJson = localStorage.getItem('meetingAppUser');
    if (!userJson) {
      return null;
    }

    return JSON.parse(userJson);
  },

  // Set current user in session
  setCurrentUser: async (user) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Save to localStorage (mock session)
    localStorage.setItem('meetingAppUser', JSON.stringify(user));
    return { success: true };
  },

  // Clear current user from session
  clearCurrentUser: async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Remove from localStorage
    localStorage.removeItem('meetingAppUser');
    return { success: true };
  },

  // Check if user is authenticated
  isAuthenticated: async () => {
    const user = await authService.getCurrentUser();
    return !!user;
  },

  // Check if user has specific role
  hasRole: async (requiredRole) => {
    const user = await authService.getCurrentUser();
    return user && user.role === requiredRole;
  }
};

export default authService;