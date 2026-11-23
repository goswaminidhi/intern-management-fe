import { useState, useMemo } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { resetPassword } from '../../api/Passwordreset';
import { checkPasswordRules, getPasswordStrength } from '../../utils/passwordValidation';
import "../../App.css";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetToken = location.state?.resetToken;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Password rules validation
  const ruleResults = useMemo(() => {
    return checkPasswordRules(password);
  }, [password]);

  const passedCount = useMemo(() => {
    return ruleResults.filter((r) => r.passed).length;
  }, [ruleResults]);

  const isPasswordValid = passedCount === ruleResults.length;
  const passwordsMatch = Boolean(confirm && password === confirm);
  const showMismatch = Boolean(confirm && password && password !== confirm);

  const strengthInfo = useMemo(() => {
    return getPasswordStrength(passedCount, Boolean(password));
  }, [passedCount, password]);

  const canSubmit = isPasswordValid && passwordsMatch && !loading;

  // Opening this page directly (or refreshing it) means there is no token.
  if (!resetToken && !done) return <Navigate to="/forgot-password" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) {
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
    if (!confirm) {
      setError('Please confirm your new password.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    if (!canSubmit) return;

    setError('');
    setLoading(true);
    try {
      await resetPassword(resetToken, password, confirm);
      sessionStorage.removeItem('resetEmail');
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Password updated</h1>
          <p className="auth-lead">You can now sign in with your new password.</p>
          <Link className="auth-button-link" to="/login">Go to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-progress">Step 3 of 3</p>
        <h1>Set a new password</h1>
        <p className="auth-lead">Choose a password you have not used before.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="flex items-center justify-between mt-4 mb-1.5">
            <label htmlFor="password" className="!m-0">New password</label>
            {strengthInfo && (
              <span className={`text-[11px] font-semibold ${strengthInfo.text}`}>
                {strengthInfo.label}
              </span>
            )}
          </div>
          <input
            id="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            aria-invalid={Boolean(password && !isPasswordValid)}
            placeholder="Enter new password..."
          />

          {/* Strength Meter Bar */}
          {strengthInfo && (
            <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${strengthInfo.color} ${strengthInfo.percent} transition-all duration-300 ease-out`}
              />
            </div>
          )}

          {/* Password Requirements Checklist */}
          <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60">
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-1 flex-shrink-0" />
                  )}
                  <span>{rule.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <label htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (error) setError('');
            }}
            aria-invalid={showMismatch}
            placeholder="Re-enter new password..."
          />

          {/* Real-time match status */}
          {passwordsMatch && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              Passwords match
            </p>
          )}
          {showMismatch && (
            <p className="flex items-center gap-1.5 text-xs text-rose-500 font-medium mt-1 mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Passwords do not match
            </p>
          )}

          <label className="auth-check mt-3">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show passwords
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" disabled={!canSubmit} className="cursor-pointer">
            {loading ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </main>
  );
}
