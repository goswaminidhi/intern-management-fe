import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import AdminDashboard from "./AdminDashboard";
import MentorDashboard from "./MentorDashboard";
import MenteeDashboard from "./MenteeDashboard";

function Dashboards() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const role = user.role?.toLowerCase();

  switch (role) {
    case "admin":
      return <AdminDashboard />;

    case "mentor":
      return <MentorDashboard />;

    case "mentee":
      return <MenteeDashboard />;

    default:
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white">
          <p className="text-rose-400 font-semibold mb-2">Unrecognized User Role: {user.role}</p>
          <p className="text-slate-400 text-sm">Please sign in with a valid account role (Admin, Mentor, or Mentee).</p>
        </div>
      );
  }
}

export default Dashboards;