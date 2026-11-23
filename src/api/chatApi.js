import apiClient from './axios';

export const chatApi = {
  listGroups: async (all = false) =>
    (await apiClient.get('/chat/groups', { params: all ? { scope: 'all' } : undefined })).data.data,

  getGroup: async (id) => (await apiClient.get(`/chat/groups/${id}`)).data.data,

  createGroup: async (payload) => (await apiClient.post('/chat/groups', payload)).data.data,

  addMembers: async (id, userIds) =>
    (await apiClient.post(`/chat/groups/${id}/members`, { userIds })).data.data,

  removeMember: async (id, userId) =>
    (await apiClient.delete(`/chat/groups/${id}/members/${userId}`)).data.data,

  archiveGroup: async (id) => (await apiClient.post(`/chat/groups/${id}/archive`)).data.data,

  getMessages: async (id, before) =>
    (await apiClient.get(`/chat/groups/${id}/messages`, { params: { before } })).data.data,

  // Text + files in one multipart request (axios sets the boundary header itself)
  sendMessage: async (id, body, files) => {
    const form = new FormData();
    if (body) form.append('body', body);
    files.forEach((f) => form.append('files', f));
    return (
      await apiClient.post(`/chat/groups/${id}/messages`, form, {
        headers: { 'Content-Type': undefined },
      })
    ).data.data;
  },

  deleteMessage: async (groupId, messageId) => {
    await apiClient.delete(`/chat/groups/${groupId}/messages/${messageId}`);
  },

  markRead: async (groupId, messageId) => {
    await apiClient.post(`/chat/groups/${groupId}/read`, { messageId });
  },

  // <img src> can't send the Authorization header, so files are fetched as blobs
  fetchAttachment: async (url) => (await apiClient.get(url, { responseType: 'blob' })).data,

  // Change this to your real "list users" endpoint
  listUsers: async () => (await apiClient.get('/users')).data.data,

  renameGroup: async (id, name) =>
    (await apiClient.patch(`/chat/groups/${id}`, { name })).data.data,
  deleteGroup: async (id) =>
    (await apiClient.delete(`/chat/groups/${id}`)).data,
};