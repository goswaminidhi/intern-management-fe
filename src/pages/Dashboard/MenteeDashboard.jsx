import { useState, useMemo, useRef, useEffect,  useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import NotificationBell from "../../components/NotificationBell";
import { socket } from "../../lib/socket";
import useAuth from "../../hooks/useAuth";
import useTasks from "../../hooks/useTasks";
import {
  submitTaskVersion,
  getTaskSubmissionHistory,
  downloadSubmissionAttachmentApi,
} from "../../api/taskSubmissionApi";
import taskApi from "../../api/taskApi";
import { useActiveTimer } from "../../hooks/useActiveTimer";
import { startTaskTimer, stopTaskTimer, TIMER_CHANGED_EVENT } from "../../api/timeLog";
import TaskTimer from "../../components/TaskTimer";
import { formatDuration, formatHours } from "../../utils/formatDuration";

import SubmissionStatus from "../../components/taskSubmission/SubmissionStatus";


import BlockerConversationModal from "../../components/BlockerConversationModal";
import {
  raiseBlockerApi,
  listBlockersApi,
  getBlockerApi,
  sendBlockerMessageApi,
  resolveBlockerApi,
} from "../../api/blockerApi";
import ChangePasswordModal from "../../components/common/ChangePasswordModal";

// Helper to get 2-letter initials
function getInitials(name = "") {
  const normalized = typeof name === "string" ? name.trim() : "";
  if (!normalized) return "?";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
}
function AssignedBy({ name }) {
  if (!name) return null;
  return (
    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
      Assigned by{" "}
      <span className="font-semibold text-slate-700 dark:text-slate-200">{name}</span>
    </p>
  );
}
const MENTEE_STATUS_OPTIONS = [
  { value: "in-progress", label: "In Progress" },
  { value: "hold", label: "On Hold" },
  {value: 'blocker', label: "Blocker"}
];

const STATUS_LABELS = {
   "in-progress": "In Progress",
  hold: "On Hold",
  completed: "Completed",
  changes_requested: "Changes Requested",
  approved: "Approved",
  submitted: "Submitted",
  "needs-revision": "Needs Revision",
  complete: "Complete",
  blocker: "Blocker"
};

const CATEGORY_LABELS = {
  upskill: "Upskill",
  research: "Research",
  "client-project": "Client Project",
  "inhouse-project": "Inhouse Project",
};

// Shows the due date AND time, e.g. "14 Nov 2026, 6:30 pm"
function formatDueDateTime(val) {
  if (!val) return "-";
  return new Date(val).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Files the mentor attached when assigning the task (PDF / DOC / DOCX).
// Each attachment: { id?, name, size?, type?, url? } — `url` should be a
// (signed) download link from the backend.
function TaskAttachments({ task, compact = false }) {
  const attachments = Array.isArray(task?.attachments) ? task.attachments : [];
  if (attachments.length === 0) return null;

  const handleDownload = async (e, att, i) => {
    e.preventDefault();
    try {
      const attId = att.id ?? i;
      await taskApi.downloadAttachment(task.id, attId, att.name || `attachment-${i + 1}`);
    } catch (err) {
      console.error("Failed to download attachment:", err);
      if (att.url) window.open(att.url, "_blank");
    }
  };

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
        Attachments from mentor ({attachments.length})
      </p>
      <ul className="space-y-1">
        {attachments.map((att, i) => (
          <li key={att.id ?? `${att.name}-${i}`}>
            <button
              type="button"
              onClick={(e) => handleDownload(e, att, i)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 rounded-lg text-xs text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors text-left cursor-pointer"
            >
              <span className="truncate font-medium">📎 {att.name || `Attachment ${i + 1}`}</span>
              <span className="flex-shrink-0 text-[11px] text-slate-400">
                {formatFileSize(att.size)} ↓
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Compact per-task time line with quick Start/Stop, used on assignment cards
function TaskTimeRow({ task, activeTimer, elapsedSeconds, busy, onStart, onStop }) {
  const isFinished = task.status === "submitted" || task.status === "complete";
  const runningHere = !isFinished && activeTimer?.log.task_id === task.id;
  const trackable = task.status === "in-progress" || task.status === "needs-revision";
  // actual_seconds only counts closed sessions, so add the running one
  const seconds = (task.actual_seconds || 0) + (runningHere ? elapsedSeconds : 0);
  const hasEstimate = Number(task.estimated_hours) > 0;
  const over = hasEstimate && seconds > task.estimated_hours * 3600;

  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-300">
      <span className="min-w-0">
        Time:{" "}
        <span
          className={`font-semibold ${
            over ? "text-rose-600 dark:text-rose-300" : "text-slate-700 dark:text-slate-100"
          }`}
        >
          {formatHours(seconds)}h
        </span>
        {hasEstimate && <> / {task.estimated_hours}h</>}
        {runningHere && (
          <span className="ml-2 inline-flex items-center gap-1 text-rose-600 dark:text-rose-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {formatDuration(elapsedSeconds)}
          </span>
        )}
      </span>

      {trackable &&
        (runningHere ? (
          <button
            disabled={busy}
            onClick={() => onStop(task.id)}
            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold cursor-pointer flex-shrink-0"
          >
            Stop
          </button>
        ) : (
          <button
            disabled={busy || !!activeTimer}
            title={activeTimer ? "Stop your running timer first" : "Start timer"}
            onClick={() => onStart(task)}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold cursor-pointer flex-shrink-0"
          >
            Start
          </button>
        ))}
    </div>
  );
}

const MenteeDashboard = () => {
  const navigate = useNavigate();
  const mainRef = useRef(null);

  // Current logged in mentee details from AuthContext
  const { user: authUser, loading: authLoading, logout } = useAuth();
  const menteeUser = useMemo(() => {
    const rawTrack = typeof authUser?.track === "string" ? authUser.track.trim() : "";
    return {
      id: authUser?.id || null,
      name: authUser?.name || "Mentee",
      email: authUser?.email || "",
      role: authUser?.role || "mentee",
      status: authUser?.status || "active",
      track: rawTrack,
      mentor:
        authUser?.assigned_to ||
        (typeof authUser?.mentor === "object" ? authUser.mentor?.name : authUser?.mentor) ||
        "Unassigned",
      mentorEmail: authUser?.mentorEmail || "",
      attendance: authUser?.attendance || "100%",
    };
  }, [authUser]);

  const {
    tasks: allTasks,
    loading: tasksLoading,
    error: tasksError,
    updateTaskStatus,
    refetch,
  } = useTasks();


  useEffect(() => {
    if (!refetch) return;
    const onNewNotification = () => refetch();
    socket.on("notification:new", onNewNotification);
    return () => socket.off("notification:new", onNewNotification);
  }, [refetch]);

  // One shared request + ticking clock for the running timer (navbar pill, focus task, cards)
  const { active: activeTimer, elapsedSeconds } = useActiveTimer(true);
  const [timerBusy, setTimerBusy] = useState(false);

  // Refresh tasks whenever a timer starts or stops (updates actual_seconds and status)
  useEffect(() => {
    if (!refetch) return;
    const onTimerChanged = () => refetch();
    window.addEventListener(TIMER_CHANGED_EVENT, onTimerChanged);
    return () => window.removeEventListener(TIMER_CHANGED_EVENT, onTimerChanged);
  }, [refetch]);

  // Filter tasks strictly for this logged-in mentee from the database
  const tasks = useMemo(() => {
    return allTasks.filter(
      (t) =>
        (menteeUser.id && (t.mentee_id === menteeUser.id || t.mentee?.id === menteeUser.id)) ||
        (menteeUser.email && t.mentee?.email?.toLowerCase() === menteeUser.email.toLowerCase())
    );
  }, [allTasks, menteeUser]);

  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [submitError, setSubmitError] = useState("");

  // State: "dashboard", "assignments", "feedback"
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState("All");

    // ---- Notification -> highlight task ----
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [highlightKey, setHighlightKey] = useState(0); // lets the same task re-trigger
  const highlightTimerRef = useRef(null);

  const highlightTask = (taskId) => {
    const id = Number(taskId);
    if (!id) return;

    setActiveTab("assignments");
    setTaskFilter("All");
    setHighlightedTaskId(id);
    setHighlightKey((k) => k + 1);

    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedTaskId(null), 2500);
  };

  // Scroll after the tab has rendered
  useEffect(() => {
    if (!highlightedTaskId) return;
    const t = setTimeout(() => {
      document
        .getElementById(`task-${highlightedTaskId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(t);
  }, [highlightedTaskId, highlightKey]);

  useEffect(() => () => clearTimeout(highlightTimerRef.current), []);

  // Dropdown & Modals
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(null);
  const [viewingFeedbackTask, setViewingFeedbackTask] = useState(null);

  const [submissionHistories, setSubmissionHistories] = useState({});
  const [historyLoading, setHistoryLoading] = useState({});
  const [expandedHistory, setExpandedHistory] = useState(null);

  const [blockerTask, setBlockerTask] = useState(null);
  const [blockerMessage, setBlockerMessage] = useState("");
  const [blockerLoading, setBlockerLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [showConversationModal, setShowConversationModal] = useState(false);

    // ---- Blocker conversation state ----
  const [menteeBlockers, setMenteeBlockers] = useState([]); // list of my blocker conversations
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [resolving, setResolving] = useState(false);
  const openConversationIdRef = useRef(null);

  // Load my blocker conversations (used to show the "Blocker Chat" button per task)
  const loadBlockers = useCallback(async () => {
    try {
      const res = await listBlockersApi();
      setMenteeBlockers(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load blockers:", err);
    }
  }, []);

  // Load one conversation with all its messages
  const reloadConversation = useCallback(async (conversationId) => {
    try {
      const res = await getBlockerApi(conversationId);
      setConversation(res.data);
      setConversationError("");
    } catch (err) {
      setConversationError(
        err.response?.data?.message || err.message || "Failed to load conversation"
      );
    }
  }, []);

  useEffect(() => {
    loadBlockers();
  }, [loadBlockers]);

  // Remember which conversation is open so socket events can refresh it
  useEffect(() => {
    openConversationIdRef.current = showConversationModal ? conversation?.id ?? null : null;
  }, [conversation, showConversationModal]);

  // Live updates: a mentor reply arrives as a BLOCKER_* notification
  useEffect(() => {
    const onBlockerNotification = (n) => {
      if (!String(n?.type || "").startsWith("BLOCKER_")) return;
      loadBlockers();
      const openId = openConversationIdRef.current;
      if (openId && Number(n?.data?.conversationId) === Number(openId)) {
        reloadConversation(openId);
      }
    };
    socket.on("notification:new", onBlockerNotification);
    return () => socket.off("notification:new", onBlockerNotification);
  }, [loadBlockers, reloadConversation]);

  // Latest conversation per task (list is already newest-first)
  const blockerByTask = useMemo(() => {
    const map = {};
    for (const b of menteeBlockers) {
      if (!map[b.taskId]) map[b.taskId] = b;
    }
    return map;
  }, [menteeBlockers]);

  // Submission Form State (matches backend PATCH /api/tasks/:id/submit)
  const [submissionForm, setSubmissionForm] = useState({
    submission_url: "",
    demo_url: "",
    submission_notes: "",
  });
  const [submissionFile, setSubmissionFile] = useState(null);



  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const notifyTimerChanged = () => window.dispatchEvent(new Event(TIMER_CHANGED_EVENT));

  const handleQuickStart = async (task) => {
    setTimerBusy(true);
    try {
      await startTaskTimer(task.id);
      notifyTimerChanged();
    } catch (e) {
      showToast("error", e?.response?.data?.message || "Could not start the timer");
    } finally {
      setTimerBusy(false);
    }
  };

  const handleQuickStop = async (taskId) => {
    setTimerBusy(true);
    try {
      await stopTaskTimer(taskId);
      notifyTimerChanged();
    } catch (e) {
      showToast("error", e?.response?.data?.message || "Could not stop the timer");
    } finally {
      setTimerBusy(false);
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilter === "All") return true;
      return (t.status || "").toLowerCase() === taskFilter.toLowerCase();
    });
  }, [tasks, taskFilter]);

  // Tasks with mentor feedback or evaluations
  const feedbackTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        Boolean(t.feedback) ||
        t.status === "complete" ||
        t.status === "submitted" ||
        t.status === "needs-revision"
    );
  }, [tasks]);

  // Evaluated tasks
  const evaluatedTasks = useMemo(
    () => tasks.filter((t) => t.status === "complete" || (t.feedback && t.feedback.trim())),
    [tasks]
  );

  // Overall Progress
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === "complete").length,
    [tasks]
  );
  const progressPercentage =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Total time logged across closed sessions, plus the session running right now
  const totalLoggedSeconds = useMemo(
    () =>
      tasks.reduce((sum, t) => sum + (t.actual_seconds || 0), 0) +
      (activeTimer ? elapsedSeconds : 0),
    [tasks, activeTimer, elapsedSeconds]
  );

  // The task with a running timer always takes focus; otherwise fall back to the usual order
  const focusTask = useMemo(() => {
    const runningTask = activeTimer
      ? tasks.find((t) => t.id === activeTimer.log.task_id && t.status !== "submitted" && t.status !== "complete")
      : null;
    return (
      runningTask ||
      tasks.find((t) => t.status === "in-progress" || t.status === "needs-revision") ||
      tasks.find((t) => t.status === "submitted") ||
      tasks[0] ||
      null
    );
  }, [tasks, activeTimer]);

  const recentEvaluatedTask = useMemo(() => {
    return tasks.find((t) => Boolean(t.feedback) || t.status === "complete") || null;
  }, [tasks]);

  const handleLogout = async () => {
    if (activeTimer?.log?.task_id) {
      try {
        await stopTaskTimer(activeTimer.log.task_id);
      } catch (err) {
        console.warn("Could not stop active timer before logout:", err);
      }
    }
    logout();
    navigate("/");
  };

  const openSubmitModal = (task) => {
    if (!task) return;
    setSubmitError("");
    setSubmittingTask(task);
    setSubmissionForm({
      submission_url: task.submission_url || "",
      demo_url: task.demo_url || "",
      submission_notes: task.submission_notes || "",
    });
  };


    const handleOpenTaskFromNotification = (taskId, notificationItem) => {
    highlightTask(taskId || notificationItem?.data?.taskId);
  };

  // Status update handler: Mentee can only set in-progress or hold.
  // Submitted, complete, and needs-revision tasks are locked.
  const handleStatusChange = async (taskId, nextStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === "submitted" || 
        task.status === "complete" || 
        task.status === "needs-revision") {
      showToast("error", "Task is locked. You cannot change the status of a submitted or evaluated task.");
      return;
    } 

        // A task that is already a blocker can only leave that state via "Mark as Resolved"
    if (task.status === "blocker") {
      showToast("error", "Use “Mark as Resolved” in the blocker chat to unblock this task.");
      if (blockerByTask[task.id]) handleOpenConversation(task);
      return;
    }

    // Open blocker popup instead of directly updating status
    if (nextStatus === "blocker") {
      setBlockerTask(task);
      setBlockerMessage("");
      return;
    }

    if (nextStatus !== "in-progress" && nextStatus !== "hold") {
      showToast("error", "You can only set status to In Progress or On Hold.");
      return;
    }
    const res = await updateTaskStatus(taskId, nextStatus);
    if (res.success) {
      showToast("success", `Task status updated to ${STATUS_LABELS[nextStatus] || nextStatus}`);
      notifyTimerChanged(); // backend closes any running timer on hold
    } else {
      showToast("error", res.error || "Failed to update task status");
    }
  };

  


    // Submit task handler - creates a new submission version
      
  const handleSubmitTask = async (e) => {
    e.preventDefault();

    if (!submittingTask) return;

    const taskId = submittingTask.id;

    setSubmitError("");
    setActionLoading(true);

    try {
      const notes = submissionForm.submission_notes.trim();
      const url = submissionForm.submission_url.trim();
      const demo = submissionForm.demo_url ? submissionForm.demo_url.trim() : "";

      // Validate submission
      if (!notes) {
        throw new Error("Please enter your comments / submission notes.");
      }

      if (!url && !submissionFile) {
        throw new Error("Please provide a submission URL or attach a deliverable file.");
      }

      let payload;
      if (submissionFile) {
        payload = new FormData();
        payload.append("submissionText", notes);
        if (url) payload.append("submissionUrl", url);
        if (demo) payload.append("demoUrl", demo);
        payload.append("attachment", submissionFile);
      } else {
        payload = {
          submissionText: notes,
          submissionUrl: url || null,
          demoUrl: demo || null,
        };
      }

      const res = await submitTaskVersion(taskId, payload);

      if (res.success === false) {
        throw new Error(res.message || res.error || "Submission failed");
      }

    // Close modal and reset form
    setSubmittingTask(null);
    setSubmissionFile(null);

    setSubmissionForm({
      submission_url: "",
      demo_url: "",
      submission_notes: "",
    });

    // Refresh task status and submission history
      notifyTimerChanged(); // backend closes any running timer on submit
      await refetch();
      await fetchSubmissionHistory(taskId);

      showToast(
        "success",
        "Task resubmitted successfully! Your mentor has been notified."
      );

    } catch (error) {
      console.error("Submission error:", error);

      setSubmitError(
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to submit task"
      );
    } finally {
      setActionLoading(false);
    }
  };


  const fetchSubmissionHistory = async (taskId) => {
  try {
    setHistoryLoading((prev) => ({
      ...prev,
      [taskId]: true,
    }));

    const result = await getTaskSubmissionHistory(taskId);

    setSubmissionHistories((prev) => ({
      ...prev,
      [taskId]: result.submissions || [],
    }));
  } catch (error) {
    console.error("Failed to fetch submission history:", error);
    showToast("error", "Unable to load submission history");
  } finally {
    setHistoryLoading((prev) => ({
      ...prev,
      [taskId]: false,
    }));
  }
};
    
  // Open a conversation by its id (used by buttons AND notifications)
  const handleOpenConversationById = async (conversationId) => {
    if (!conversationId) return;
    setConversation(null);
    setConversationError("");
    setChatInput("");
    setShowConversationModal(true);
    setConversationLoading(true);
    await reloadConversation(conversationId);
    setConversationLoading(false);
  };

  // Open the latest conversation of a task
  const handleOpenConversation = (task) => {
    const existing = blockerByTask[task?.id];
    if (!existing) {
      showToast("error", "No blocker conversation found for this task.");
      return;
    }
    handleOpenConversationById(existing.id);
  };

  const closeConversationModal = () => {
    setShowConversationModal(false);
    setConversation(null);
    setChatInput("");
    setConversationError("");
  };

  // Raise a blocker: creates conversation + first message + sets task to "blocker"
  const handleRaiseBlocker = async (e) => {
    e.preventDefault();
    if (!blockerTask || !blockerMessage.trim()) return;

    setBlockerLoading(true);
    try {
      const res = await raiseBlockerApi(blockerTask.id, blockerMessage.trim());
      if (res.success === false) throw new Error(res.message || "Failed to raise blocker");

      const newConversationId = res.data?.conversation?.id;

      setBlockerTask(null);
      setBlockerMessage("");
      showToast("success", "Blocker raised. Your mentor has been notified.");

      notifyTimerChanged(); // backend/other flows may close a running timer
      await Promise.all([refetch(), loadBlockers()]);

      if (newConversationId) handleOpenConversationById(newConversationId);
    } catch (error) {
      console.error("Error raising blocker:", error);
      showToast(
        "error",
        error.response?.data?.message || error.message || "Could not raise the blocker"
      );
    } finally {
      setBlockerLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault?.();
    const text = chatInput.trim();
    if (!conversation || !text || sendingMessage) return;

    setSendingMessage(true);
    try {
      const res = await sendBlockerMessageApi(conversation.id, text);
      if (res.success === false) throw new Error(res.message || "Failed to send message");
      setChatInput("");
      await reloadConversation(conversation.id);
    } catch (error) {
      setConversationError(
        error.response?.data?.message || error.message || "Failed to send message"
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const handleResolveBlocker = async () => {
    if (!conversation || resolving) return;
    if (!window.confirm("Mark this blocker as resolved? The task will go back to In Progress.")) {
      return;
    }

    setResolving(true);
    try {
      const res = await resolveBlockerApi(conversation.id);
      if (res.success === false) throw new Error(res.message || "Failed to resolve blocker");

      showToast("success", "Blocker resolved. Task is back In Progress.");
      await Promise.all([refetch(), loadBlockers(), reloadConversation(conversation.id)]);
    } catch (error) {
      setConversationError(
        error.response?.data?.message || error.message || "Failed to resolve blocker"
      );
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Viewport pinned / Drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-full bg-[#111827] flex-shrink-0 flex flex-col justify-between border-r border-slate-800 select-none transition-transform duration-300 ease-in-out lg:static lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className="p-6 pb-6 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/30 flex items-center justify-center text-white">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2zm0 8.7L3.75 7 12 3.3 20.25 7 12 10.7zM4 10.5v6.2L12 21l8-4.3v-6.2l-8 4.3-8-4.3z" />
                </svg>
              </div>
              <div>
                <span className="text-lg font-bold text-white tracking-wide">
                  TMS Mentee
                </span>
                <span className="block text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">
                  Intern Portal
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1 overflow-y-auto flex-1">
            <button
              onClick={() => {
                setActiveTab("dashboard");
                setSidebarOpen(false);
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "dashboard"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("assignments");
                setSidebarOpen(false);
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "assignments"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <div className="flex items-center gap-3.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Assignments</span>
              </div>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("feedback");
                setSidebarOpen(false);
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "feedback"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Mentor Feedback</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/chat");
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/60"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Messages</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer - Always Visible */}
        <div className="p-4 border-t border-slate-800 bg-[#111827] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-emerald-900/60 text-emerald-200 border border-emerald-700/50 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {getInitials(menteeUser.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{menteeUser.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{menteeUser.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 h-screen overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Top Navbar */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="hidden sm:inline text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Workspace</span>
              <span className="hidden sm:inline text-xs text-slate-300 dark:text-slate-600">/</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate">Intern Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 relative flex-shrink-0">
            {/* Running timer pill: visible from every tab */}
            {activeTimer && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("dashboard");
                  mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }}
                title="Timer running. Click to open your focus task"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="max-w-[70px] sm:max-w-[140px] truncate">{activeTimer.log.task?.title ?? "Task"}</span>
                <span className="font-mono">{formatDuration(elapsedSeconds)}</span>
              </button>
            )}

            {/* Dark Mode Toggle Button */}
            <ThemeToggle />

            {/* NEW: Notification bell */}
            <NotificationBell role="mentee" onOpenTask={handleOpenTaskFromNotification} />

            {/* Messages Button */}
            <button
              type="button"
              onClick={() => navigate("/chat")}
              title="Messages"
              aria-label="Messages"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
            >
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Messages</span>
            </button>

            {/* Quick Submit Button */}
            <button
              onClick={() => openSubmitModal(focusTask)}
              disabled={!focusTask || focusTask.status === "submitted" || focusTask.status === "complete"}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="hidden sm:inline">
                {focusTask?.status === "needs-revision"
                  ? "Re-submit Task"
                  : focusTask?.status === "submitted"
                  ? "Under Review"
                  : focusTask?.status === "complete"
                  ? "Completed"
                  : "Submit Task"}
              </span>
            </button>

            {/* Profile Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(menteeUser.name)}
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline">
                  {authLoading && !authUser ? "Loading..." : menteeUser.name}
                </span>
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {authLoading && !authUser ? "Loading profile..." : menteeUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {menteeUser.email || (authLoading ? "Fetching account..." : "No email")}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 capitalize">
                      Intern &bull; {menteeUser.track ? menteeUser.track.split("(")[0].trim() : menteeUser.status}
                    </span>
                  </div>
<div className="border-t border-slate-100 dark:border-slate-700 pt-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowChangePassword(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Change Password</span>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`mb-5 p-3.5 rounded-xl text-sm flex items-center justify-between shadow-xs animate-fadeIn border ${
              notification.type === "error"
                ? "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {notification.type === "error" ? (
                <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="hover:opacity-75 text-lg font-bold cursor-pointer leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {tasksError && (
          <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{tasksError}</span>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {tasksLoading && (
          <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="font-medium">Loading your assignments and feedback...</span>
          </div>
        )}

        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Internship Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track your sprint milestones, submit deliverables, and view mentor evaluation feedback.
          </p>
        </div>

        {/* Top Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Overall Progress */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall Progress</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{progressPercentage}%</h2>
            </div>
          </div>

          {/* Tasks Completed */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tasks Finished</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {completedCount} / {tasks.length}
              </h2>
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Encouraging Welcome Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white mb-2">
                  Intern Workspace &bull; {tasks.length} Assigned {tasks.length === 1 ? "Task" : "Tasks"}
                </span>
                <h3 className="text-xl font-bold">Welcome back, {menteeUser.name}!</h3>
                <p className="text-emerald-100 text-sm mt-1 max-w-xl">
                  {menteeUser.mentor && menteeUser.mentor !== "Unassigned" ? (
                    <>
                      Supervised by <span className="font-bold underline">{menteeUser.mentor}</span>. You have completed{" "}
                      <span className="font-bold">{completedCount}</span> of {tasks.length} assigned tasks.
                    </>
                  ) : (
                    <>
                      You have completed <span className="font-bold">{completedCount}</span> of {tasks.length} assigned tasks.
                    </>
                  )}
                </p>
              </div>
              <div>
                <button
                  disabled={!focusTask || focusTask.status === "submitted" || focusTask.status === "complete"}
                  onClick={() => openSubmitModal(focusTask)}
                  className="bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold px-4 py-2 rounded-lg text-sm shadow-sm transition-colors cursor-pointer"
                >
                  {focusTask?.status === "submitted"
                    ? "Under Review"
                    : focusTask?.status === "complete"
                    ? "Completed"
                    : focusTask?.status === "needs-revision"
                    ? "Re-submit Task"
                    : "Submit Current Task"}
                </button>
              </div>
            </div>

            {/* Two Column Grid: Current In-Focus Task & Mentor Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left 2 Cols: Active Task in Focus */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Current Focus Assignment
                    </span>
                    {focusTask && (
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30">
                        Due: {formatDueDateTime(focusTask.due_date)}
                      </span>
                    )}
                  </div>

                  {focusTask ? (
                    <>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {focusTask.title}
                     </h3>
                        <AssignedBy
                          name={
                            focusTask.assigner?.name ||
                            (menteeUser.mentor !== "Unassigned" ? menteeUser.mentor : "")
                          }
                        />
                      {focusTask.description?.trim() ? (
                        <p className="text-slate-600 dark:text-slate-300 text-xs mt-2 leading-relaxed whitespace-pre-line">
                          {focusTask.description}
                        </p>
                      ) : (
                        !focusTask.attachments?.length && (
                          <p className="text-slate-400 text-xs mt-2 italic">No description provided.</p>
                        )
                      )}
                      <TaskAttachments task={focusTask} />

                      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">Status:</span>
                          {focusTask.status === "submitted" || focusTask.status === "complete" || focusTask.status === "needs-revision" ? (
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                                focusTask.status === "complete"
                                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                  : focusTask.status === "submitted"
                                  ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                                  : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                              }`}
                            >
                              {STATUS_LABELS[focusTask.status] || focusTask.status}
                            </span>
                          ) : (
                            <select
                              aria-label={`Change status for ${focusTask.title}`}
                              value={focusTask.status}
                              onChange={(e) => handleStatusChange(focusTask.id, e.target.value)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                              {MENTEE_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {focusTask.status === "complete" ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            Completed & Evaluated
                          </span>
                        ) : focusTask.status === "submitted" ? (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                            Under Review
                          </span>
                        ) : focusTask.status === "needs-revision" ? (
                          <button
                            onClick={() => openSubmitModal(focusTask)}
                            className="text-xs font-bold text-rose-600 dark:text-rose-300 hover:underline cursor-pointer"
                          >
                            Re-submit Work &rarr;
                          </button>
                        ) : (
                          <button
                            onClick={() => openSubmitModal(focusTask)}
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:underline cursor-pointer"
                          >
                            Submit Work &rarr;
                          </button>
                        )}
                      </div>

                      <div className="mt-4">
                        <TaskTimer
                          key={`${focusTask.id}-${focusTask.status}`}
                          taskId={focusTask.id}
                          estimatedHours={focusTask.estimated_hours}
                          taskStatus={focusTask.status}
                          canTrack={focusTask.status === "in-progress" || focusTask.status === "needs-revision"}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      No tasks assigned yet. Check back once your mentor assigns your first task.
                    </div>
                  )}
                </div>

                {/* Recent Completed Work with Mentor Feedback */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                    Recent Evaluation & Feedback
                  </h3>
                  {recentEvaluatedTask ? (
                    <div className="border border-slate-100 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {recentEvaluatedTask.title}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          {STATUS_LABELS[recentEvaluatedTask.status] || recentEvaluatedTask.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-200 mt-2 italic leading-relaxed">
                        &ldquo;{recentEvaluatedTask.feedback || "No feedback notes provided yet."}&rdquo;
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-300 mt-2 text-right">
                        &bull; Evaluated by {recentEvaluatedTask.evaluator?.name || recentEvaluatedTask.assigner?.name || menteeUser.mentor}
                      </p>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                      No evaluated tasks yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Col: Mentor Card & Track Info */}
              <div className="space-y-6">
                {/* Mentor Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-3">
                    Your Assigned Mentor
                  </span>
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 flex items-center justify-center font-bold text-base shadow-xs">
                      {getInitials(menteeUser.mentor)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{menteeUser.mentor}</h4>
                      {menteeUser.mentorEmail && (
                        <p className="text-xs text-slate-500 dark:text-slate-300">{menteeUser.mentorEmail}</p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 px-2 py-0.5 rounded">
                        Assigned Mentor
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Pending Submissions:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {tasks.filter((t) => t.status === "in-progress" || t.status === "needs-revision").length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Total Tasks Evaluated:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {evaluatedTasks.length} Evaluated
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Total Time Logged:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {formatHours(totalLoggedSeconds)}h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY ASSIGNMENTS */}
        {activeTab === "assignments" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">My Tasks & Assignments</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete technical milestones and submit code repositories for review.
                </p>
              </div>

              <div className="flex flex-wrap bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-medium">
                {["All", "in-progress", "submitted", "needs-revision", "complete", "hold", "blocker"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${taskFilter === filter
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    {filter === "All" ? "All" : STATUS_LABELS[filter] || filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks Grid */}
           <div className="p-6 flex flex-col gap-5">
              {filteredTasks.map((task) => (
                // <div
                //   key={task.id}
                //   className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:shadow-md transition-shadow flex flex-col justify-between"
                // >
                                <div
                  key={task.id}
                  id={`task-${task.id}`}
                  className={`p-5 rounded-xl border flex flex-col justify-between transition-all duration-500 ${
                    highlightedTaskId === task.id
                      ? "ring-1 ring-blue-700 border-blue-400  shadow-lg"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:shadow-md"
                  }`}
                >
                  {/* Submission History */}
                  <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3">

                    <button
                      onClick={() => {
                        const isOpen = expandedHistory === task.id;

                        setExpandedHistory(isOpen ? null : task.id);

                        if (!isOpen && !submissionHistories[task.id]) {
                          fetchSubmissionHistory(task.id);
                        }
                      }}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
                    >
                      {expandedHistory === task.id
                        ? "Hide Submission History ↑"
                        : "View Submission History ↓"}
                    </button>

                    {expandedHistory === task.id && (
                      <div className="mt-3 space-y-3">

                        {historyLoading[task.id] ? (
                          <p className="text-xs text-slate-500">
                            Loading submission history...
                          </p>
                        ) : submissionHistories[task.id]?.length > 0 ? (

                          submissionHistories[task.id].map((submission) => {
                            const subUrl = submission.submissionUrl || submission.submission_url || (submission.attachmentUrl && !submission.attachmentUrl.includes("ik.imagekit.io") ? submission.attachmentUrl : null);
                            const demoUrl = submission.demoUrl || submission.demo_url;
                            const attachUrl = (submission.attachmentUrl && submission.attachmentUrl.includes("ik.imagekit.io")) ? submission.attachmentUrl : (!subUrl && submission.attachmentUrl ? submission.attachmentUrl : null);
                            const text = submission.submissionText || submission.submission_text;
                            const feedback = submission.mentorFeedback || submission.mentor_feedback;

                            return (
                              <div
                                key={submission.id}
                                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 shadow-2xs space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                                      Submission {submission.version}
                                    </span>
                                    {submission.createdAt && (
                                      <span className="text-[11px] text-slate-400">
                                        • {formatDueDateTime(submission.createdAt)}
                                      </span>
                                    )}
                                  </div>
                                  <SubmissionStatus status={submission.status} />
                                </div>

                                {/* Deliverable URLs and Attached Files */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {subUrl && (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-semibold text-slate-500 shrink-0">Code / Link:</span>
                                      <a
                                        href={subUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline truncate font-mono"
                                      >
                                        {subUrl}
                                      </a>
                                    </div>
                                  )}

                                  {demoUrl && (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-semibold text-slate-500 shrink-0">Live Demo:</span>
                                      <a
                                        href={demoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-emerald-600 dark:text-emerald-400 hover:underline truncate font-mono"
                                      >
                                        {demoUrl}
                                      </a>
                                    </div>
                                  )}

                                  {attachUrl && (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-semibold text-slate-500 shrink-0">Attachment:</span>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await downloadSubmissionAttachmentApi(submission.id, `submission-v${submission.version || 1}-attachment`);
                                          } catch (err) {
                                            console.error("Failed to download attachment:", err);
                                            window.open(attachUrl, "_blank");
                                          }
                                        }}
                                        className="text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 font-medium truncate cursor-pointer bg-transparent border-none p-0 text-left"
                                      >
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        <span>Download Attachment</span>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {text && (
                                  <div className="text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                                    <span className="font-semibold text-slate-500 block mb-0.5">Your Comments:</span>
                                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/40 p-2 rounded border border-slate-100 dark:border-slate-800">
                                      {text}
                                    </p>
                                  </div>
                                )}

                                {feedback && (
                                  <div className="mt-2 p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                      Mentor Feedback
                                    </p>
                                    <p className="text-xs mt-1 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                      {feedback}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })

                        ) : (
                          <p className="text-xs text-slate-500">
                            No submission history available.
                          </p>
                        )}

                      </div>
                    )}

                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 px-2 py-0.5 rounded">
                        {CATEGORY_LABELS[task.category] || task.category}
                      </span>
                      {task.status === "submitted" || task.status === "complete" || task.status === "needs-revision" ? (
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            task.status === "complete"
                              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                              : task.status === "submitted"
                              ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                              : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                          }`}
                        >
                          {STATUS_LABELS[task.status] || task.status}
                        </span>
                      ) : (
                        <select
                          aria-label={`Change status for ${task.title}`}
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border cursor-pointer focus:outline-none ${
                            task.status === "hold"
                              ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600"
                              : "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                          }`}
                        >
                          {MENTEE_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-3">{task.title}</h3>
                    <AssignedBy
                        name={
                          task.assigner?.name ||
                          (menteeUser.mentor !== "Unassigned" ? menteeUser.mentor : "")
                        }
                      />
                    {task.description?.trim() ? (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    ) : (
                      !task.attachments?.length && (
                        <p className="text-xs text-slate-400 mt-1 italic">No description provided.</p>
                      )
                    )}
                    <TaskAttachments task={task} compact />

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                      <span>Due: {formatDueDateTime(task.due_date)}</span>
                      <span className="font-bold uppercase text-[11px] text-slate-700 dark:text-slate-100">
                        Priority: {task.priority}
                      </span>
                    </div>

                    <TaskTimeRow
                      task={task}
                      activeTimer={activeTimer}
                      elapsedSeconds={elapsedSeconds}
                      busy={timerBusy}
                      onStart={handleQuickStart}
                      onStop={handleQuickStop}
                    />
                   {blockerByTask[task.id] && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => handleOpenConversation(task)}
                      className={`w-full py-1.5 rounded text-xs font-semibold border cursor-pointer ${
                        blockerByTask[task.id].status === "open"
                          ? "border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100"
                          : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      {blockerByTask[task.id].status === "open"
                        ? "Open Blocker Chat"
                        : "View Blocker History"}
                    </button>
                  </div>
                )}

                    {task.submission_url && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <a
                          href={task.submission_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-300 hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                          </svg>
                          <span>Submitted Link</span>
                        </a>
                        {task.demo_url && (
                          <a
                            href={task.demo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 dark:text-indigo-300 hover:underline font-mono text-[11px]"
                          >
                            Live Demo
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                    {task.status === "complete" ? (
                      <button
                        onClick={() => setViewingFeedbackTask(task)}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        View Mentor Notes &rarr;
                      </button>
                    ) : task.status === "submitted" ? (
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                          Under Review
                        </span>
                        {task.feedback && (
                          <button
                            onClick={() => setViewingFeedbackTask(task)}
                            className="text-xs font-semibold text-amber-600 dark:text-amber-300 hover:underline cursor-pointer"
                          >
                            View Notes
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {task.feedback && (
                          <button
                            onClick={() => setViewingFeedbackTask(task)}
                            className="text-xs font-semibold text-amber-600 dark:text-amber-300 hover:underline cursor-pointer flex-shrink-0"
                          >
                            View Notes
                          </button>
                        )}
                        <button
                          onClick={() => openSubmitModal(task)}
                          className={`w-full py-1.5 text-white rounded text-xs font-semibold transition-colors cursor-pointer ${
                            task.status === "needs-revision"
                              ? "bg-rose-600 hover:bg-rose-700"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                        >
                          {task.status === "needs-revision" ? "Re-submit Work" : "Submit Work"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {filteredTasks.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    No tasks found in the database.
                  </p>
                </div>
              )}
              
            </div>
          </div>
        )}

        {/* TAB 3: MENTOR FEEDBACK */}
        {activeTab === "feedback" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mentor Feedback & Reviews</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                    Constructive technical feedback and code review notes provided by {menteeUser.mentor}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {feedbackTasks.length} Reviewed {feedbackTasks.length === 1 ? "Task" : "Tasks"}
                  </div>
                </div>
              </div>

              {/* Feedback Cards */}
              <div className="space-y-4">
                {feedbackTasks.map((task) => {
                  const reviewer = task.evaluator?.name || task.assigner?.name || menteeUser.mentor;
                  return (
                    <div
                      key={task.id}
                      className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                            {CATEGORY_LABELS[task.category] || task.category}
                          </span>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                            {task.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                            {STATUS_LABELS[task.status] || task.status}
                          </span>
                        </div>
                      </div>

                      {/* Mentor Feedback Quote */}
                      <div className="mt-4 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                            {getInitials(reviewer)}
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {reviewer} (Mentor)
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-400">&bull; Review Note</span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-200 italic leading-relaxed">
                          &ldquo;{task.feedback || "No feedback written yet."}&rdquo;
                        </p>
                      </div>

                      {/* Footer Details */}
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 pt-2">
                        <span>Due: {formatDueDateTime(task.due_date)}</span>
                        {task.submission_url && (
                          <a
                            href={task.submission_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 dark:text-emerald-300 hover:underline font-mono text-[11px]"
                          >
                            View Submission &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {feedbackTasks.length === 0 && (
                  <div className="py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      No reviewed assignments or feedback available in the database yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: SUBMIT ASSIGNMENT */}
      {submittingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full p-5 text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  🚀
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">Submit Deliverable</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-md">{submittingTask.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSubmittingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-xl leading-none cursor-pointer flex-shrink-0"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="mt-3">
              {submitError && (
                <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT COLUMN: Links & Attachment */}
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Submission URL (GitHub / Document)
                    </label>
                    <input
                      type="url"
                      placeholder="https://github.com/username/project-repo"
                      value={submissionForm.submission_url}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, submission_url: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Live Demo URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://my-app.vercel.app"
                      value={submissionForm.demo_url}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, demo_url: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Attach Deliverable File (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="submission-attachment"
                        onChange={(e) => setSubmissionFile(e.target.files[0] || null)}
                        className="block w-full text-xs text-slate-500 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950/40 dark:file:text-emerald-300 cursor-pointer"
                      />
                      {submissionFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmissionFile(null);
                            const el = document.getElementById("submission-attachment");
                            if (el) el.value = "";
                          }}
                          className="text-slate-400 hover:text-rose-500 text-xs px-1 cursor-pointer font-bold"
                          title="Remove file"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                    {submissionFile && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                        📎 {submissionFile.name} ({formatFileSize(submissionFile.size)})
                      </p>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Notes & Mentor Requirements */}
                <div className="space-y-2.5 flex flex-col justify-between">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Comments / Notes for Mentor
                    </label>
                    <textarea
                      rows="4"
                      placeholder="Explain your solution, testing notes, or approach..."
                      value={submissionForm.submission_notes}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, submission_notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 leading-relaxed"
                    />

                    {/* Mentor Attachments Reference */}
                    {Array.isArray(submittingTask.attachments) && submittingTask.attachments.length > 0 && (
                      <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                          Mentor Brief Files ({submittingTask.attachments.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {submittingTask.attachments.map((att, i) => (
                            <button
                              key={att.id ?? i}
                              type="button"
                              onClick={async () => {
                                try {
                                  await taskApi.downloadAttachment(submittingTask.id, att.id ?? i, att.name || `brief-${i + 1}`);
                                } catch (err) {
                                  console.error("Failed to download brief attachment:", err);
                                  if (att.url) window.open(att.url, "_blank");
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 text-[10px] font-medium border border-slate-200 dark:border-slate-700 hover:underline cursor-pointer"
                            >
                              📎 {att.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSubmittingTask(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-2 transition-colors"
                >
                  {actionLoading ? "Submitting..." : "Submit Deliverable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW FEEDBACK */}
      {viewingFeedbackTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentor Evaluation</h3>
              <button
                onClick={() => setViewingFeedbackTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="mt-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">{viewingFeedbackTask.title}</h4>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs uppercase">
                  {STATUS_LABELS[viewingFeedbackTask.status] || viewingFeedbackTask.status}
                </span>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Mentor Review Notes
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                  &ldquo;{viewingFeedbackTask.feedback || "No feedback written yet."}&rdquo;
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewingFeedbackTask(null)}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

          {/* MODAL: RAISE TASK BLOCKER */}
          {blockerTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Raise a Blocker
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Explain what you are stuck on.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBlockerTask(null);
                      setBlockerMessage("");
                    }}
                    className="text-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    &times;
                  </button>

                </div>

                {/* Task Details */}
                <div className="mt-4">

                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {blockerTask.title}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Your mentor {menteeUser.mentor} will receive your message.
                  </p>

                </div>

                {/* Blocker Form */}
                <form
                  onSubmit={handleRaiseBlocker}
                  className="mt-4 space-y-4"
                >

                  <div>

                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Describe your confusion
                    </label>

                    <textarea
                      rows={5}
                      required
                      maxLength={2000}
                      value={blockerMessage}
                      onChange={(e) => setBlockerMessage(e.target.value)}
                      placeholder="Explain the problem you are facing..."
                      className="w-full px-3 py-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />

                    <p className="text-right text-[11px] text-slate-400 mt-1">
                      {blockerMessage.length}/2000
                    </p>

                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2">

                    <button
                      type="button"
                      onClick={() => {
                        setBlockerTask(null);
                        setBlockerMessage("");
                      }}
                      disabled={blockerLoading}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={!blockerMessage.trim() || blockerLoading}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {blockerLoading ? "Sending..." : "Send to Mentor"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        {/* MODAL: BLOCKER CONVERSATION */}
      {showConversationModal && (
        <BlockerConversationModal
          conversation={conversation}
          loading={conversationLoading}
          error={conversationError}
          currentUserId={menteeUser.id}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onSend={handleSendMessage}
          sending={sendingMessage}
          onResolve={handleResolveBlocker}
          resolving={resolving}
          onClose={closeConversationModal}
        />
      )}
      <ChangePasswordModal
                isOpen={showChangePassword}
                onClose={() => setShowChangePassword(false)}
                onSuccess={(message) => {
                  setNotification({ type: "success", message });
                  setTimeout(() => setNotification(null), 3000);
                }}
              />
    </div>
  );
};

export default MenteeDashboard;