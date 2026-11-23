// src/api/timeLog.js
import api from './axios'; // your existing axios instance

export const getTaskTime = async (taskId) =>
  (await api.get(`/tasks/${taskId}/time`)).data.data;

export const startTaskTimer = async (taskId) =>
  (await api.post(`/tasks/${taskId}/time/start`)).data.data;

export const stopTaskTimer = async (taskId, note) =>
  (await api.post(`/tasks/${taskId}/time/stop`, { note })).data.data;

export const TIMER_CHANGED_EVENT = 'timer-changed';

export const getActiveTimer = async () =>
  (await api.get('/tasks/time/active')).data.data; 