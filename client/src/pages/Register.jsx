import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

export const RegisterPage = () => {
  const { register } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register({ name, username, email, password });
      toast('Account created', 'success');
      setPassword('');
      nav('/feed');
    } catch (err) {
      toast(err?.response?.data?.error || 'Registration failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="auth-shell">
        <section className="auth-panel">
          <div className="badge">Cyber Social</div>
          <h1>Create your account.</h1>
          <p>Pick a clean username. Upload a profile photo. Start chatting.</p>
        </section>

        <section className="auth-card">
          <h2>Register</h2>
          <p>Join Cyber in less than a minute.</p>
          <form className="form-grid" onSubmit={onSubmit} autoComplete="off">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
          </form>
          <p style={{ marginTop: 12 }}>
            Already have an account? <Link to="/login"><strong>Sign in</strong></Link>
          </p>
        </section>
      </div>
    </div>
  );
};
