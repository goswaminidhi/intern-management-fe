import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '../../api/Passwordreset';
import "../../App.css";


export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      await requestPasswordReset(normalized);
      // The backend responds the same whether or not the account exists,
      // so we always continue to the code screen.
      sessionStorage.setItem('resetEmail', normalized);
      navigate('/verify-otp', { state: { email: normalized } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-progress">Step 1 of 3</p>
        <h1>Forgot your password?</h1>
        <p className="auth-lead">
          Enter the email linked to your account. We will send you a 6-digit code.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
          />

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" disabled={loading || !email.trim()}>
            {loading ? 'Sending code…' : 'Send code'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}