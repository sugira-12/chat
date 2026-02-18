const ConfirmAccountChangePage = (() => {
  const titleEl = document.getElementById('confirmTitle');
  const messageEl = document.getElementById('confirmMessage');
  const changesEl = document.getElementById('confirmChanges');

  const applyCachedTheme = () => {
    try {
      const raw = CyberStorage.get('user_settings');
      if (!raw) return;
      const settings = JSON.parse(raw);
      const toBool = (value) => value === true || value === 1 || value === '1';
      const theme = (settings?.theme_mode || '').toString().toLowerCase();
      const mode = ['light', 'dark', 'sunset', 'midnight'].includes(theme)
        ? theme
        : toBool(settings?.dark_mode)
          ? 'dark'
          : 'light';

      ['light', 'dark', 'sunset', 'midnight'].forEach((name) => {
        document.body.classList.remove(`theme-${name}`);
      });
      document.body.classList.add(`theme-${mode}`);
    } catch (error) {
      // Ignore theme cache errors for public page rendering.
    }
  };

  const renderSuccess = (changes) => {
    if (titleEl) titleEl.textContent = 'Account changes confirmed';
    if (messageEl) messageEl.textContent = 'Your profile updates are now active.';

    const items = [];
    if (changes?.email) {
      items.push(`<div><strong>Email:</strong> ${changes.email}</div>`);
    }
    if (changes?.username) {
      items.push(`<div><strong>Username:</strong> ${changes.username}</div>`);
    }

    if (changesEl) {
      if (items.length > 0) {
        changesEl.style.display = 'grid';
        changesEl.innerHTML = items.join('');
      } else {
        changesEl.style.display = 'none';
      }
    }
  };

  const renderError = (message) => {
    if (titleEl) titleEl.textContent = 'Confirmation failed';
    if (messageEl) messageEl.textContent = message || 'This link is invalid or expired.';
    if (changesEl) {
      changesEl.style.display = 'none';
    }
  };

  const init = async () => {
    applyCachedTheme();

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      renderError('Missing token in URL.');
      return;
    }

    try {
      const data = await CyberApi.request(`/auth/confirm-account-change?token=${encodeURIComponent(token)}`);
      renderSuccess(data?.changes || null);
    } catch (error) {
      renderError(error?.error || 'This link is invalid or expired.');
    }
  };

  return { init };
})();

window.ConfirmAccountChangePage = ConfirmAccountChangePage;
window.addEventListener('DOMContentLoaded', () => {
  window.ConfirmAccountChangePage.init();
});
