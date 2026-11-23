import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import ThemeToggle from "../components/ThemeToggle";
import { checkPasswordRules, getPasswordStrength } from "../utils/passwordValidation";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, changePassword, logout } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Rule verification
  const ruleResults = useMemo(() => {
    return checkPasswordRules(newPassword);
  }, [newPassword]);

  const passedCount = useMemo(() => {
    return ruleResults.filter((r) => r.passed).length;
  }, [ruleResults]);

  const isPasswordValid = passedCount === ruleResults.length;
  const passwordsMatch = Boolean(confirmPassword && newPassword === confirmPassword);
  const showPasswordMismatch = Boolean(
    confirmPassword && newPassword && confirmPassword !== newPassword
  );

  // Strength score
  const strengthInfo = useMemo(() => {
    return getPasswordStrength(passedCount, Boolean(newPassword));
  }, [newPassword, passedCount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!newPassword) {
      setError("Please enter your new password.");
      return;
    }

    if (!isPasswordValid) {
      const firstFailing = ruleResults.find((r) => !r.passed);
      setError(firstFailing ? `Password requirement not met: ${firstFailing.label}` : "Password does not meet the requirements.");
      return;
    }

    if (!confirmPassword) {
      setError("Please confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const res = await changePassword(newPassword);
    setSubmitting(false);

    if (res.success) {
      setSuccessMsg("Password updated successfully! Redirecting...");
      navigate("/dashboard", { replace: true });
    } else {
      setError(res.error || "Failed to update password.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-900 text-slate-100 overflow-y-auto">
      {/* Top Navbar items */}
      <div className="w-full max-w-md flex items-center justify-end gap-3 mb-4 sm:absolute sm:top-4 sm:right-4 sm:mb-0 sm:w-auto z-20">
        <ThemeToggle />
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      {/* Main Card */}
      <div className="relative w-full max-w-md bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 p-5 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Change Password
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Welcome, <span className="font-semibold text-blue-400">{user?.name || "User"}</span>!
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-900/50 p-3 rounded-lg border border-slate-700/60">
          This is your first login. Please set a secure password satisfying all criteria below to proceed to your dashboard.
        </p>

        {/* Alerts */}
        {error && (
          <div className="p-3 mb-4 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-4 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                New Password
              </label>
              {strengthInfo && (
                <span className={`text-[11px] font-semibold ${strengthInfo.text}`}>
                  {strengthInfo.label}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                placeholder="Enter new password..."
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError("");
                }}
                className={`w-full px-3.5 py-2.5 pr-10 border rounded-lg text-sm text-white placeholder-slate-500 bg-slate-900 focus:outline-none transition-all ${
                  newPassword.length > 0 && isPasswordValid
                    ? "border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20"
                    : "border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer focus:outline-none"
                title={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Strength Meter Bar */}
            {strengthInfo && (
              <div className="mt-2 w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strengthInfo.color} ${strengthInfo.percent} transition-all duration-300 ease-out`}
                />
              </div>
            )}

            {/* Real-time Password Requirements Checklist */}
            <div className="mt-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 block mb-2 uppercase tracking-wider">
                Password Requirements
              </span>
              <ul className="space-y-1.5">
                {ruleResults.map((rule) => (
                  <li
                    key={rule.id}
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      rule.passed
                        ? "text-emerald-400 font-medium"
                        : "text-slate-400"
                    }`}
                  >
                    {rule.passed ? (
                      <svg
                        className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mx-1 flex-shrink-0" />
                    )}
                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                placeholder="Re-enter new password..."
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError("");
                }}
                className={`w-full px-3.5 py-2.5 pr-10 border rounded-lg text-sm text-white placeholder-slate-500 bg-slate-900 focus:outline-none transition-all ${
                  passwordsMatch
                    ? "border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20"
                    : showPasswordMismatch
                    ? "border-rose-500/80 focus:ring-2 focus:ring-rose-500/20"
                    : "border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer focus:outline-none"
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Match Status Feedback */}
            {passwordsMatch && (
              <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5 mt-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Passwords match
              </p>
            )}
            {showPasswordMismatch && (
              <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5 mt-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Passwords do not match
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !isPasswordValid || !passwordsMatch}
              className="w-full sm:flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;

