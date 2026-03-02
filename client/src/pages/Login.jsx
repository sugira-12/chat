import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

export const LoginPage = () => {
  const { login } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast('Welcome back', 'success');
      setPassword('');
      nav('/feed');
    } catch (err) {
      toast(err?.response?.data?.error || 'Login failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="auth-shell">
        <section className="auth-panel">
          <div className="badge">Cyber Social</div>
          <h1>Welcome back.</h1>
          <p>Log in to your feed, chat instantly, and keep your circles connected.</p>
          <div className="card" style={{ marginTop: 24 }}>
            <h3>Production deploy</h3>
            <p>Use Cloudinary + Pusher for media and realtime chat.</p>
          </div>
        </section>

        <section className="auth-card">
          <h2>Sign in</h2>
          <p>Use your email and password to continue.</p>
          <form className="form-grid" onSubmit={onSubmit} autoComplete="off">
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Login'}</button>
          </form>
          <p style={{ marginTop: 12 }}>
            New here? <Link to="/register"><strong>Create an account</strong></Link>
          </p>
        </section>
      </div>
    </div>
  );
};
