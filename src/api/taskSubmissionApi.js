import apiClient from './axios';

// Submit or resubmit a task
export const submitTaskVersion = async (taskId, data) => {
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  const response = await apiClient.post(
    `/tasks/${taskId}/submit`,
    data,
    isFormData ? { headers: { 'Content-Type': undefined } } : {}
  );
  return response.data;
};

// Get all submission versions of a task
export const getTaskSubmissionHistory = async (taskId) => {
  const response = await apiClient.get(`/tasks/${taskId}/submissions`);
  return response.data;
};

// Mentor requests changes on a submission
export const requestChangesApi = async (submissionId, { feedback, score } = {}) => {
  const payload = { feedback };
  if (score !== undefined && score !== null) payload.score = score;
  const response = await apiClient.patch(
    `/submissions/${submissionId}/request-changes`,
    payload
  );
  return response.data;
};

// Mentor approves a submission
export const approveSubmissionApi = async (submissionId, { feedback, score } = {}) => {
  const payload = { feedback };
  if (score !== undefined && score !== null) payload.score = score;
  const response = await apiClient.patch(
    `/submissions/${submissionId}/approve`,
    payload
  );
  return response.data;
};

// Download decrypted submission deliverable attachment
export const downloadSubmissionAttachmentApi = async (submissionId, fileName = 'submission-deliverable') => {
  const response = await apiClient.get(`/submissions/${submissionId}/attachment`, {
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
};
