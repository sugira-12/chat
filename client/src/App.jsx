import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './state/AuthProvider.jsx';
import { ShellLayout } from './components/ShellLayout.jsx';

import { LoginPage } from './pages/Login.jsx';
import { RegisterPage } from './pages/Register.jsx';
import { FeedPage } from './pages/Feed.jsx';
import { ChatPage } from './pages/Chat.jsx';
import { ProfilePage } from './pages/Profile.jsx';
import { SettingsPage } from './pages/Settings.jsx';

const Private = ({ children }) => {
  const { token, booting } = useAuth();
  if (booting) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/feed"
        element={
          <Private>
            <ShellLayout>
              <FeedPage />
            </ShellLayout>
          </Private>
        }
      />
      <Route
        path="/chat"
        element={
          <Private>
            <ShellLayout>
              <ChatPage />
            </ShellLayout>
          </Private>
        }
      />
      <Route
        path="/profile/:id?"
        element={
          <Private>
            <ShellLayout>
              <ProfilePage />
            </ShellLayout>
          </Private>
        }
      />
      <Route
        path="/settings"
        element={
          <Private>
            <ShellLayout>
              <SettingsPage />
            </ShellLayout>
          </Private>
        }
      />

      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}

