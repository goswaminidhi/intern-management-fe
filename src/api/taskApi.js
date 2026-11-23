import apiClient from './axios';

export const taskApi = {
  /**
   * Fetch all tasks with optional filters from backend database
   * @param {object} filters { mentee_id, assigned_by, status, priority, category, search, page, limit }
   * @returns {Promise<Array>}
   */
  async getTasks(filters = {}) {
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null)
    );
    const response = await apiClient.get('/tasks', {
      params: { limit: 100, ...cleanFilters },
    });
    return response.data?.data || [];
  },

  /**
   * Fetch task by ID
   * @param {number|string} id
   * @returns {Promise<object>}
   */
  async getTaskById(id) {
    const response = await apiClient.get(`/tasks/${id}`);
    return response.data?.data;
  },

  /**
   * Create and assign a new task in backend database
   * @param {object} taskData
   * @returns {Promise<object>}
   */
  async createTask(taskData) {
    const isFormData = typeof FormData !== 'undefined' && taskData instanceof FormData;
    const response = await apiClient.post(
      '/tasks',
      taskData,
      isFormData ? { headers: { 'Content-Type': undefined } } : {}
    );
    return response.data?.data;
  },

  /**
   * Update an existing task in backend database
   * @param {number|string} id
   * @param {object} updates
   * @returns {Promise<object>}
   */
  async updateTask(id, updates) {
    const response = await apiClient.patch(`/tasks/${id}`, updates);
    return response.data?.data;
  },

  /**
   * Update task status (Mentee for own task, Mentor/Admin for managed task)
   * @param {number|string} id
   * @param {'in-progress'|'submitted'|'needs-revision'|'complete'|'hold'} status
   * @returns {Promise<object>}
   */
  async updateTaskStatus(id, status) {
    const response = await apiClient.patch(`/tasks/${id}/status`, { status });
    return response.data?.data;
  },

  /**
   * Submit task assignment deliverables (Mentee action)
   * @param {number|string} id
   * @param {object} submissionData { submission_url, demo_url, submission_notes }
   * @returns {Promise<object>}
   */
  async submitTask(id, submissionData) {
    const response = await apiClient.patch(`/tasks/${id}/submit`, submissionData);
    return response.data?.data;
  },

  /**
   * Evaluate task submission (Mentor action)
   * @param {number|string} id
   * @param {object} evalData { feedback, status }
   * @returns {Promise<object>}
   */
  async evaluateTask(id, evalData) {
    const response = await apiClient.patch(`/tasks/${id}/evaluate`, evalData);
    return response.data?.data;
  },

  /**
   * Delete a task from database
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async deleteTask(id) {
    const response = await apiClient.delete(`/tasks/${id}`);
    return response.data?.success;
  },

  /**
   * Download and decrypt task attachment
   */
  async downloadAttachment(taskId, attachmentId, fileName = 'attachment') {
    const response = await apiClient.get(`/tasks/${taskId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default taskApi;
