import apiClient, { refreshAccessToken } from './axios';

export const authApi = {
  /**
   * Log in user with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, message: string, accessToken: string, token?: string, user: object, redirectTo: string}>}
   */
  async login(email, password) {
    const response = await apiClient.post('/users/login', { email, password });
    return response.data;
  },

  /**
   * Refresh access token using THIS tab's user's httpOnly refresh cookie (deduplicated).
   * The user id is read from sessionStorage inside refreshAccessToken().
   * @returns {Promise<{success: boolean, accessToken: string, token?: string, user: object}>}
   */
  async refresh() {
    const token = await refreshAccessToken();
    return { success: true, accessToken: token };
  },

  /**
   * Log out this session only (revokes this user's refresh cookie & clears it)
   * @param {number|string} userId
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async logout(userId) {
    const response = await apiClient.post('/users/logout', { userId });
    return response.data;
  },

  /**
   * Log out from all devices for the authenticated user
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async logoutAll() {
    const response = await apiClient.post('/users/logout-all');
    return response.data;
  },

  /**
   * Fetch current authenticated user profile
   * @returns {Promise<{success: boolean, user: object}>}
   */
  async getCurrentUser() {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  /**
   * Change current user's password (supports first login password setup)
   * @param {string} newPassword
   * @returns {Promise<{success: boolean, message: string, accessToken?: string, token?: string, user?: object}>}
   */
  async changePassword(newPassword) {
    const response = await apiClient.patch('/users/changepassword', { newPassword });
    return response.data;
  },

   /**
   * Change password for an already-logged-in user (requires current password)
   * @param {{currentPassword: string, newPassword: string, confirmPassword: string}} payload
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async updatePassword({ currentPassword, newPassword, confirmPassword }) {
    const response = await apiClient.patch('/users/update-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    return response.data;
  },

  /**
   * Mark first login as completed for a user ID
   * @param {number|string} id
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async completeFirstLogin(id) {
    if (!id) {
      throw new Error('User ID is required to complete first login.');
    }
    const response = await apiClient.patch(`/users/${id}/complete-first-login`);
    return response.data;
  },
};



export default authApi;