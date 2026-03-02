import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './state/AuthProvider.jsx';
import { ToastProvider } from './state/ToastProvider.jsx';
import './styles/app.css';

// Apply saved theme early (prevents flash).
(() => {
  const themes = ['light', 'dark', 'sunset', 'midnight'];
  const stored = localStorage.getItem('cyber_theme') || 'midnight';
  const t = themes.includes(stored) ? stored : 'midnight';
  themes.forEach((name) => document.body.classList.remove(`theme-${name}`));
  document.body.classList.add(`theme-${t}`);
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
