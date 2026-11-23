import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import useAuth from "../../hooks/useAuth";
import useUsers from "../../hooks/useUsers";
import taskApi from "../../api/taskApi";
import ConfirmModal from "../../components/common/ConfirmModal";
//import ChangePasswordModal from "../../components/common/ChangePasswordModal"
import HierarchyTree from "../../components/Hierarchy/HierarchyTree";

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

function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mainRef = useRef(null);
  const { user: currentUser, logout } = useAuth();
  const {
    users,
    loading,
    error,
    createUser,
    updateUser,
    assignMentorToMentee,
    deleteUser,
    refetch,
  } = useUsers();

  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTabState] = useState(() => {
    return ["dashboard", "mentors", "mentees", "tasks","hierarchy"].includes(tabFromUrl)
      ? tabFromUrl
      : "dashboard";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setSearchParams(tab === "dashboard" ? {} : { tab });
    setSidebarOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["dashboard", "mentors", "mentees", "tasks","hierarchy"].includes(tab)) {
      setActiveTabState(tab);
    } else if (!tab) {
      setActiveTabState("dashboard");
    }
  }, [searchParams]);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [notification, setNotification] = useState(null);

  // All Tasks State
  const [allTasks, setAllTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("All");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("All");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState("All");
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleteTaskLoading, setDeleteTaskLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const loadAllTasks = useCallback(async () => {
    try {
      setTasksLoading(true);
      const data = await taskApi.getTasks({});
      setAllTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllTasks();
  }, [loadAllTasks]);



  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  // Search & filter states
  const [mentorSearch, setMentorSearch] = useState("");
  const [mentorFilter, setMentorFilter] = useState("All");

  const [menteeSearch, setMenteeSearch] = useState("");
  const [menteeFilter, setMenteeFilter] = useState("All");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRole, setCreateRole] = useState("mentor");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mentor: "",
    status: "Active",
    assignedMentees: [],
  });
  const [menteeDropdownOpen, setMenteeDropdownOpen] = useState(false);
  const [menteeSearchQuery, setMenteeSearchQuery] = useState("");
  const menteeDropdownRef = useRef(null);

  // Close mentee multi-select dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menteeDropdownRef.current &&
        !menteeDropdownRef.current.contains(event.target)
      ) {
        setMenteeDropdownOpen(false);
      }
    }
    if (menteeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menteeDropdownOpen]);

  // Edit & Assign Mentor Modal states
  const [editingUser, setEditingUser] = useState(null);
  const [assigningMentee, setAssigningMentee] = useState(null);
  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Filter mentors & mentees
  const mentors = useMemo(
    () => users.filter((u) => u.role === "mentor"),
    [users]
  );

  const availableMentors = useMemo(
    () => mentors.filter((m) => (m.status || "").toLowerCase() === "active"),
    [mentors]
  );

  const mentees = useMemo(
    () => users.filter((u) => u.role === "mentee"),
    [users]
  );

  const resolveMenteeMentor = (mentee) => {
    if (!mentee) return null;
    if (mentee.mentorId) {
      const byId = mentors.find((m) => m.id === mentee.mentorId);
      if (byId) return byId;
    }
    if (mentee.mentorDetails?.id) {
      return mentee.mentorDetails;
    }
    if (mentee.mentor) {
      return (
        mentors.find(
          (m) => m.name?.toLowerCase() === mentee.mentor.toLowerCase()
        ) || null
      );
    }
    return null;
  };

  const activeMentorsCount = useMemo(
    () => mentors.filter((m) => (m.status || "").toLowerCase() === "active").length,
    [mentors]
  );
  const inactiveMentorsCount = mentors.length - activeMentorsCount;

  const activeMenteesCount = useMemo(
    () => mentees.filter((m) => (m.status || "").toLowerCase() === "active").length,
    [mentees]
  );
  const inactiveMenteesCount = mentees.length - activeMenteesCount;

  const menteesWithMentor = useMemo(
    () => mentees.filter((m) => resolveMenteeMentor(m) !== null),
    [mentees, mentors]
  );
  const menteesWithoutMentor = useMemo(
    () => mentees.filter((m) => resolveMenteeMentor(m) === null),
    [mentees, mentors]
  );

  // Search & Status filters for mentors
  const filteredMentors = useMemo(() => {
    return mentors.filter((m) => {
      const matchesSearch = `${m.name || ""} ${m.email || ""}`
        .toLowerCase()
        .includes(mentorSearch.toLowerCase());
      const matchesFilter =
        mentorFilter === "All" || (m.status || "").toLowerCase() === mentorFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [mentors, mentorSearch, mentorFilter]);

  // Search & Status filters for mentees
  const filteredMentees = useMemo(() => {
    return mentees.filter((m) => {
      const matchesSearch = `${m.name || ""} ${m.email || ""} ${m.mentor || ""}`
        .toLowerCase()
        .includes(menteeSearch.toLowerCase());
      const matchesFilter =
        menteeFilter === "All" || (m.status || "").toLowerCase() === menteeFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [mentees, menteeSearch, menteeFilter]);

  // Search & Category & Priority & Status filters for tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      const q = taskSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (t.title || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.mentee?.name || "").toLowerCase().includes(q) ||
        (t.mentee?.email || "").toLowerCase().includes(q) ||
        (t.assigner?.name || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q);

      const matchesStatus =
        taskStatusFilter === "All" ||
        (t.status || "").toLowerCase() === taskStatusFilter.toLowerCase();

      const matchesPriority =
        taskPriorityFilter === "All" ||
        (t.priority || "").toLowerCase() === taskPriorityFilter.toLowerCase();

      const matchesCategory =
        taskCategoryFilter === "All" ||
        (t.category || "").toLowerCase() === taskCategoryFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
  }, [allTasks, taskSearch, taskStatusFilter, taskPriorityFilter, taskCategoryFilter]);

  const taskStats = useMemo(() => {
    const total = allTasks.length;
    const inProgress = allTasks.filter((t) => t.status === "in-progress").length;
    const submitted = allTasks.filter((t) => t.status === "submitted").length;
    const needsRevision = allTasks.filter((t) => t.status === "needs-revision").length;
    const complete = allTasks.filter((t) => t.status === "complete").length;
    const blocker = allTasks.filter((t) => t.status === "blocker" || t.status === "hold").length;
    return { total, inProgress, submitted, needsRevision, complete, blocker };
  }, [allTasks]);

  // Filtered and sorted mentees inside the assign-mentees dropdown (first unassigned, then assigned)
  const availableMenteesForAssign = useMemo(() => {
    let list = mentees;
    if (menteeSearchQuery.trim()) {
      const q = menteeSearchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aAssigned = Boolean(a.mentor && a.mentor.trim());
      const bAssigned = Boolean(b.mentor && b.mentor.trim());
      if (aAssigned !== bAssigned) {
        return aAssigned ? 1 : -1; // unassigned comes first
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [mentees, menteeSearchQuery]);

  const toggleMenteeSelection = (menteeId) => {
    setFormData((prev) => {
      const current = prev.assignedMentees || [];
      const exists = current.includes(menteeId);
      return {
        ...prev,
        assignedMentees: exists
          ? current.filter((id) => id !== menteeId)
          : [...current, menteeId],
      };
    });
  };

  const removeAssignedMentee = (menteeId) => {
    setFormData((prev) => ({
      ...prev,
      assignedMentees: (prev.assignedMentees || []).filter((id) => id !== menteeId),
    }));
  };

  const selectAllMentees = () => {
    setFormData((prev) => ({
      ...prev,
      assignedMentees: mentees.map((m) => m.id),
    }));
  };

  const clearAllAssignedMentees = () => {
    setFormData((prev) => ({
      ...prev,
      assignedMentees: [],
    }));
  };

  // Handlers
  function openCreate(role) {
    setCreateRole(role);
    setFormData({
      name: "",
      email: "",
      mentor: availableMentors[0]?.name || "",
      status: "Active",
      assignedMentees: [],
    });
    setMenteeDropdownOpen(false);
    setMenteeSearchQuery("");
    setModalError("");
    setShowCreateModal(true);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setModalError("Please provide name and email.");
      return;
    }

    const selectedCreateMentor =
      createRole === "mentee" && formData.mentor
        ? mentors.find(
          (m) => m.name?.toLowerCase() === formData.mentor.trim().toLowerCase()
        ) || null
        : null;

    setModalError("");
    setActionLoading(true);
    const res = await createUser({
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: createRole,
      status: formData.status || "Active",
      ...(createRole === "mentee"
        ? {
          mentor_id: selectedCreateMentor ? selectedCreateMentor.id : null,
          mentor: formData.mentor ? formData.mentor.trim() : null,
        }
        : { mentor: null }),
      assignedMentees: createRole === "mentor" ? (formData.assignedMentees || []) : [],
    });
    setActionLoading(false);

    if (res.success) {
      setShowCreateModal(false);
      setNotification({
        type: "success",
        message:
          res.message ||
          `${createRole === "mentor" ? "Mentor" : "Mentee"} created successfully!`,
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setModalError(res.error || "Failed to create user");
    }
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault();
    if (!editingUser) return;
    const selectedEditMentor =
      editingUser.role === "mentee" && editingUser.mentor
        ? mentors.find(
          (m) => m.name?.toLowerCase() === editingUser.mentor.trim().toLowerCase()
        ) || null
        : null;

    setModalError("");
    setActionLoading(true);
    const res = await updateUser(editingUser.id, {
      name: editingUser.name,
      email: editingUser.email,
      status: editingUser.status,
      role: editingUser.role,
      ...(editingUser.role === "mentee"
        ? {
          mentor_id: selectedEditMentor ? selectedEditMentor.id : null,
          mentor: editingUser.mentor ? editingUser.mentor.trim() : null,
        }
        : { mentor: null }),
    });
    setActionLoading(false);

    if (res.success) {
      setEditingUser(null);
      setNotification({
        type: "success",
        message: "User updated successfully!",
      });
      setTimeout(() => setNotification(null), 3500);
    } else {
      setModalError(res.error || "Failed to update user");
    }
  }

  function openAssignMentorModal(mentee) {
    const currentMentor = resolveMenteeMentor(mentee);
    setAssigningMentee(mentee);
    setSelectedMentorId(currentMentor ? String(currentMentor.id) : "");
    setAssignError("");
  }

  async function handleAssignMentorSubmit(e) {
    e.preventDefault();
    if (!assigningMentee) return;

    if (!selectedMentorId) {
      setAssignError("Please select an available mentor.");
      return;
    }

    setAssignError("");
    setAssignLoading(true);
    const res = await assignMentorToMentee(assigningMentee.id, Number(selectedMentorId));
    setAssignLoading(false);

    if (res.success) {
      const assignedMentor = mentors.find((m) => m.id === Number(selectedMentorId));
      const targetName = assigningMentee.name;
      setAssigningMentee(null);
      setNotification({
        type: "success",
        message:
          res.message ||
          `Mentor ${assignedMentor?.name || ""} assigned to ${targetName} successfully!`,
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setAssignError(res.error || "Failed to assign mentor.");
    }
  }

  async function handleRemoveMentorAssignment() {
    if (!assigningMentee) return;

    setAssignError("");
    setAssignLoading(true);
    const res = await assignMentorToMentee(assigningMentee.id, null);
    setAssignLoading(false);

    if (res.success) {
      const targetName = assigningMentee.name;
      setAssigningMentee(null);
      setNotification({
        type: "success",
        message:
          res.message ||
          `Mentor assignment removed from ${targetName} successfully!`,
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setAssignError(res.error || "Failed to remove mentor assignment.");
    }
  }

  function handleDelete(id, name) {
    const target = users.find((u) => u.id === Number(id));
    setUserToDelete({
      id,
      name,
      isMentee: target?.role === "mentee",
    });
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return;
    setActionLoading(true);
    const res = await deleteUser(userToDelete.id);
    setActionLoading(false);
    const deletedName = userToDelete.name;
    setUserToDelete(null);

    if (res.success) {
      const extra =
        res.deletedTasksCount > 0
          ? ` (${res.deletedTasksCount} task${res.deletedTasksCount > 1 ? "s" : ""} removed)`
          : "";
      setNotification({
        type: "success",
        message: `${deletedName} deleted successfully!${extra}`,
      });
      loadAllTasks();
      setTimeout(() => setNotification(null), 3500);
    } else {
      setNotification({
        type: "error",
        message: res.error || "Failed to delete user",
      });
      setTimeout(() => setNotification(null), 5000);
    }
  }

  async function confirmDeleteTask() {
    if (!taskToDelete) return;
    setDeleteTaskLoading(true);
    try {
      await taskApi.deleteTask(taskToDelete.id);
      setNotification({
        type: "success",
        message: `Task "${taskToDelete.title}" deleted successfully!`,
      });
      setAllTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      if (selectedTaskDetails?.id === taskToDelete.id) {
        setSelectedTaskDetails(null);
      }
      setTaskToDelete(null);
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      setNotification({
        type: "error",
        message: err.response?.data?.message || err.message || "Failed to delete task",
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setDeleteTaskLoading(false);
    }
  }

  // Helpers for formatting tasks
  function formatDate(dateVal) {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  function formatDateTime(dateVal) {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  function getStatusBadge(status) {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "complete":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
          dot: "bg-emerald-500",
          label: "Completed",
        };
      case "submitted":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
          dot: "bg-amber-500 animate-pulse",
          label: "Submitted",
        };
      case "needs-revision":
        return {
          bg: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
          dot: "bg-purple-500",
          label: "Needs Revision",
        };
      case "blocker":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
          dot: "bg-rose-500 animate-ping",
          label: "Blocker",
        };
      case "hold":
        return {
          bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
          dot: "bg-slate-400",
          label: "On Hold",
        };
      case "in-progress":
      default:
        return {
          bg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
          dot: "bg-blue-500 animate-pulse",
          label: "In Progress",
        };
    }
  }

  function getPriorityBadge(priority) {
    const p = (priority || "").toLowerCase();
    switch (p) {
      case "high":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "low":
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
      case "medium":
      default:
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
  }

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive Drawer on Mobile / Fixed on Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-full bg-[#111827] flex-shrink-0 flex flex-col justify-between border-r border-slate-800 select-none transition-transform duration-300 ease-in-out lg:static lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo & Brand */}
          <div className="p-6 pb-6 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center text-white">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white tracking-wide">
                TMS Admin
              </span>
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
          <nav className="px-3 space-y-1 overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none] flex-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "dashboard"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab("mentors")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "mentors"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <div className="flex items-center gap-3.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Mentors</span>
              </div>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                {mentors.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("mentees")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "mentees"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <div className="flex items-center gap-3.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Mentees</span>
              </div>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                {mentees.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("tasks")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "tasks"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <div className="flex items-center gap-3.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span>Tasks</span>
              </div>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                {allTasks.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("hierarchy")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "hierarchy"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5a2 2 0 100 4 2 2 0 000-4zm0 4v3m0 0H6m6 0h6M6 12v3m12-3v3M6 17a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <span>Hierarchy</span>
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

        {/* Sidebar Footer - ALWAYS VISIBLE */}
        <div className="p-4 border-t border-slate-800 bg-[#111827] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {getInitials(currentUser?.name || "Admin")}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentUser?.name || "Administrator"}</p>
              <p className="text-[11px] text-slate-400 truncate">{currentUser?.email || "admin@example.com"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Scrollable with hidden scrollbar */}
      <main ref={mainRef} className="flex-1 h-screen overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none] px-3 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* Top Navbar */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-6 relative">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
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
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider truncate">
                {activeTab === "mentors"
                  ? "Mentors Management"
                  : activeTab === "mentees"
                    ? "Mentees Management"
                    : activeTab === "tasks"
                      ? "All Tasks & Assignments"
                      : activeTab === "hierarchy"
                        ? "Team Hierarchy"
                        : "Admin Portal"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => navigate("/chat")}
              title="Messages"
              aria-label="Messages"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
            >
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Messages</span>
            </button>

            <ThemeToggle />

            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(currentUser?.name || "Admin")}
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {currentUser?.name?.split(" ")[0] || "Admin"}
                </span>
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Menu Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{currentUser?.name || "Administrator"}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentUser?.email || "admin@example.com"}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                      Administrator
                    </span>
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-700 pt-1">

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
            className={`mb-5 p-3.5 rounded-xl text-sm flex items-center justify-between shadow-xs animate-fadeIn border ${notification.type === "error"
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
        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => refetch()} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer">Retry</button>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && users.length === 0 && (
          <div className="mb-5 p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-xl text-sm flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="font-medium">Fetching users from backend...</span>
          </div>
        )}

        {/* ========================================================
            TAB 1: DASHBOARD OVERVIEW PAGE
            ======================================================== */}
        {activeTab === "dashboard" && (
          <div>
            {/* Page Title & Subtitle */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Overview and system statistics for mentors and mentees in the Training Management System.
              </p>
            </div>

            {/* Top Interactive Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              {/* Total Mentors Card */}
              <div
                onClick={() => setActiveTab("mentors")}
                className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                    {activeMentorsCount} Active
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Mentors</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {mentors.length}
                    </h2>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      View All &rarr;
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Mentees Card */}
              <div
                onClick={() => setActiveTab("mentees")}
                className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300">
                    {activeMenteesCount} Active
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Mentees</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {mentees.length}
                    </h2>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      View All &rarr;
                    </span>
                  </div>
                </div>
              </div>

              {/* Mentorship Coverage Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                    {mentees.length > 0 ? Math.round((menteesWithMentor.length / mentees.length) * 100) : 0}% Paired
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mentorship Coverage</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {menteesWithMentor.length}
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      of {mentees.length} assigned
                    </span>
                  </div>
                </div>
              </div>

              {/* Unassigned Mentees Card */}
              <div
                onClick={() => {
                  setMenteeFilter("All");
                  setActiveTab("mentees");
                }}
                className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-600/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${menteesWithoutMentor.length > 0
                      ? "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300"
                      : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300"
                    }`}>
                    {menteesWithoutMentor.length > 0 ? "Action Required" : "All Paired"}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unassigned Mentees</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {menteesWithoutMentor.length}
                    </h2>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Assign &rarr;
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Tasks Card */}
              <div
                onClick={() => setActiveTab("tasks")}
                className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-violet-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-600/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">
                    {taskStats.inProgress} In Progress
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Tasks</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {allTasks.length}
                    </h2>
                    <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      View Tasks &rarr;
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation Panels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Mentors Management Panel */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentors Hub</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {mentors.length} total mentors • {availableMentors.length} active
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openCreate("mentor")}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>+</span>
                      <span>New Mentor</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    Manage instructors, view assigned mentees per mentor, register new mentors, and configure mentor accounts.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("mentors")}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <span>Open Mentors Page</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Mentees Management Panel */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentees Hub</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {mentees.length} total mentees • {menteesWithMentor.length} assigned
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openCreate("mentee")}
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>+</span>
                      <span>New Mentee</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    Track intern onboarding progress, review mentor allocations, pair unassigned interns, and oversee mentee profiles.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("mentees")}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <span>Open Mentees Page</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Tasks Directory Panel */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Tasks Directory</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {allTasks.length} total tasks • {taskStats.complete} completed
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 rounded-lg text-xs font-semibold">
                      {taskStats.submitted} pending review
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    Inspect all assignments, files attached by mentors, mentee submission deliverables, logged working hours, and evaluations.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <span>Open Tasks Directory</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>

            {/* Quick Previews Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Recent Mentors Preview */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
                <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recent Mentors</h4>
                  </div>
                  <button
                    onClick={() => setActiveTab("mentors")}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    View All ({mentors.length}) &rarr;
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
                  {mentors.slice(0, 5).map((mentor) => {
                    const assignedMentees = mentees.filter((m) =>
                      m.mentorId
                        ? m.mentorId === mentor.id
                        : m.mentor?.toLowerCase() === mentor.name.toLowerCase()
                    );
                    return (
                      <div key={mentor.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${mentor.avatarBg}`}>
                            {getInitials(mentor.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{mentor.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{mentor.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {assignedMentees.length} mentee{assignedMentees.length !== 1 ? "s" : ""}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${mentor.status?.toLowerCase() === "inactive"
                              ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                              : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                            }`}>
                            {mentor.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {mentors.length === 0 && (
                    <p className="p-6 text-center text-xs text-slate-400">No mentors registered yet.</p>
                  )}
                </div>
              </div>

              {/* Recent Mentees Preview */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
                <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recent Mentees</h4>
                  </div>
                  <button
                    onClick={() => setActiveTab("mentees")}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    View All ({mentees.length}) &rarr;
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
                  {mentees.slice(0, 5).map((mentee) => {
                    const assignedMentor = resolveMenteeMentor(mentee);
                    return (
                      <div key={mentee.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${mentee.avatarBg}`}>
                            {getInitials(mentee.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{mentee.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {assignedMentor ? `Mentor: ${assignedMentor.name}` : "Unassigned"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${mentee.status?.toLowerCase() === "inactive"
                              ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                              : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                            }`}>
                            {mentee.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {mentees.length === 0 && (
                    <p className="p-6 text-center text-xs text-slate-400">No mentees registered yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: MENTORS SEPARATE PAGE
            ======================================================== */}
        {activeTab === "mentors" && (
          <div>
            {/* Page Title & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Mentors Management
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  View, manage, and assign mentees to all technical mentors in the system.
                </p>
              </div>
              <button
                onClick={() => openCreate("mentor")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <span className="text-lg leading-none">+</span>
                <span>Create Mentor</span>
              </button>
            </div>

            {/* Mentors Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Mentors */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Mentors</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{mentors.length}</h3>
                </div>
              </div>

              {/* Active Mentors */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Mentors</p>
                  <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{availableMentors.length}</h3>
                </div>
              </div>

              {/* Inactive Mentors */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-rose-600/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inactive Mentors</p>
                  <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">{inactiveMentorsCount}</h3>
                </div>
              </div>

              {/* Mentees Mentored */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mentees Mentored</p>
                  <h3 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">{menteesWithMentor.length}</h3>
                </div>
              </div>
            </div>

            {/* Mentor List Section */}
            <section
              id="mentor-section"
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-8 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentor List</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      View and manage all mentors in the system.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => openCreate("mentor")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <span>+</span>
                  <span>Create Mentor</span>
                </button>
              </div>

              {/* Card Toolbar */}
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <svg
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search mentors by name or email..."
                    value={mentorSearch}
                    onChange={(e) => setMentorSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={mentorFilter}
                    onChange={(e) => setMentorFilter(e.target.value)}
                    className="w-28 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="All">All</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-700/80">
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Joined On
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        On Board
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-48 min-w-[190px]">
                        Assigned Mentees
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                    {filteredMentors.map((mentor) => (
                      <tr
                        key={mentor.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3 text-left">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs ${mentor.avatarBg}`}
                            >
                              {getInitials(mentor.name)}
                            </div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {mentor.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                          {mentor.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/30">
                            Mentor
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                          {mentor.joinedOn}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${mentor.status?.toLowerCase() === "inactive"
                                ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                                : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                              }`}
                          >
                            {mentor.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${(mentor.on_Board ?? mentor.on_board ?? mentor.onBoard)
                                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                                : "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30"
                              }`}
                          >
                            {(mentor.on_Board ?? mentor.on_board ?? mentor.onBoard) ? "Completed" : "Pending"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-48 min-w-[190px]">
                          {(() => {
                            const assignedMentees = mentees.filter((m) =>
                              m.mentorId
                                ? m.mentorId === mentor.id
                                : m.mentor?.toLowerCase() === mentor.name.toLowerCase()
                            );
                            return (
                              <div className="w-48">
                                <select
                                  value=""
                                  disabled={assignedMentees.length === 0}
                                  className={`w-full truncate border rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${assignedMentees.length === 0
                                      ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer shadow-2xs"
                                    }`}
                                  onChange={() => { }}
                                >
                                  <option value="" disabled>
                                    {assignedMentees.length === 0
                                      ? "No mentees assigned"
                                      : `${assignedMentees.length} Mentee${assignedMentees.length > 1 ? "s" : ""} Assigned`}
                                  </option>
                                  {assignedMentees.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.email})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => setEditingUser({ ...mentor })}
                              title="Edit User"
                              aria-label="Edit User"
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDelete(mentor.id, mentor.name)}
                              title="Delete User"
                              aria-label="Delete User"
                              className="p-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/60 shadow-2xs transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredMentors.length === 0 && (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-slate-400 dark:text-slate-400 text-sm">
                          No mentors found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ========================================================
        TAB 3: MENTEES SEPARATE PAGE
        ======================================================== */}
        {activeTab === "mentees" && (
          <div>
            {/* Page Title & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Mentees Management
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  View, track, and assign mentors to all mentees in the training program.
                </p>
              </div>
              <button
                onClick={() => openCreate("mentee")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <span className="text-lg leading-none">+</span>
                <span>Create Mentee</span>
              </button>
            </div>

            {/* Mentees Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Mentees */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Mentees</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{mentees.length}</h3>
                </div>
              </div>

              {/* Active Mentees */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Mentees</p>
                  <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeMenteesCount}</h3>
                </div>
              </div>

              {/* Assigned to Mentor */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned to Mentor</p>
                  <h3 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">{menteesWithMentor.length}</h3>
                </div>
              </div>

              {/* Needs Mentor */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-amber-600/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Needs Mentor</p>
                  <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{menteesWithoutMentor.length}</h3>
                </div>
              </div>
            </div>

            {/* Mentee List Section */}
            <section
              id="mentee-section"
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-8 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentee List</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      View and manage all mentees in the system.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => openCreate("mentee")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <span>+</span>
                  <span>Create Mentee</span>
                </button>
              </div>

              {/* Card Toolbar */}
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <svg
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search mentees by name or email..."
                    value={menteeSearch}
                    onChange={(e) => setMenteeSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={menteeFilter}
                    onChange={(e) => setMenteeFilter(e.target.value)}
                    className="w-28 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="All">All</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-700/80">
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Assigned Mentor
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Joined On
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        On Board
                      </th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                    {filteredMentees.map((mentee) => {
                      const assignedMentor = resolveMenteeMentor(mentee);
                      return (
                        <tr
                          key={mentee.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3 text-left">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs ${mentee.avatarBg}`}
                              >
                                {getInitials(mentee.name)}
                              </div>
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {mentee.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                            {mentee.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30">
                              Mentee
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-200 font-medium">
                            {assignedMentor ? (
                              <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span>{assignedMentor.name}</span>
                                {assignedMentor.status?.toLowerCase() === "inactive" && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 border border-amber-200/70 dark:border-amber-700/50">
                                    Inactive
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                            {mentee.joinedOn}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${mentee.status?.toLowerCase() === "inactive"
                                  ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                                  : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                                }`}
                            >
                              {mentee.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${(mentee.on_Board ?? mentee.on_board ?? mentee.onBoard)
                                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                                  : "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30"
                                }`}
                            >
                              {(mentee.on_Board ?? mentee.on_board ?? mentee.onBoard) ? "Completed" : "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* Assign / Change Mentor Button */}
                              <button
                                type="button"
                                onClick={() => openAssignMentorModal(mentee)}
                                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800/60 shadow-2xs transition-colors cursor-pointer"
                                title={assignedMentor ? `Change Mentor (${assignedMentor.name})` : "Assign Mentor"}
                                aria-label={assignedMentor ? "Change Mentor" : "Assign Mentor"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => setEditingUser({ ...mentee })}
                                title="Edit User"
                                aria-label="Edit User"
                                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDelete(mentee.id, mentee.name)}
                                title="Delete User"
                                aria-label="Delete User"
                                className="p-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/60 shadow-2xs transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredMentees.length === 0 && (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-slate-400 dark:text-slate-400 text-sm">
                          No mentees found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ========================================================
        TAB 4: ALL TASKS & DETAILS DIRECTORY PAGE
        ======================================================== */}
        {activeTab === "tasks" && (
          <div>
            {/* Page Title & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  All Tasks Directory
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Oversee all assignments, mentor files, mentee deliverables, time logs, and reviews.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadAllTasks}
                  disabled={tasksLoading}
                  className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 text-blue-600 dark:text-blue-400 ${tasksLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh Tasks</span>
                </button>
              </div>
            </div>

            {/* Quick Filter Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <div
                onClick={() => setTaskStatusFilter("All")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${taskStatusFilter === "All"
                    ? "bg-blue-50/80 dark:bg-blue-900/30 border-blue-500/50 shadow-xs"
                    : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                  }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">All Tasks</p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{taskStats.total}</h3>
              </div>

              <div
                onClick={() => setTaskStatusFilter(taskStatusFilter === "in-progress" ? "All" : "in-progress")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${taskStatusFilter === "in-progress"
                    ? "bg-blue-50/80 dark:bg-blue-900/30 border-blue-500/50 shadow-xs"
                    : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">In Progress</p>
                </div>
                <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{taskStats.inProgress}</h3>
              </div>

              <div
                onClick={() => setTaskStatusFilter(taskStatusFilter === "submitted" ? "All" : "submitted")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${taskStatusFilter === "submitted"
                    ? "bg-amber-50/80 dark:bg-amber-900/30 border-amber-500/50 shadow-xs"
                    : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Submitted</p>
                </div>
                <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{taskStats.submitted}</h3>
              </div>

              <div
                onClick={() => setTaskStatusFilter(taskStatusFilter === "needs-revision" ? "All" : "needs-revision")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${taskStatusFilter === "needs-revision"
                    ? "bg-purple-50/80 dark:bg-purple-900/30 border-purple-500/50 shadow-xs"
                    : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Revision</p>
                </div>
                <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">{taskStats.needsRevision}</h3>
              </div>

              <div
                onClick={() => setTaskStatusFilter(taskStatusFilter === "complete" ? "All" : "complete")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${taskStatusFilter === "complete"
                    ? "bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-500/50 shadow-xs"
                    : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Completed</p>
                </div>
                <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{taskStats.complete}</h3>
              </div>

              <div
                onClick={() => setTaskStatusFilter(taskStatusFilter === "blocker" ? "All" : "blocker")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${taskStatusFilter === "blocker"
                    ? "bg-rose-50/80 dark:bg-rose-900/30 border-rose-500/50 shadow-xs"
                    : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Blockers</p>
                </div>
                <h3 className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{taskStats.blocker}</h3>
              </div>
            </div>

            {/* Filter Toolbar */}
            <section className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[240px]">
                  <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search tasks by title, mentee, mentor, or category..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="w-full pl-10 pr-9 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {taskSearch && (
                    <button
                      onClick={() => setTaskSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Dropdown Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>Status:</span>
                    <select
                      value={taskStatusFilter}
                      onChange={(e) => setTaskStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="All">All Statuses</option>
                      <option value="in-progress">In Progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="needs-revision">Needs Revision</option>
                      <option value="complete">Completed</option>
                      <option value="blocker">Blocker</option>
                      <option value="hold">On Hold</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>Priority:</span>
                    <select
                      value={taskPriorityFilter}
                      onChange={(e) => setTaskPriorityFilter(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="All">All Priorities</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>Category:</span>
                    <select
                      value={taskCategoryFilter}
                      onChange={(e) => setTaskCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="All">All Categories</option>
                      <option value="upskill">Upskill</option>
                      <option value="research">Research</option>
                      <option value="client-project">Client Project</option>
                      <option value="inhouse-project">Inhouse Project</option>
                    </select>
                  </div>

                  {(taskSearch || taskStatusFilter !== "All" || taskPriorityFilter !== "All" || taskCategoryFilter !== "All") && (
                    <button
                      onClick={() => {
                        setTaskSearch("");
                        setTaskStatusFilter("All");
                        setTaskPriorityFilter("All");
                        setTaskCategoryFilter("All");
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ml-1 font-medium"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Tasks Table */}
            <section className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                      <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Task Title & Category
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Mentee
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Assigned By
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Logged Time
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Files / Links
                      </th>
                      <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {filteredTasks.map((task) => {
                      const statusInfo = getStatusBadge(task.status);
                      const isOverdue =
                        task.status !== "complete" &&
                        task.due_date &&
                        new Date(task.due_date) < new Date();
                      const attachmentCount = Array.isArray(task.attachments) ? task.attachments.length : 0;
                      const hasSubmissionDeliverable = Boolean(task.submission_url || task.demo_url || task.submission_notes);
                      const actualHours = (Number(task.actual_seconds || 0) / 3600).toFixed(1);

                      return (
                        <tr
                          key={task.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                        >
                          {/* Title & Category & Priority */}
                          <td className="py-3 px-5">
                            <div className="flex items-start gap-2">
                              <div>
                                <span className="font-semibold text-sm text-slate-900 dark:text-white block hover:text-blue-600 cursor-pointer" onClick={() => setSelectedTaskDetails(task)}>
                                  {task.title}
                                </span>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {task.category || "upskill"}
                                  </span>
                                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${getPriorityBadge(task.priority)}`}>
                                    {task.priority || "medium"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Mentee */}
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {getInitials(task.mentee?.name || "Mentee")}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {task.mentee?.name || `Mentee #${task.mentee_id}`}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {task.mentee?.email || "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Assigner / Mentor */}
                          <td className="py-3 px-5 text-xs text-slate-700 dark:text-slate-300">
                            {task.assigner?.name || `Mentor #${task.assigned_by}`}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                              <span>{statusInfo.label}</span>
                            </span>
                          </td>

                          {/* Due Date */}
                          <td className="py-3 px-5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            <div>
                              <span>{formatDate(task.due_date)}</span>
                              {isOverdue && (
                                <span className="block text-[10px] font-bold text-rose-500 dark:text-rose-400 mt-0.5">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Time Logged */}
                          <td className="py-3 px-5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {actualHours}h {task.estimated_hours ? `/ ${task.estimated_hours}h` : ""}
                            </div>
                            {task.estimated_hours ? (
                              <div className="w-20 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${Number(actualHours) > task.estimated_hours ? "bg-rose-500" : "bg-blue-500"
                                    }`}
                                  style={{
                                    width: `${Math.min(100, Math.round((Number(actualHours) / task.estimated_hours) * 100))}%`,
                                  }}
                                />
                              </div>
                            ) : null}
                          </td>

                          {/* Attachments / Deliverables */}
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-1.5">
                              {attachmentCount > 0 ? (
                                <span
                                  title={`${attachmentCount} file${attachmentCount > 1 ? "s" : ""} attached by mentor`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/50"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  <span>{attachmentCount}</span>
                                </span>
                              ) : null}

                              {hasSubmissionDeliverable ? (
                                <span
                                  title="Mentee has submitted deliverables"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  <span>Sub</span>
                                </span>
                              ) : null}

                              {!attachmentCount && !hasSubmissionDeliverable && (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedTaskDetails(task)}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800/50 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>Details</span>
                              </button>

                              <button
                                onClick={() => setTaskToDelete(task)}
                                title="Delete Task"
                                aria-label="Delete Task"
                                className="p-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/60 shadow-2xs transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredTasks.length === 0 && (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <svg className="w-12 h-12 mb-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No tasks found</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              {taskSearch || taskStatusFilter !== "All"
                                ? "Try adjusting your search queries or active filters."
                                : "No tasks have been assigned by mentors yet."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        {/* TAB 5: TEAM HIERARCHY */}
        {activeTab === "hierarchy" && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Team Hierarchy
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                See which mentors report to the admin and which mentees are under each mentor.
              </p>
            </div>

            <HierarchyTree
              admin={currentUser}
              mentors={mentors}
              mentees={mentees}
              resolveMenteeMentor={resolveMenteeMentor}
            />
          </div>
        )}
      </main>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create New {createRole === "mentor" ? "Mentor" : "Mentee"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter the user details below.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {modalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter name... "
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              {createRole === "mentee" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Assign Mentor
                  </label>
                  <select
                    value={formData.mentor || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, mentor: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Unassigned (No Mentor)</option>
                    {availableMentors.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assign Mentees (Multi-Select Dropdown) - ONLY for creating new Mentor */}
              {createRole === "mentor" && (
                <div ref={menteeDropdownRef} className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Assign Mentees
                    </label>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {formData.assignedMentees?.length || 0} selected
                    </span>
                  </div>

                  {/* Dropdown trigger button */}
                  <button
                    type="button"
                    onClick={() => setMenteeDropdownOpen((prev) => !prev)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-left bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span
                      className={
                        formData.assignedMentees?.length > 0
                          ? "text-slate-800 dark:text-white font-medium"
                          : "text-slate-400 dark:text-slate-500"
                      }
                    >
                      {formData.assignedMentees?.length > 0
                        ? `${formData.assignedMentees.length} mentee${formData.assignedMentees.length > 1 ? "s" : ""} selected`
                        : "Select mentees to assign..."}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${menteeDropdownOpen ? "rotate-180" : ""
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Selected Mentees Pills/Chips */}
                  {formData.assignedMentees?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                      {formData.assignedMentees.map((menteeId) => {
                        const m = mentees.find((item) => item.id === menteeId);
                        if (!m) return null;
                        return (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-500/30 shadow-2xs"
                          >
                            <span>{m.name}</span>
                            <button
                              type="button"
                              onClick={() => removeAssignedMentee(m.id)}
                              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 ml-0.5 cursor-pointer focus:outline-none"
                              title="Remove mentee"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown Menu */}
                  {menteeDropdownOpen && (
                    <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      {/* Search box & Quick actions */}
                      <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                        <div className="relative">
                          <svg
                            className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="text"
                            placeholder="Search mentee by name or email..."
                            value={menteeSearchQuery}
                            onChange={(e) => setMenteeSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                        </div>

                        {mentees.length > 0 && (
                          <div className="flex items-center justify-between text-xs px-0.5">
                            <span className="text-slate-500 dark:text-slate-400">
                              {formData.assignedMentees?.length || 0} of {mentees.length} selected
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={selectAllMentees}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                              >
                                Select All
                              </button>
                              <span className="text-slate-300 dark:text-slate-600">|</span>
                              <button
                                type="button"
                                onClick={clearAllAssignedMentees}
                                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mentee List */}
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {mentees.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            No mentees registered in the system yet.
                          </div>
                        ) : availableMenteesForAssign.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            No mentees matching &quot;{menteeSearchQuery}&quot;
                          </div>
                        ) : (
                          availableMenteesForAssign.map((m, idx) => {
                            const isSelected = (formData.assignedMentees || []).includes(m.id);
                            const isAssigned = Boolean(m.mentor?.trim());
                            const prevWasUnassigned =
                              idx > 0 &&
                              !availableMenteesForAssign[idx - 1].mentor?.trim();
                            const showAssignedHeader = isAssigned && (idx === 0 || prevWasUnassigned);
                            const showUnassignedHeader = !isAssigned && idx === 0;

                            return (
                              <div key={m.id}>
                                {showUnassignedHeader && (
                                  <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                                    <span>Unassigned Mentees</span>
                                    <span className="text-[10px] lowercase font-normal opacity-80">(Available)</span>
                                  </div>
                                )}
                                {showAssignedHeader && (
                                  <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60">
                                    Currently Assigned Mentees
                                  </div>
                                )}
                                <label
                                  className={`w-full px-3 py-2.5 flex items-center gap-3 cursor-pointer select-none transition-colors ${isSelected
                                      ? "bg-blue-50/70 dark:bg-blue-900/20"
                                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleMenteeSelection(m.id)}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 dark:bg-slate-800 cursor-pointer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                                        {m.name}
                                      </p>
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${m.mentor
                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                            : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                          }`}
                                      >
                                        {m.mentor ? `Mentor: ${m.mentor}` : "Unassigned"}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {m.email}
                                    </p>
                                  </div>
                                </label>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={formData.status || "Active"}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create {createRole === "mentor" ? "Mentor" : "Mentee"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit {editingUser.role === "mentor" ? "Mentor" : "Mentee"}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {modalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) =>
                    setEditingUser((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {editingUser.role === "mentee" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Assigned Mentor
                  </label>
                  <select
                    value={editingUser.mentor || ""}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, mentor: e.target.value || "" }))
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Unassigned (No Mentor)</option>
                    {availableMentors.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                    {editingUser.mentor &&
                      !availableMentors.some(
                        (m) => m.name?.toLowerCase() === editingUser.mentor?.toLowerCase()
                      ) && (
                        <option value={editingUser.mentor}>
                          {editingUser.mentor} (Inactive)
                        </option>
                      )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={editingUser.status}
                  onChange={(e) =>
                    setEditingUser((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN MENTOR MODAL */}
      {assigningMentee && (() => {
        const currentMentor = resolveMenteeMentor(assigningMentee);
        const isUnchangedSelection =
          Boolean(currentMentor) && Number(selectedMentorId) === currentMentor.id;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {currentMentor ? "Change Assigned Mentor" : "Assign Mentor"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select an available mentor for this mentee.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={assignLoading}
                  onClick={() => setAssigningMentee(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50 text-xl font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleAssignMentorSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                {assignError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{assignError}</span>
                  </div>
                )}

                {/* Mentee Summary */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${assigningMentee.avatarBg}`}
                    >
                      {getInitials(assigningMentee.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {assigningMentee.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {assigningMentee.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Current Mentor:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {currentMentor ? currentMentor.name : "Not Assigned"}
                    </span>
                  </div>
                </div>

                {/* No available mentors warning */}
                {availableMentors.length === 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-medium">
                    No active mentors are available. Create or activate a mentor before assigning.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Select Mentor
                  </label>
                  <select
                    value={selectedMentorId}
                    onChange={(e) => {
                      setSelectedMentorId(e.target.value);
                      if (assignError) setAssignError("");
                    }}
                    disabled={assignLoading || availableMentors.length === 0}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">-- Choose an available mentor --</option>
                    {currentMentor &&
                      !availableMentors.some((m) => m.id === currentMentor.id) && (
                        <option value={String(currentMentor.id)} disabled>
                          {currentMentor.name} (Inactive - current)
                        </option>
                      )}
                    {availableMentors.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {currentMentor && (
                      <button
                        type="button"
                        disabled={assignLoading}
                        onClick={handleRemoveMentorAssignment}
                        className="px-3.5 py-2 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Remove Mentor
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={assignLoading}
                      onClick={() => setAssigningMentee(null)}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        assignLoading ||
                        availableMentors.length === 0 ||
                        !selectedMentorId ||
                        isUnchangedSelection
                      }
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                    >
                      {assignLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>
                          {currentMentor ? "Confirm Change" : "Confirm Assignment"}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Task Details Modal */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${getStatusBadge(selectedTaskDetails.status).dot}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedTaskDetails.title}
                    </h3>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${getStatusBadge(selectedTaskDetails.status).bg}`}>
                      {getStatusBadge(selectedTaskDetails.status).label}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${getPriorityBadge(selectedTaskDetails.priority)}`}>
                      {selectedTaskDetails.priority || "medium"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Category: <span className="font-medium uppercase">{selectedTaskDetails.category || "upskill"}</span> • Created: {formatDate(selectedTaskDetails.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTaskDetails(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Top Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mentee info */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Assigned Mentee</span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                      {getInitials(selectedTaskDetails.mentee?.name || "Mentee")}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {selectedTaskDetails.mentee?.name || `Mentee #${selectedTaskDetails.mentee_id}`}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedTaskDetails.mentee?.email || "No email available"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mentor info */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Assigned By (Mentor)</span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                      {getInitials(selectedTaskDetails.assigner?.name || "Mentor")}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {selectedTaskDetails.assigner?.name || `Mentor #${selectedTaskDetails.assigned_by}`}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedTaskDetails.assigner?.email || "No email available"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline & Time Tracking Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Timeline */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Timeline Schedule</span>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Start Date:</span>
                    <span className="font-semibold">{formatDate(selectedTaskDetails.start_date)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Due Date:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{formatDate(selectedTaskDetails.due_date)}</span>
                  </div>
                  {selectedTaskDetails.submitted_at && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Submitted On:</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{formatDateTime(selectedTaskDetails.submitted_at)}</span>
                    </div>
                  )}
                </div>

                {/* Time Tracking */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Time Tracking</span>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Actual Logged:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{(Number(selectedTaskDetails.actual_seconds || 0) / 3600).toFixed(2)} hours</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Estimated Budget:</span>
                    <span className="font-semibold">{selectedTaskDetails.estimated_hours ? `${selectedTaskDetails.estimated_hours} hours` : "None set"}</span>
                  </div>
                  {selectedTaskDetails.estimated_hours ? (
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full ${(Number(selectedTaskDetails.actual_seconds || 0) / 3600) > selectedTaskDetails.estimated_hours
                            ? "bg-rose-500"
                            : "bg-blue-600"
                          }`}
                        style={{
                          width: `${Math.min(100, Math.round(((Number(selectedTaskDetails.actual_seconds || 0) / 3600) / selectedTaskDetails.estimated_hours) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Task Brief & Instructions
                </h4>
                <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedTaskDetails.description || "No text description provided by mentor."}
                </div>
              </div>

              {/* Mentor Attachments (ImageKit files) */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>Mentor Attached Files</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    ({Array.isArray(selectedTaskDetails.attachments) ? selectedTaskDetails.attachments.length : 0})
                  </span>
                </h4>
                {Array.isArray(selectedTaskDetails.attachments) && selectedTaskDetails.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedTaskDetails.attachments.map((att, i) => (
                      <button
                        key={att.id || i}
                        type="button"
                        onClick={async () => {
                          try {
                            await taskApi.downloadAttachment(selectedTaskDetails.id, att.id ?? i, att.name || "attachment");
                          } catch (err) {
                            console.error("Failed to download attachment:", err);
                            if (att.url) window.open(att.url, "_blank");
                          }
                        }}
                        className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 flex items-center justify-between gap-2 text-xs transition-colors group shadow-2xs text-left cursor-pointer w-full"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600">
                              {att.name || "Attachment"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {att.size ? `${(att.size / 1024).toFixed(1)} KB` : "File"}
                            </p>
                          </div>
                        </div>
                        <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          Download &rarr;
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    No files were attached by the mentor when assigning this task.
                  </p>
                )}
              </div>

              {/* Mentee Deliverables & Submissions */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Mentee Submission Deliverables
                </h4>
                {selectedTaskDetails.submission_url || selectedTaskDetails.demo_url || selectedTaskDetails.submission_notes ? (
                  <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 space-y-3">
                    {selectedTaskDetails.submission_url && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Submission URL / Repo:</span>
                        <a
                          href={selectedTaskDetails.submission_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold max-w-[320px] truncate"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span className="truncate">{selectedTaskDetails.submission_url}</span>
                        </a>
                      </div>
                    )}

                    {selectedTaskDetails.demo_url && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Live Demo URL:</span>
                        <a
                          href={selectedTaskDetails.demo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold max-w-[320px] truncate"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="truncate">{selectedTaskDetails.demo_url}</span>
                        </a>
                      </div>
                    )}

                    {selectedTaskDetails.submission_notes && (
                      <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs">
                        <span className="text-slate-500 font-medium block mb-1">Mentee Notes:</span>
                        <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedTaskDetails.submission_notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    No deliverables have been submitted for this task yet.
                  </p>
                )}
              </div>

              {/* Mentor Review & Feedback */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Mentor Evaluation & Feedback
                </h4>
                {selectedTaskDetails.feedback || selectedTaskDetails.score !== null ? (
                  <div className="p-4 bg-purple-50/40 dark:bg-purple-950/20 rounded-xl border border-purple-200/80 dark:border-purple-800/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">
                        Evaluator: {selectedTaskDetails.evaluator?.name || `User #${selectedTaskDetails.evaluated_by}`}
                      </span>
                      {selectedTaskDetails.score !== null && (
                        <span className="px-2 py-0.5 rounded font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                          Score: {selectedTaskDetails.score} / 100
                        </span>
                      )}
                    </div>
                    {selectedTaskDetails.evaluated_at && (
                      <p className="text-[11px] text-slate-400">
                        Evaluated on: {formatDateTime(selectedTaskDetails.evaluated_at)}
                      </p>
                    )}
                    {selectedTaskDetails.feedback && (
                      <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/40">
                        <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedTaskDetails.feedback}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    This task has not been evaluated by a mentor yet.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40 flex-shrink-0">
              <button
                type="button"
                onClick={() => setTaskToDelete(selectedTaskDetails)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg transition-colors cursor-pointer"
              >
                Delete Task
              </button>
              <button
                type="button"
                onClick={() => setSelectedTaskDetails(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ConfirmModal for User Deletion */}
      {userToDelete && (
        <ConfirmModal
          isOpen={Boolean(userToDelete)}
          title={`Delete ${userToDelete.isMentee ? "Mentee" : "Mentor"}`}
          message={
            userToDelete.isMentee
              ? `Are you sure you want to delete ${userToDelete.name}? All tasks assigned to this mentee will also be permanently deleted. This action cannot be undone.`
              : `Are you sure you want to delete ${userToDelete.name}? This action cannot be undone.`
          }
          confirmText={`Delete ${userToDelete.isMentee ? "Mentee" : "Mentor"}`}
          variant="danger"
          isLoading={actionLoading}
          onClose={() => setUserToDelete(null)}
          onConfirm={confirmDeleteUser}
        />
      )}

      {/* ConfirmModal for Task Deletion */}
      {taskToDelete && (
        <ConfirmModal
          isOpen={Boolean(taskToDelete)}
          title="Delete Task"
          message={`Are you sure you want to permanently delete task "${taskToDelete.title}"? All submissions, logged time sessions, and attached materials will be removed.`}
          confirmText="Delete Task"
          variant="danger"
          isLoading={deleteTaskLoading}
          onClose={() => setTaskToDelete(null)}
          onConfirm={confirmDeleteTask}
        />
      )}

    </div>
  );
}

export default AdminDashboard;
