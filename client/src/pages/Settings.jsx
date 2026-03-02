import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

const themes = ['light', 'dark', 'sunset', 'midnight'];

const applyTheme = (theme) => {
  themes.forEach((t) => document.body.classList.remove(`theme-${t}`));
  document.body.classList.add(`theme-${theme}`);
};

export const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [theme, setTheme] = useState(() => localStorage.getItem('cyber_theme') || 'midnight');

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('cyber_theme', theme);
  }, [theme]);

  return (
    <div className="settings-layout">
      <aside className="settings-nav card">
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <div className="settings-nav__list">
          <button className="btn btn--ghost" type="button">Appearance</button>
          <button className="btn btn--ghost" type="button">Privacy</button>
          <button className="btn btn--ghost" type="button">Security</button>
        </div>
      </aside>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Appearance</h2>
        <p>Pick a theme. This is stored locally in the browser for now.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              className={`btn ${theme === t ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => {
                setTheme(t);
                toast(`Theme: ${t}`, 'success', 1400);
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="card" style={{ marginTop: 18, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Account</h3>
          <div className="hint" style={{ margin: 0 }}>Signed in as {user?.email || user?.username}</div>
        </div>
      </section>
    </div>
  );
};

