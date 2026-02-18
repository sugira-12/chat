const SettingsPage = (() => {
  const accountForm = document.getElementById('accountForm');
  const accountStatus = document.getElementById('accountStatus');
  const changeForm = document.getElementById('changeForm');
  const changeStatus = document.getElementById('changeStatus');

  const settingsPrivate = document.getElementById('settingsPrivate');
  const settingsDmPrivacy = document.getElementById('settingsDmPrivacy');
  const settingsShowOnline = document.getElementById('settingsShowOnline');
  const privacySave = document.getElementById('privacySave');
  const settingsHideReads = document.getElementById('settingsHideReads');
  const settingsHideTyping = document.getElementById('settingsHideTyping');
  const settingsPrivateMode = document.getElementById('settingsPrivateMode');
  const settingsFocusMode = document.getElementById('settingsFocusMode');

  const settingsThemeMode = document.getElementById('settingsThemeMode');
  const appearanceSave = document.getElementById('appearanceSave');

  const notifyLike = document.getElementById('notifyLike');
  const notifyComment = document.getElementById('notifyComment');
  const notifyFollow = document.getElementById('notifyFollow');
  const notifyMessage = document.getElementById('notifyMessage');
  const notifyFriend = document.getElementById('notifyFriend');
  const notifySave = document.getElementById('notifySave');

  const passwordForm = document.getElementById('passwordForm');
  const passwordStatus = document.getElementById('passwordStatus');
  const blockedUsersList = document.getElementById('blockedUsersList');
  const sessionsList = document.getElementById('sessionsList');
  let refreshTimer = null;
  let loadInFlight = false;

  const toBool = (value) => value === true || value === 1 || value === '1';

  const resolveThemeMode = (settings) => {
    const mode = (settings?.theme_mode || '').toString().toLowerCase();
    if (['light', 'dark', 'sunset', 'midnight'].includes(mode)) {
      return mode;
    }
    return toBool(settings?.dark_mode) ? 'dark' : 'light';
  };

  const resolveDmPrivacy = (settings) => {
    const mode = (settings?.dm_privacy || '').toString().toLowerCase();
    if (['everyone', 'friends', 'nobody'].includes(mode)) {
      return mode;
    }
    return toBool(settings?.allow_message_requests) ? 'everyone' : 'friends';
  };

  const load = async () => {
    if (loadInFlight) return;
    loadInFlight = true;
    try {
      const data = await CyberApi.request('/settings');
      const user = data.user || {};
      const settings = data.settings || {};

      if (accountForm) {
        accountForm.name.value = user.name || '';
        accountForm.bio.value = user.bio || '';
        accountForm.website.value = user.website || '';
        accountForm.avatar_url.value = user.avatar_url || '';
        if (accountForm.cover_photo_url) {
          accountForm.cover_photo_url.value = user.cover_photo_url || '';
        }
      }

      if (settingsPrivate) settingsPrivate.checked = toBool(user.is_private);
      if (settingsDmPrivacy) settingsDmPrivacy.value = resolveDmPrivacy(settings);
      if (settingsShowOnline) settingsShowOnline.checked = toBool(settings.show_online);
      if (settingsHideReads) settingsHideReads.checked = toBool(settings.hide_read_receipts);
      if (settingsHideTyping) settingsHideTyping.checked = toBool(settings.hide_typing);
      if (settingsPrivateMode) settingsPrivateMode.checked = toBool(settings.private_mode);
      if (settingsFocusMode) settingsFocusMode.checked = toBool(settings.focus_mode);
      if (settingsThemeMode) settingsThemeMode.value = resolveThemeMode(settings);

      if (notifyLike) notifyLike.checked = toBool(settings.notify_like);
      if (notifyComment) notifyComment.checked = toBool(settings.notify_comment);
      if (notifyFollow) notifyFollow.checked = toBool(settings.notify_follow);
      if (notifyMessage) notifyMessage.checked = toBool(settings.notify_message);
      if (notifyFriend) notifyFriend.checked = toBool(settings.notify_friend_request);

      CyberStorage.set('user_settings', JSON.stringify(settings));
      if (window.CyberApp?.applyTheme) {
        window.CyberApp.applyTheme(settings);
      }
    } finally {
      loadInFlight = false;
    }
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    if (!accountForm) return;

    await CyberApi.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify({
        name: accountForm.name.value,
        bio: accountForm.bio.value,
        website: accountForm.website.value,
        avatar_url: accountForm.avatar_url.value,
        cover_photo_url: accountForm.cover_photo_url ? accountForm.cover_photo_url.value : '',
      }),
    });

    const avatarFileInput = accountForm.avatar_file;
    const coverFileInput = accountForm.cover_file;
    const hasAvatar = avatarFileInput && avatarFileInput.files && avatarFileInput.files.length > 0;
    const hasCover = coverFileInput && coverFileInput.files && coverFileInput.files.length > 0;
    if (hasAvatar || hasCover) {
      const token = CyberStorage.get('auth_token');
      const formData = new FormData();
      if (hasAvatar) formData.append('avatar', avatarFileInput.files[0]);
      if (hasCover) formData.append('cover', coverFileInput.files[0]);
      await fetch(`${window.CYBER_CONFIG.apiBaseUrl}/users/me/media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (avatarFileInput) avatarFileInput.value = '';
      if (coverFileInput) coverFileInput.value = '';
    }

    if (accountStatus) {
      accountStatus.textContent = 'Saved.';
    }
    await load();
  };

  const requestChange = async (event) => {
    event.preventDefault();
    if (!changeForm) return;

    const emailInput = changeForm.querySelector('#changeEmail');
    const usernameInput = changeForm.querySelector('#changeUsername');
    const newEmail = emailInput ? emailInput.value.trim() : '';
    const newUsername = usernameInput ? usernameInput.value.trim() : '';
    if (!newEmail && !newUsername) {
      if (changeStatus) {
        changeStatus.textContent = 'Enter email or username to change.';
      }
      return;
    }

    await CyberApi.request('/auth/request-account-change', {
      method: 'POST',
      body: JSON.stringify({
        email: newEmail || null,
        username: newUsername || null,
      }),
    });

    if (changeStatus) {
      changeStatus.textContent = 'Check your inbox for the confirmation link.';
    }
    changeForm.reset();
  };

  const savePrivacy = async () => {
    await CyberApi.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify({
        is_private: settingsPrivate?.checked ? 1 : 0,
      }),
    });

    await CyberApi.request('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        dm_privacy: settingsDmPrivacy?.value || 'everyone',
        show_online: settingsShowOnline?.checked ? 1 : 0,
        hide_read_receipts: settingsHideReads?.checked ? 1 : 0,
        hide_typing: settingsHideTyping?.checked ? 1 : 0,
        private_mode: settingsPrivateMode?.checked ? 1 : 0,
        focus_mode: settingsFocusMode?.checked ? 1 : 0,
      }),
    });

    await load();
    if (privacySave) {
      privacySave.textContent = 'Saved';
      setTimeout(() => {
        privacySave.textContent = 'Save privacy';
      }, 1200);
    }
  };

  const saveNotifications = async () => {
    await CyberApi.request('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        notify_like: notifyLike?.checked ? 1 : 0,
        notify_comment: notifyComment?.checked ? 1 : 0,
        notify_follow: notifyFollow?.checked ? 1 : 0,
        notify_message: notifyMessage?.checked ? 1 : 0,
        notify_friend_request: notifyFriend?.checked ? 1 : 0,
      }),
    });

    await load();
    if (notifySave) {
      notifySave.textContent = 'Saved';
      setTimeout(() => {
        notifySave.textContent = 'Save notifications';
      }, 1200);
    }
  };

  const saveAppearance = async () => {
    const themeMode = settingsThemeMode?.value || 'light';
    await CyberApi.request('/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme_mode: themeMode }),
    });

    if (window.CyberApp?.applyTheme) {
      window.CyberApp.applyTheme({ theme_mode: themeMode });
    }
    await load();
    if (appearanceSave) {
      appearanceSave.textContent = 'Saved';
      setTimeout(() => {
        appearanceSave.textContent = 'Save appearance';
      }, 1200);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!passwordForm) return;

    await CyberApi.request('/users/me/password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: passwordForm.currentPassword.value,
        password: passwordForm.newPassword.value,
        password_confirm: passwordForm.confirmPassword.value,
      }),
    });

    if (passwordStatus) {
      passwordStatus.textContent = 'Password updated.';
    }
    passwordForm.reset();
  };

  const loadBlockedUsers = async () => {
    if (!blockedUsersList) return;
    blockedUsersList.innerHTML = 'Loading...';
    try {
      const data = await CyberApi.request('/blocks');
      const items = data.items || [];
      if (!items.length) {
        blockedUsersList.innerHTML = '<p>No blocked users.</p>';
        return;
      }
      blockedUsersList.innerHTML = items.map((user) => {
        return `<div class="card" style="margin-top:10px; padding:12px;">
          <strong>${user.name || user.username}</strong>
          <div class="badge">@${user.username}</div>
          <div style="margin-top:8px;">
            <button class="btn btn--ghost" data-unblock-user="${user.id}">Unblock</button>
          </div>
        </div>`;
      }).join('');
    } catch (err) {
      blockedUsersList.innerHTML = '<p>Unable to load blocked users.</p>';
    }
  };

  const loadSessions = async () => {
    if (!sessionsList) return;
    sessionsList.innerHTML = 'Loading...';
    try {
      const data = await CyberApi.request('/sessions');
      const items = data.items || [];
      if (!items.length) {
        sessionsList.innerHTML = '<p>No active sessions.</p>';
        return;
      }
      sessionsList.innerHTML = items.map((session) => {
        return `<div class="card" style="margin-top:10px; padding:12px;">
          <div><strong>${session.ip_address || 'Unknown IP'}</strong></div>
          <div class="badge">${session.user_agent ? session.user_agent.slice(0, 40) : 'Unknown device'}</div>
          <div style="margin-top:6px; color:var(--muted); font-size:0.85rem;">Last seen ${session.last_seen_at}</div>
          <div style="margin-top:8px;">
            ${session.is_active ? `<button class="btn btn--ghost" data-revoke-session="${session.id}">Revoke</button>` : '<span class="badge">Inactive</span>'}
          </div>
        </div>`;
      }).join('');
    } catch (err) {
      sessionsList.innerHTML = '<p>Unable to load sessions.</p>';
    }
  };

  const bind = () => {
    if (accountForm) accountForm.addEventListener('submit', saveAccount);
    if (changeForm) changeForm.addEventListener('submit', requestChange);
    if (privacySave) privacySave.addEventListener('click', savePrivacy);
    if (notifySave) notifySave.addEventListener('click', saveNotifications);
    if (appearanceSave) appearanceSave.addEventListener('click', saveAppearance);
    if (passwordForm) passwordForm.addEventListener('submit', changePassword);
    if (blockedUsersList) {
      blockedUsersList.addEventListener('click', async (event) => {
        const id = event.target.getAttribute('data-unblock-user');
        if (!id) return;
        await CyberApi.request(`/users/${id}/unblock`, { method: 'POST' });
        await loadBlockedUsers();
      });
    }
    if (sessionsList) {
      sessionsList.addEventListener('click', async (event) => {
        const id = event.target.getAttribute('data-revoke-session');
        if (!id) return;
        await CyberApi.request(`/sessions/${id}/revoke`, { method: 'POST' });
        await loadSessions();
      });
    }
  };

  const init = async () => {
    await CyberApp.requireAuth();
    bind();
    await load();
    await loadBlockedUsers();
    await loadSessions();

    const canRefresh = () => document.visibilityState === 'visible';
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!canRefresh()) return;
      load().catch((err) => console.error(err));
      loadBlockedUsers().catch((err) => console.error(err));
      loadSessions().catch((err) => console.error(err));
    }, 20000);

    window.addEventListener('focus', () => {
      load().catch((err) => console.error(err));
      loadBlockedUsers().catch((err) => console.error(err));
      loadSessions().catch((err) => console.error(err));
    });
  };

  return { init };
})();

window.SettingsPage = SettingsPage;
