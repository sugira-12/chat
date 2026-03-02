import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider.jsx';

export const ShellLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const onLogout = async () => {
    await logout();
    nav('/login');
  };

  const avatarStyle = user?.avatarUrl
    ? { backgroundImage: `url('${user.avatarUrl}')` }
    : undefined;

  return (
    <div className="page">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar__brand">
            <div className="sidebar__brand-title">
              <h3>Cyber</h3>
            </div>
          </div>
          <div className="sidebar__user">
            <div className={`avatar avatar--sm ${user?.avatarUrl ? 'avatar--photo' : ''}`} style={avatarStyle} />
            <div>
              <div className="sidebar__user-name">{user?.name || user?.username || 'User'}</div>
              <div className="sidebar__user-handle">{user?.username ? `@${user.username}` : ''}</div>
            </div>
          </div>
          <nav>
            <NavLink to="/feed">
              <span className="nav-ico">FD</span>
              <span className="nav-label">Feed</span>
            </NavLink>
            <NavLink to="/chat">
              <span className="nav-ico">CH</span>
              <span className="nav-label">Chat</span>
            </NavLink>
            <NavLink to={`/profile/${user?.id || ''}`}>
              <span className="nav-ico">PR</span>
              <span className="nav-label">Profile</span>
            </NavLink>
            <NavLink to="/settings">
              <span className="nav-ico">ST</span>
              <span className="nav-label">Settings</span>
            </NavLink>
            <button type="button" className="btn btn--ghost" onClick={onLogout} style={{ width: '100%', marginTop: 12 }}>
              Logout
            </button>
          </nav>
          <div className="card" style={{ marginTop: 16, padding: 14 }}>
            <div className="hint" style={{ margin: 0 }}>
              New here? <Link to="/feed#compose">Create a post</Link>.
            </div>
          </div>
        </aside>

        <main>
          <div className="topbar">
            <div className="topbar__left">
              <input className="topbar__search" placeholder="Search people" disabled />
            </div>
            <div className="topbar__right">
              <Link className="topbar__profile" to={`/profile/${user?.id || ''}`}>
                <div className={`avatar avatar--sm ${user?.avatarUrl ? 'avatar--photo' : ''}`} style={avatarStyle} />
                <div className="topbar__profile-name">{user?.username || 'You'}</div>
              </Link>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
};
