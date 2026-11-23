import apiClient from './axios';


// Every function returns response.data => { success, data, message }

export const raiseBlockerApi = async (taskId, message) =>
  (await apiClient.post("/blockers", { taskId, message })).data;

export const listBlockersApi = async (status) =>
  (await apiClient.get("/blockers", { params: status ? { status } : {} })).data;

export const getBlockerApi = async (conversationId) =>
  (await apiClient.get(`/blockers/${conversationId}`)).data;

export const sendBlockerMessageApi = async (conversationId, message) =>
  (await apiClient.post(`/blockers/${conversationId}/messages`, { message })).data;

export const resolveBlockerApi = async (conversationId) =>
  (await apiClient.patch(`/blockers/${conversationId}/resolve`)).data;