import userApi from './userApi';

export const mentorApi = {
  /**
   * Fetch all mentors from backend
   * @param {object} params
   * @returns {Promise<Array>}
   */
  async getMentors(params = {}) {
    const res = await userApi.getUsers({ role: 'mentor', ...params });
    return res.data || [];
  },

  /**
   * Fetch mentees assigned to a specific mentor by mentor's name
   * @param {string} mentorName
   * @param {object} params
   * @returns {Promise<Array>}
   */
  async getAssignedMentees(mentorName, params = {}) {
    const res = await userApi.getUsers({
      role: 'mentee',
      assigned_to: mentorName,
      ...params,
    });
    return res.data || [];
  },

  /**
   * Assign, change, or remove a mentor for a mentee (by mentor ID or legacy mentor name)
   * @param {number|string} menteeId
   * @param {number|string|null} mentorIdOrName
   * @returns {Promise<object>}
   */
  async assignMentee(menteeId, mentorIdOrName) {
    if (
      mentorIdOrName === null ||
      typeof mentorIdOrName === 'number' ||
      (typeof mentorIdOrName === 'string' && /^\d+$/.test(mentorIdOrName.trim()))
    ) {
      const mentorId = mentorIdOrName === null ? null : Number(mentorIdOrName);
      return userApi.assignMentor(menteeId, mentorId);
    }
    return userApi.updateUser(menteeId, { assigned_to: mentorIdOrName || null });
  },
};

export default mentorApi;
