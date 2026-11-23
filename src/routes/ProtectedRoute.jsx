
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const currentPath = location.pathname.toLowerCase();

  const isChangePasswordPage =
    currentPath === '/changepassword' ||
    currentPath === '/change-password';

  // First-time users must change their password.
  if (user?.firstLogin === true && !isChangePasswordPage) {
    return <Navigate to="/changePassword" replace />;
  }

  // Users who have already changed their password
  // must not access the first-login password page.
  if (user?.firstLogin === false && isChangePasswordPage) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white">
        <h1 className="text-2xl font-bold text-rose-400 mb-2">
          Access Denied
        </h1>

        <p className="text-slate-400 text-sm mb-4">
          You do not have permission to view this section.
        </p>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
