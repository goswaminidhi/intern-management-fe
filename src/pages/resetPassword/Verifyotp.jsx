import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, requestPasswordReset, verifyResetOtp } from '../../api/Passwordreset';
import "../../App.css";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email ?? sessionStorage.getItem('resetEmail') ?? undefined;

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inputs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) return <Navigate to="/forgot-password" replace />;

  const code = digits.join('');

  function handleChange(index, value) {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => (next[i] = d));
    setDigits(next);
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { resetToken } = await verifyResetOtp(email, code);
      navigate('/reset-password', { state: { resetToken }, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      // A wrong code can be retried; other failures need a fresh code.
      if (err instanceof ApiError && err.code === 'INVALID_OTP') {
        setDigits(Array(OTP_LENGTH).fill(''));
        inputs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setInfo('');
    try {
      await requestPasswordReset(email);
      setInfo('A new code is on its way.');
      setDigits(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_SECONDS);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-progress">Step 2 of 3</p>
        <h1>Enter your code</h1>
        <p className="auth-lead">
          We sent a 6-digit code to <strong>{email}</strong>. It expires in 5 minutes.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="otp-row" role="group" aria-label="6-digit verification code">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                className="otp-box"
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={d}
                autoFocus={i === 0}
                aria-label={`Digit ${i + 1}`}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
              />
            ))}
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
          {info && <p className="auth-info" role="status">{info}</p>}

          <button type="submit" disabled={loading || code.length !== OTP_LENGTH}>
            {loading ? 'Verifying…' : 'Verify code'}
          </button>
        </form>

        <p className="auth-footer">
          {cooldown > 0 ? (
            <span>Resend code in {cooldown}s</span>
          ) : (
            <button type="button" className="link-button" onClick={handleResend}>Resend code</button>
          )}
          <br />
          <Link to="/forgot-password">Use a different email</Link>
        </p>
      </div>
    </main>
  );
}