const CyberApp = (() => {
  const themes = ['light', 'dark', 'sunset', 'midnight'];

  const requireAuth = async () => {
    try {
      const data = await CyberApi.request('/auth/me');
      CyberStorage.set('auth_user', JSON.stringify(data.user));
      applyRoleVisibility(data.user);
      renderUserBadge(data.user);
      return data.user;
    } catch (err) {
      window.location.href = 'Login.html';
      throw err;
    }
  };

  const getUser = () => {
    const raw = CyberStorage.get('auth_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const applyRoleVisibility = (user = null) => {
    const current = user || getUser();
    const isAdmin = current && current.role === 'admin';
    const adminLinks = document.querySelectorAll('a[href="Admin.html"]');
    adminLinks.forEach((link) => {
      link.style.display = isAdmin ? 'flex' : 'none';
    });
  };

  const renderUserBadge = (user = null) => {
    const current = user || getUser();
    if (!current) return;

    const avatarEls = document.querySelectorAll('[data-user-avatar]');
    avatarEls.forEach((el) => {
      const url = current.avatar_url || '';
      if (url) {
        el.style.backgroundImage = `url('${url}')`;
        el.classList.add('avatar--photo');
      } else {
        el.style.backgroundImage = '';
        el.classList.remove('avatar--photo');
      }
    });

    const nameEls = document.querySelectorAll('[data-user-name]');
    nameEls.forEach((el) => {
      el.textContent = current.name || current.username || 'User';
    });

    const handleEls = document.querySelectorAll('[data-user-handle]');
    handleEls.forEach((el) => {
      el.textContent = current.username ? `@${current.username}` : '';
    });
  };

  const applyTheme = (settings) => {
    const input = settings || {};
    let mode = 'light';

    const explicit = typeof input === 'string' ? input.toLowerCase() : '';
    const fromSettings = typeof input.theme_mode === 'string' ? input.theme_mode.toLowerCase() : '';
    if (themes.includes(explicit)) {
      mode = explicit;
    } else if (themes.includes(fromSettings)) {
      mode = fromSettings;
    } else if (input.dark_mode === 1 || input.dark_mode === true || input.dark_mode === '1') {
      mode = 'dark';
    }

    themes.forEach((name) => {
      document.body.classList.remove(`theme-${name}`);
    });
    document.body.classList.add(`theme-${mode}`);
    document.documentElement.setAttribute('data-theme', mode);
  };

  const loadSettings = async () => {
    const token = CyberStorage.get('auth_token');
    if (!token) return;
    try {
      const cached = CyberStorage.get('user_settings');
      if (cached) {
        applyTheme(JSON.parse(cached));
      }
      const data = await CyberApi.request('/settings');
      CyberStorage.set('user_settings', JSON.stringify(data.settings || {}));
      applyTheme(data.settings);
      applyRoleVisibility(data.user || null);
      renderUserBadge(data.user || null);
    } catch (err) {
      // ignore on public pages
    }
  };

  const renderActiveAd = (ad) => {
    let container = document.getElementById('globalAdBanner');
    if (!container) {
      container = document.createElement('div');
      container.id = 'globalAdBanner';
      container.style.position = 'fixed';
      container.style.right = '16px';
      container.style.bottom = '16px';
      container.style.zIndex = '1200';
      container.style.maxWidth = '360px';
      document.body.appendChild(container);
    }

    if (!ad) {
      container.innerHTML = '';
      return;
    }

    const imageBlock = ad.image_url
      ? `<img src="${ad.image_url}" alt="Ad" style="width:100%; border-radius:12px; margin-bottom:8px;" />`
      : '';
    const bodyBlock = ad.body ? `<p style="margin:0; color:var(--muted);">${ad.body}</p>` : '';
    const linkBlock = ad.link_url
      ? `<a class="btn btn--primary" href="${ad.link_url}" target="_blank" rel="noopener" style="margin-top:8px;">Learn more</a>`
      : '';

    container.innerHTML = `
      <div class="card" style="padding:14px; border:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
          <strong>Sponsored</strong>
          <button type="button" class="btn btn--ghost" data-close-ad style="padding:4px 10px;">x</button>
        </div>
        ${imageBlock}
        <h4 style="margin:0 0 6px 0;">${ad.title || 'Sponsored ad'}</h4>
        ${bodyBlock}
        ${linkBlock}
      </div>
    `;

    const closeBtn = container.querySelector('[data-close-ad]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        container.innerHTML = '';
      });
    }
  };

  const loadActiveAd = async () => {
    const token = CyberStorage.get('auth_token');
    if (!token) return;
    try {
      const data = await CyberApi.request('/ads/active');
      const first = (data.items || [])[0] || null;
      renderActiveAd(first);
    } catch (err) {
      // Ignore ad fetch failures.
    }
  };

  const bindLogout = () => {
    const links = document.querySelectorAll('[data-logout]');
    links.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.CyberAuth) {
          window.CyberAuth.logout();
        }
      });
    });
  };

  const sendPresence = async (online = true) => {
    const token = CyberStorage.get('auth_token');
    if (!token) return;
    try {
      await CyberApi.request('/users/me/status', {
        method: 'POST',
        body: JSON.stringify({ online: online ? 1 : 0 }),
      });
    } catch (err) {
      // Ignore presence errors.
    }
  };

  const startPresence = () => {
    const token = CyberStorage.get('auth_token');
    if (!token) return;

    sendPresence(true);

    let timer = window.__cyberPresenceTimer;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      sendPresence(true);
    }, 60000);
    window.__cyberPresenceTimer = timer;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sendPresence(false);
      } else {
        sendPresence(true);
      }
    });

    window.addEventListener('beforeunload', () => {
      const token = CyberStorage.get('auth_token');
      if (!token) return;
      fetch(`${window.CYBER_CONFIG?.apiBaseUrl || ''}/users/me/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ online: 0 }),
        keepalive: true,
      }).catch(() => {});
    });
  };

  return {
    requireAuth,
    getUser,
    bindLogout,
    applyTheme,
    loadSettings,
    applyRoleVisibility,
    renderUserBadge,
    loadActiveAd,
    startPresence,
  };
})();

window.CyberApp = CyberApp;
window.addEventListener('DOMContentLoaded', () => {
  if (window.CyberApp) {
    const cached = window.CyberApp.getUser();
    if (cached) {
      window.CyberApp.renderUserBadge(cached);
      window.CyberApp.applyRoleVisibility(cached);
    }
    window.CyberApp.applyRoleVisibility();
    window.CyberApp.bindLogout();
    window.CyberApp.loadSettings();
    window.CyberApp.loadActiveAd();
    window.CyberApp.startPresence();
  }
});
