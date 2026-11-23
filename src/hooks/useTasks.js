import { useState, useEffect, useCallback } from 'react';
import taskApi from '../api/taskApi';

const getErrMsg = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

export const useTasks = (initialFilters = {}, autoFetch = true) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await taskApi.getTasks(filters || {});
      setTasks(data);
      return data;
    } catch (err) {
      setError(getErrMsg(err, 'Failed to fetch tasks'));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const serializedFilters = JSON.stringify(initialFilters);

  useEffect(() => {
    let isMounted = true;
    if (autoFetch) {
      const parsedFilters = serializedFilters ? JSON.parse(serializedFilters) : {};
      taskApi
        .getTasks(parsedFilters)
        .then((data) => {
          if (isMounted) {
            setTasks(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(getErrMsg(err, 'Failed to fetch tasks'));
            setLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [autoFetch, serializedFilters]);

  const assignTask = useCallback(async (taskData) => {
    setError(null);
    try {
      const created = await taskApi.createTask(taskData);
      setTasks((prev) => [created, ...prev]);
      return { success: true, data: created };
    } catch (err) {
      const msg = getErrMsg(err, 'Failed to assign task');
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const updateTask = useCallback(async (id, updates) => {
    setError(null);
    try {
      const updated = await taskApi.updateTask(id, updates);
      setTasks((prev) => prev.map((t) => (t.id === Number(id) ? updated : t)));
      return { success: true, data: updated };
    } catch (err) {
      const msg = getErrMsg(err, 'Failed to update task');
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const updateTaskStatus = useCallback(async (id, status) => {
    setError(null);
    try {
      const updated = await taskApi.updateTaskStatus(id, status);
      setTasks((prev) => prev.map((t) => (t.id === Number(id) ? updated : t)));
      return { success: true, data: updated };
    } catch (err) {
      const msg = getErrMsg(err, 'Failed to update task status');
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const submitTask = useCallback(async (id, submissionData) => {
    setError(null);
    try {
      const updated = await taskApi.submitTask(id, submissionData);
      setTasks((prev) => prev.map((t) => (t.id === Number(id) ? updated : t)));
      return { success: true, data: updated };
    } catch (err) {
      const msg = getErrMsg(err, 'Failed to submit task');
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const evaluateTask = useCallback(async (id, evalData) => {
    setError(null);
    try {
      const updated = await taskApi.evaluateTask(id, evalData);
      setTasks((prev) => prev.map((t) => (t.id === Number(id) ? updated : t)));
      return { success: true, data: updated };
    } catch (err) {
      const msg = getErrMsg(err, 'Failed to evaluate task');
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  // const deleteTask = useCallback(async (id) => {
  //   setError(null);
  //   try {
  //     await taskApi.deleteTask(id);
  //     setTasks((prev) => prev.filter((t) => t.id !== Number(id)));
  //     return { success: true };
  //   } catch (err) {
  //     const msg = getErrMsg(err, 'Failed to delete task');
  //     setError(msg);
  //     return { success: false, error: msg };
  //   }
  // }, []);

  const removeTasksByMenteeId = useCallback((menteeId) => {
    setTasks((prev) => prev.filter((t) => t.mentee_id !== Number(menteeId)));
  }, []);

  return {
    tasks,
    setTasks,
    loading,
    error,
    fetchTasks,
    assignTask,
    updateTask,
    updateTaskStatus,
    submitTask,
    evaluateTask,
    // deleteTask,
    removeTasksByMenteeId,
    refetch: fetchTasks,
  };
};

export default useTasks;
