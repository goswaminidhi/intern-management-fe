import apiClient from './axios';

export const userApi = {
  /**
   * Fetch all users with optional filtering (role, status, name, assigned_to, email, id)
   * @param {object} params
   * @returns {Promise<{success: boolean, count: number, data: Array}>}
   */
  async getUsers(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
    );
    const response = await apiClient.get('/users', { params: cleanParams });
    return response.data;
  },

  /**
   * Create a new user (admin, mentor, mentee)
   * @param {object} userData { name, email, role, status, assigned_to, assignedMentees }
   * @returns {Promise<{success: boolean, message: string, data: object}>}
   */
  async createUser(userData) {
    const response = await apiClient.post('/users', userData);
    return response.data;
  },

  /**
   * Update an existing user's details
   * @param {number|string} id
   * @param {object} updateData { name, email, status, role, assigned_to }
   * @returns {Promise<{success: boolean, message: string, data: object}>}
   */
  async updateUser(id, updateData) {
    const response = await apiClient.patch(`/users/update/${id}`, updateData);
    return response.data;
  },

  /**
   * Assign, change, or remove a mentor for a mentee (Admin only)
   * @param {number|string} menteeId
   * @param {number|null} mentorId
   * @returns {Promise<{success: boolean, action: string, message: string, data: object}>}
   */
  async assignMentor(menteeId, mentorId) {
    const response = await apiClient.patch(`/users/${menteeId}/assign-mentor`, {
      mentor_id: mentorId ?? null,
    });
    return response.data;
  },

  /**
   * Delete a user by ID
   * @param {number|string} id
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteUser(id) {
    const response = await apiClient.delete(`/users/delete/${id}`);
    return response.data;
  },
};

export default userApi;
