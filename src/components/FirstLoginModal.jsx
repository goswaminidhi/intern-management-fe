import { useState, useMemo } from 'react';
import useAuth from '../hooks/useAuth';
import { checkPasswordRules, getPasswordStrength } from '../utils/passwordValidation';

export const FirstLoginModal = () => {
  const { user, mustChangePassword, changePassword, completeFirstLogin } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Password rules validation
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

  const strengthInfo = useMemo(() => {
    return getPasswordStrength(passedCount, Boolean(newPassword));
  }, [passedCount, newPassword]);

  if (!mustChangePassword) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword) {
      setError('Please enter your new password.');
      return;
    }

    if (!isPasswordValid) {
      const firstFailing = ruleResults.find((r) => !r.passed);
      setError(
        firstFailing
          ? `Password requirement not met: ${firstFailing.label}`
          : 'Password does not meet requirements.'
      );
      return;
    }

    if (!confirmPassword) {
      setError('Please confirm your new password.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const res = await changePassword(newPassword);
    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to update password');
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    await completeFirstLogin();
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              First Login Setup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Welcome, {user?.name || 'User'}! Please set your new secure password.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter new password..."
                minLength={8}
                maxLength={72}
                required
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all ${
                  newPassword && isPasswordValid
                    ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Strength meter bar */}
            {strengthInfo && (
              <div className="mt-2 w-full bg-slate-100 dark:bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strengthInfo.color} ${strengthInfo.percent} transition-all duration-300 ease-out`}
                />
              </div>
            )}

            {/* Checklist */}
            <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-wider">
                Password Requirements
              </span>
              <ul className="space-y-1.5">
                {ruleResults.map((rule) => (
                  <li
                    key={rule.id}
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      rule.passed
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {rule.passed ? (
                      <svg
                        className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-1 flex-shrink-0" />
                    )}
                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Confirm new password..."
                required
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all ${
                  passwordsMatch
                    ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20'
                    : showPasswordMismatch
                    ? 'border-rose-500/80 focus:ring-2 focus:ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Match status */}
            {passwordsMatch && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Passwords match
              </p>
            )}
            {showPasswordMismatch && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1.5 mt-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Passwords do not match
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !isPasswordValid || !passwordsMatch}
              className="w-full sm:flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              {submitting ? 'Updating...' : 'Set New Password'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitting}
              className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              Continue Anyway
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FirstLoginModal;

