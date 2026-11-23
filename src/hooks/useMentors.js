import { useState, useEffect, useCallback } from 'react';
import mentorApi from '../api/mentorApi';
import userApi from '../api/userApi';
import { normalizeUser } from './useUsers';

export const useMentors = (mentorName = null, autoFetch = true) => {
  const [mentors, setMentors] = useState([]);
  const [assignedMentees, setAssignedMentees] = useState([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetchMentors = useCallback(async () => {
    // If a mentorName was provided, this is a mentor dashboard; skip fetching mentors
    if (mentorName) return [];
    try {
      const data = await mentorApi.getMentors();
      const normalized = (data || []).map((m, idx) => normalizeUser(m, idx));
      setMentors(normalized);
      return normalized;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch mentors';
      setError(msg);
      return [];
    }
  }, [mentorName]);

  const fetchAssignedMentees = useCallback(async (name) => {
    const targetName = name || mentorName;
    if (!targetName) return [];
    try {
      const data = await mentorApi.getAssignedMentees(targetName);
      const normalized = (data || []).map((m, idx) => normalizeUser(m, idx));
      setAssignedMentees(normalized);
      return normalized;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch mentees';
      setError(msg);
      return [];
    }
  }, [mentorName]);

  const assignMentee = useCallback(async (menteeId, newMentorName) => {
    setError(null);
    try {
      const res = await mentorApi.assignMentee(menteeId, newMentorName);
      if (res?.success) {
        if (mentorName) {
          await fetchAssignedMentees(mentorName);
        }
        return { success: true };
      }
      throw new Error(res?.message || 'Failed to assign mentee');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg);
      return { success: false, error: msg };
    }
  }, [mentorName, fetchAssignedMentees]);

  const deleteMentee = useCallback(async (id) => {
    setError(null);
    try {
      const res = await userApi.deleteUser(id);
      if (res?.success) {
        setAssignedMentees((prev) => prev.filter((m) => m.id !== Number(id)));
        return {
          success: true,
          message: res.message,
          deletedTasksCount: res.deletedTasksCount ?? 0,
        };
      }
      throw new Error(res?.message || 'Failed to delete mentee');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete mentee';
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!autoFetch) return;

    const loadData = async () => {
      try {
        const [mentorsData, menteesData] = await Promise.all([
          mentorName ? Promise.resolve([]) : mentorApi.getMentors(),
          mentorName ? mentorApi.getAssignedMentees(mentorName) : Promise.resolve([]),
        ]);
        if (!isMounted) return;
        if (!mentorName) {
          setMentors((mentorsData || []).map((m, idx) => normalizeUser(m, idx)));
        }
        if (mentorName) {
          setAssignedMentees((menteesData || []).map((m, idx) => normalizeUser(m, idx)));
        }
      } catch (err) {
        if (!isMounted) return;
        const msg = err.response?.data?.message || err.message || 'Failed to fetch mentors';
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [autoFetch, mentorName]);

  return {
    mentors,
    assignedMentees,
    setAssignedMentees,
    loading,
    error,
    fetchMentors,
    fetchAssignedMentees,
    assignMentee,
    deleteMentee,
    refetch: fetchMentors,
  };
};

export default useMentors;