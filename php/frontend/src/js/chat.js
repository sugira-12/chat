const CyberChat = (() => {
  const config = window.CYBER_CONFIG || {};

  let pusher = null;
  let channel = null;
  let userChannel = null;
  let currentConversationId = null;

  let messagePollTimer = null;
  let conversationPollTimer = null;
  let typingPollTimer = null;
  let requestsPollTimer = null;
  let activeUsersTimer = null;

  let renderedMessageIds = new Set();
  let lastMessageId = 0;
  let typingRequestLock = false;
  let latestConversations = [];
  let replyToMessageId = null;
  let messagesLoading = false;
  let conversationsLoading = false;
  let requestsLoading = false;
  let activeUsersLoading = false;
  let typingLoading = false;

  const placeholderKeys = ['PUSHER_KEY', 'YOUR_PUSHER_KEY', ''];

  const requestsBox = document.getElementById('messageRequestsBox');
  const chatSearchInput = document.getElementById('chatSearchInput');
  const activeUsersList = document.getElementById('activeUsersList');

  const userPicker = document.getElementById('chatUserPicker');
  const userSearchInput = document.getElementById('chatUserSearch');
  const userSearchResults = document.getElementById('chatUserResults');
  const userPickerClose = document.getElementById('chatUserClose');
  const scopeButtons = document.querySelectorAll('[data-chat-scope]');
  let searchScope = 'friends';
  let blockedIds = new Set();

  const replyPreview = document.getElementById('chatReplyPreview');
  const aiHints = document.getElementById('chatAiHints');
  const attachInput = document.getElementById('chatAttachment');
  const attachBtn = document.querySelector('[data-chat-attach]');
  const recordBtn = document.querySelector('[data-chat-record]');
  const pinBtn = document.querySelector('[data-chat-pin]');
  const muteBtn = document.querySelector('[data-chat-mute]');
  const summaryBtn = document.querySelector('[data-chat-summary]');
  const disappearSelect = document.getElementById('chatDisappear');
  const scheduleInput = document.getElementById('chatSchedule');

  const hasRealtime = () => {
    const key = (config.pusherKey || '').trim();
    if (placeholderKeys.includes(key)) {
      return false;
    }
    return typeof window.Pusher !== 'undefined';
  };

  const escapeHtml = (value) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const normalizeMessage = (message) => {
    const id = Number(message.id || message.message_id || 0);
    return {
      ...message,
      id,
      message_id: id,
      sender_id: Number(message.sender_id || 0),
    };
  };

  const messageTime = (message) => {
    const raw = message.created_at ? new Date(message.created_at) : new Date();
    if (Number.isNaN(raw.getTime())) {
      return new Date().toLocaleTimeString();
    }
    return raw.toLocaleTimeString();
  };

  const conversationTime = (value) => {
    if (!value) return '';
    const raw = new Date(value);
    if (Number.isNaN(raw.getTime())) return '';
    return raw.toLocaleTimeString();
  };

  const renderTypingIndicator = (users) => {
    const indicator = document.querySelector('[data-chat-typing]');
    if (!indicator) return;

    if (!users || users.length === 0) {
      indicator.classList.remove('is-visible');
      indicator.textContent = 'Typing...';
      return;
    }

    const names = users.map((u) => u.name || u.username || 'Someone').slice(0, 2);
    const label = names.length > 1 ? `${names.join(', ')} are typing...` : `${names[0]} is typing...`;
    indicator.textContent = label;
    indicator.classList.add('is-visible');

    clearTimeout(window.__typingTimer);
    window.__typingTimer = setTimeout(() => {
      indicator.classList.remove('is-visible');
      indicator.textContent = 'Typing...';
    }, 1800);
  };

  const renderMessage = (message) => {
    const list = document.querySelector('[data-chat-messages]');
    if (!list) return;

    const normalized = normalizeMessage(message);
    if (normalized.id && renderedMessageIds.has(normalized.id)) {
      return;
    }
    if (normalized.id) {
      renderedMessageIds.add(normalized.id);
      lastMessageId = Math.max(lastMessageId, normalized.id);
    }

    const own = Number(normalized.sender_id) === Number(config.userId);
    const wrapper = document.createElement('div');
    wrapper.className = own ? 'chat-message chat-message--own' : 'chat-message';
    wrapper.dataset.messageId = String(normalized.id || '');

    const deleted = normalized.deleted_at || (normalized.body === null && !normalized.media_url);
    const bodyText = deleted ? '<em>Message deleted</em>' : escapeHtml(normalized.body || '');
    const editedLabel = normalized.edited_at ? `<button class="chat-meta-pill" data-edits="${normalized.id}">Edited</button>` : '';
    const replyBlock = normalized.reply_body
      ? `<div class="chat-reply-inline">Reply to ${escapeHtml(normalized.reply_username || 'User')}: ${escapeHtml(normalized.reply_body)}</div>`
      : '';
    let mediaBlock = '';
    if (normalized.media_url) {
      if (normalized.media_type === 'image') {
        mediaBlock = `<img class="chat-media" src="${normalized.media_url}" alt="attachment" />`;
      } else if (normalized.media_type === 'video') {
        mediaBlock = `<video class="chat-media" controls src="${normalized.media_url}"></video>`;
      } else if (normalized.media_type === 'audio') {
        mediaBlock = `<audio controls src="${normalized.media_url}"></audio>`;
      } else {
        mediaBlock = `<a href="${normalized.media_url}" target="_blank" rel="noopener">Download file</a>`;
      }
    }

    const readCount = Number(normalized.read_count || 0);
    const status = own
      ? `<span class="chat-status">${readCount > 0 ? 'Read' : 'Delivered'}</span>`
      : '';
    const avatar = normalized.avatar_url
      ? `<img class="chat-message__avatar" src="${normalized.avatar_url}" alt="${escapeHtml(normalized.username || 'User')}" />`
      : '<div class="chat-message__avatar"></div>';
    wrapper.innerHTML = `
      ${avatar}
      <div class="chat-message__body">
        ${replyBlock}
        <div class="chat-message__text">${bodyText}</div>
        ${mediaBlock}
        <div class="chat-message__meta">${messageTime(normalized)} ${editedLabel} ${status}</div>
        <div class="chat-reactions"></div>
        <div class="chat-message__actions">
          <button class="btn btn--ghost" data-reply="${normalized.id}">Reply</button>
          <button class="btn btn--ghost" data-react="${normalized.id}" data-emoji="👍">👍</button>
          ${own ? `<button class="btn btn--ghost" data-edit="${normalized.id}">Edit</button>` : ''}
          ${own ? `<button class="btn btn--ghost" data-delete="${normalized.id}" data-scope="all">Delete</button>` : `<button class="btn btn--ghost" data-delete="${normalized.id}" data-scope="self">Delete</button>`}
        </div>
      </div>
    `;

    list.appendChild(wrapper);
    list.scrollTop = list.scrollHeight;
  };

  const renderConversation = (conversation) => {
    const item = document.createElement('button');
    item.className = 'chat-item';
    item.type = 'button';
    item.dataset.conversationId = String(conversation.id);

    const title = conversation.type === 'group'
      ? (conversation.title || 'Group Chat')
      : (conversation.direct_username || 'Direct chat');

    item.dataset.title = title;
    const preview = conversation.last_message || 'No messages yet';
    const when = conversationTime(conversation.last_message_at);
    const unreadCount = Number(conversation.unread_count || 0);
    const unreadBadge = unreadCount > 0 ? `<span class="badge badge--pill">${unreadCount}</span>` : '';
    const pinned = conversation.pinned_at ? '<span class="badge badge--pill">Pinned</span>' : '';
    const muted = conversation.muted_until ? '<span class="badge badge--pill">Muted</span>' : '';
    let trust = '';
    if (conversation.direct_created_at) {
      const created = new Date(conversation.direct_created_at);
      const days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (days < 7) {
        trust = '<span class="badge badge--warn">New account</span>';
      }
    }
    const spam = /(free|win|verify|password|crypto|loan|cash|click)/i.test(preview || '')
      ? '<span class="badge badge--warn">Spam risk</span>'
      : '';
    const avatar = conversation.direct_avatar
      ? `<img class="chat-item__avatar" src="${conversation.direct_avatar}" alt="${escapeHtml(title)}" />`
      : `<div class="chat-item__avatar"></div>`;
    item.innerHTML = `
      ${avatar}
      <div class="chat-item__body">
        <div class="chat-item__row">
          <strong>${escapeHtml(title)}</strong>
          <span class="chat-item__time">${when}</span>
        </div>
        <p>${escapeHtml(preview)}</p>
        <div class="chat-item__badges">${pinned}${muted}${trust}${spam}</div>
      </div>
      ${unreadBadge}
    `;

    if (Number(conversation.id) === Number(currentConversationId)) {
      item.classList.add('active');
    }

    return item;
  };

  const setSearchScope = (scope) => {
    searchScope = scope === 'all' ? 'all' : 'friends';
    scopeButtons.forEach((button) => {
      const active = button.getAttribute('data-chat-scope') === searchScope;
      button.classList.toggle('is-active', active);
    });
    if (userSearchInput) {
      userSearchInput.placeholder = searchScope === 'all'
        ? 'Search people by name or ID'
        : 'Type friend name or ID';
    }
  };

  const renderActiveUser = (user) => {
    const blocked = blockedIds.has(Number(user.id));
    const avatar = user.avatar_url
      ? `<img class="avatar avatar--sm" src="${user.avatar_url}" alt="${escapeHtml(user.username || 'User')}" />`
      : '<div class="avatar avatar--sm"></div>';
    const messageBtn = blocked
      ? ''
      : `<button class="btn btn--ghost" data-active-chat="${user.id}">Message</button>`;
    const blockBtn = blocked
      ? `<button class="btn btn--ghost" data-unblock-user="${user.id}">Unblock</button>`
      : `<button class="btn btn--ghost" data-block-user="${user.id}">Block</button>`;

    return `
      <div class="active-user">
        <div class="active-user__info">
          ${avatar}
          <div>
            <strong>${escapeHtml(user.name || user.username)}</strong>
            <div class="badge">@${escapeHtml(user.username)}</div>
          </div>
        </div>
        <div class="active-user__actions">
          ${messageBtn}
          ${blockBtn}
        </div>
      </div>
    `;
  };

  const loadBlockedUsers = async () => {
    try {
      const data = await CyberApi.request('/blocks');
      const items = data.items || [];
      blockedIds = new Set(items.map((u) => Number(u.id)));
    } catch (err) {
      blockedIds = new Set();
    }
  };

  const loadActiveUsers = async () => {
    if (!activeUsersList) return;
    if (activeUsersLoading) return;
    activeUsersLoading = true;
    activeUsersList.innerHTML = 'Loading...';
    try {
      const data = await CyberApi.request('/users/active?limit=12');
      const items = data.items || [];
      if (!items.length) {
        activeUsersList.innerHTML = '<p>No active users right now.</p>';
        return;
      }
      activeUsersList.innerHTML = items.map((user) => renderActiveUser(user)).join('');
    } catch (err) {
      activeUsersList.innerHTML = '<p>Unable to load active users.</p>';
    } finally {
      activeUsersLoading = false;
    }
  };

  const renderConversations = (items) => {
    const list = document.querySelector('[data-chat-list]');
    if (!list) return;

    if (!items.length) {
      list.innerHTML = '<div class="chat-item">No conversations yet.</div>';
      return;
    }

    list.innerHTML = '';
    items.forEach((conversation) => {
      list.appendChild(renderConversation(conversation));
    });
  };

  const highlightActiveConversation = () => {
    const list = document.querySelector('[data-chat-list]');
    if (!list) return;

    list.querySelectorAll('[data-conversation-id]').forEach((el) => {
      const isActive = Number(el.dataset.conversationId) === Number(currentConversationId);
      el.classList.toggle('active', isActive);
    });
  };

  const updateHeaderTitle = () => {
    const headerTitle = document.querySelector('[data-chat-title]');
    const active = document.querySelector(`[data-conversation-id="${currentConversationId}"]`);
    if (!headerTitle) return;
    headerTitle.textContent = active?.dataset.title || 'Conversation';
  };

  const updateHeaderActions = () => {
    const current = latestConversations.find((c) => Number(c.id) === Number(currentConversationId));
    if (pinBtn) {
      pinBtn.textContent = current?.pinned_at ? 'Unpin' : 'Pin';
    }
    if (muteBtn) {
      muteBtn.textContent = current?.muted_until ? 'Unmute' : 'Mute';
    }
  };

  const updatePrivacyBadge = () => {
    const badge = document.querySelector('[data-chat-privacy]');
    if (!badge) return;
    let settings = {};
    try {
      settings = JSON.parse(CyberStorage.get('user_settings') || '{}');
    } catch (e) {
      settings = {};
    }
    const labels = ['E2E Ready'];
    if (Number(settings.private_mode) === 1) {
      labels.push('Private Mode');
    }
    if (Number(settings.focus_mode) === 1) {
      labels.push('Focus');
    }
    badge.textContent = labels.join(' · ');
  };

  const markLastIncomingAsRead = async (messages) => {
    if (!messages || !messages.length) return;

    const incoming = [...messages]
      .map((m) => normalizeMessage(m))
      .reverse()
      .find((m) => Number(m.sender_id) !== Number(config.userId));

    if (!incoming || !incoming.id) {
      return;
    }

    try {
      await CyberApi.request(`/messages/${incoming.id}/read`, { method: 'POST' });
    } catch (err) {
      // Ignore read-receipt failures to avoid breaking chat flow.
    }
  };

  const fetchMessages = async (conversationId) => {
    const list = document.querySelector('[data-chat-messages]');
    if (!list) return;
    if (messagesLoading) return;
    messagesLoading = true;

    renderedMessageIds = new Set();
    lastMessageId = 0;
    list.innerHTML = '';

    try {
      const data = await CyberApi.request(`/conversations/${conversationId}/messages?limit=100`);
      (data.items || []).forEach((message) => renderMessage(message));
      await markLastIncomingAsRead(data.items || []);
    } finally {
      messagesLoading = false;
    }
  };

  const fetchNewMessages = async () => {
    if (!currentConversationId) return;
    if (messagesLoading) return;
    messagesLoading = true;

    const query = lastMessageId > 0 ? `?after_id=${lastMessageId}&limit=50` : '?limit=50';
    try {
      const data = await CyberApi.request(`/conversations/${currentConversationId}/messages${query}`);
      const items = data.items || [];
      if (!items.length) {
        return;
      }

      items.forEach((message) => renderMessage(message));
      await markLastIncomingAsRead(items);
    } finally {
      messagesLoading = false;
    }
  };

  const fetchTypingState = async () => {
    if (!currentConversationId) return;
    if (typingLoading) return;
    typingLoading = true;

    try {
      const data = await CyberApi.request(`/conversations/${currentConversationId}/typing`);
      renderTypingIndicator(data.users || []);
    } catch (err) {
      // Ignore intermittent typing-state failures.
    } finally {
      typingLoading = false;
    }
  };

  const ensureRealtime = () => {
    if (!hasRealtime()) {
      return false;
    }

    if (!pusher) {
      const token = CyberStorage.get('auth_token');
      pusher = new Pusher(config.pusherKey, {
        cluster: config.pusherCluster,
        authEndpoint: `${config.apiBaseUrl}/realtime/auth`,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      pusher.connection.bind('error', () => {
        // Keep polling fallback when realtime fails.
      });
    }

    if (!userChannel && config.userId) {
      userChannel = pusher.subscribe(`private-user.${config.userId}`);
      userChannel.bind('message.read', (payload) => {
        const messageEl = document.querySelector(`[data-message-id="${payload.message_id}"]`);
        if (messageEl) {
          const status = messageEl.querySelector('.chat-status');
          if (status) status.textContent = 'Read';
        }
      });
    }

    return true;
  };

  const subscribeConversation = (conversationId) => {
    if (!ensureRealtime()) {
      return;
    }

    if (channel) {
      pusher.unsubscribe(channel.name);
      channel = null;
    }

    channel = pusher.subscribe(`private-conversation.${conversationId}`);

    channel.bind('message.sent', (payload) => {
      const message = normalizeMessage(payload);
      if (Number(message.conversation_id) !== Number(currentConversationId)) {
        loadConversations().catch(() => {});
        return;
      }

      renderTypingIndicator([]);
      renderMessage(message);
      markLastIncomingAsRead([message]).catch(() => {});
      loadConversations().catch(() => {});
    });

    channel.bind('typing', (payload) => {
      if (Number(payload.user_id) === Number(config.userId)) {
        return;
      }
      renderTypingIndicator([
        {
          id: payload.user_id,
          username: payload.username || 'User',
          name: payload.username || 'User',
        },
      ]);
    });
  };

  const startPolling = () => {
    if (messagePollTimer) clearInterval(messagePollTimer);
    if (conversationPollTimer) clearInterval(conversationPollTimer);
    if (typingPollTimer) clearInterval(typingPollTimer);
    if (requestsPollTimer) clearInterval(requestsPollTimer);
    if (activeUsersTimer) clearInterval(activeUsersTimer);
    const canRefresh = () => document.visibilityState === 'visible';

    messagePollTimer = setInterval(() => {
      if (!canRefresh()) return;
      fetchNewMessages().catch(() => {});
    }, 1800);

    conversationPollTimer = setInterval(() => {
      if (!canRefresh()) return;
      loadConversations().catch(() => {});
    }, 5000);

    typingPollTimer = setInterval(() => {
      if (!canRefresh()) return;
      fetchTypingState().catch(() => {});
    }, 1500);

    requestsPollTimer = setInterval(() => {
      if (!canRefresh()) return;
      loadMessageRequests().catch(() => {});
    }, 5000);

    activeUsersTimer = setInterval(() => {
      if (!canRefresh()) return;
      loadActiveUsers().catch(() => {});
    }, 12000);
  };

  const loadConversations = async () => {
    if (conversationsLoading) return;
    conversationsLoading = true;
    const data = await CyberApi.request('/conversations');
    try {
      const items = data.items || [];
      latestConversations = items;

      const filtered = filterConversations(items, chatSearchInput?.value || '');
      renderConversations(filtered);

      if (!items.length) {
        currentConversationId = null;
        return;
      }

      const stillExists = items.some((c) => Number(c.id) === Number(currentConversationId));
      if (!currentConversationId || !stillExists) {
        await openConversation(Number(items[0].id));
        return;
      }

      highlightActiveConversation();
      updateHeaderTitle();
      updateHeaderActions();
    } finally {
      conversationsLoading = false;
    }
  };

  const filterConversations = (items, query) => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return items;

    return items.filter((conversation) => {
      const title = conversation.type === 'group'
        ? (conversation.title || '')
        : (conversation.direct_username || '');
      const haystack = `${title} ${conversation.last_message || ''} ${conversation.id}`.toLowerCase();
      return haystack.includes(q);
    });
  };

  const openConversation = async (conversationId) => {
    currentConversationId = Number(conversationId);
    highlightActiveConversation();
    updateHeaderTitle();
    updateHeaderActions();

    await fetchMessages(currentConversationId);
    clearReplyContext();
    subscribeConversation(currentConversationId);
    startPolling();
  };

  const sendMessage = async (body) => {
    if (!currentConversationId) return;

    try {
      const scheduledAt = scheduleInput?.value || null;
      const expiresIn = disappearSelect ? Number(disappearSelect.value || 0) : 0;
      const response = await CyberApi.request(`/conversations/${currentConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body,
          type: 'text',
          reply_to: replyToMessageId || null,
          scheduled_at: scheduledAt || null,
          expires_in: expiresIn || 0,
        }),
      });

      if (response?.message) {
        renderMessage(response.message);
      }

      renderTypingIndicator([]);
      clearReplyContext();
      if (scheduleInput) scheduleInput.value = '';
      await loadConversations();
    } catch (err) {
      if (err?.error) {
        alert(err.error);
      }
      throw err;
    }
  };

  const setTyping = async () => {
    if (!currentConversationId || typingRequestLock) {
      return;
    }

    typingRequestLock = true;
    try {
      await CyberApi.request(`/conversations/${currentConversationId}/typing`, { method: 'POST' });
    } catch (err) {
      // Ignore typing errors.
    } finally {
      setTimeout(() => {
        typingRequestLock = false;
      }, 900);
    }
  };

  const loadMessageRequests = async () => {
    if (!requestsBox) return;
    if (requestsLoading) return;
    requestsLoading = true;

    try {
      const data = await CyberApi.request('/message-requests');
      const incoming = data.incoming || [];
      const sent = data.sent || [];

      if (!incoming.length && !sent.length) {
        requestsBox.style.display = 'none';
        requestsBox.innerHTML = '';
        return;
      }

      requestsBox.style.display = 'block';
      let html = '<h3 style="margin-bottom:10px;">Message requests</h3>';

      if (incoming.length) {
        html += '<strong>Incoming</strong>';
        html += incoming.map((item) => {
          const avatar = item.avatar_url
            ? `<img class="avatar avatar--sm" src="${item.avatar_url}" alt="${escapeHtml(item.username || 'User')}" />`
            : '<div class="avatar avatar--sm"></div>';
          return `<div class="card" style="margin-top:8px; padding:12px;">
            <div class="card__row">
              ${avatar}
              <div>
                <strong>${escapeHtml(item.name || item.username)}</strong>
                <div class="badge">@${escapeHtml(item.username)}</div>
              </div>
            </div>
            <div style="font-size:0.86rem; color:var(--muted); margin-top:4px;">${escapeHtml(item.last_message || 'Started a new conversation')}</div>
            <div style="margin-top:8px; display:flex; gap:8px;">
              <button class="btn btn--primary" data-accept-request="${item.id}">Accept</button>
              <button class="btn btn--ghost" data-deny-request="${item.id}">Deny</button>
            </div>
          </div>`;
        }).join('');
      }

      if (sent.length) {
        html += '<strong style="display:block; margin-top:10px;">Sent</strong>';
        html += sent.map((item) => {
          const avatar = item.avatar_url
            ? `<img class="avatar avatar--sm" src="${item.avatar_url}" alt="${escapeHtml(item.username || 'User')}" />`
            : '<div class="avatar avatar--sm"></div>';
          return `<div class="card" style="margin-top:8px; padding:12px;">
            <div class="card__row">
              ${avatar}
              <div>
                <strong>${escapeHtml(item.name || item.username)}</strong>
                <div class="badge">@${escapeHtml(item.username)}</div>
              </div>
            </div>
            <div style="font-size:0.86rem; color:var(--muted); margin-top:4px;">Awaiting response</div>
          </div>`;
        }).join('');
      }

      requestsBox.innerHTML = html;
    } finally {
      requestsLoading = false;
    }
  };

  const openUserPicker = () => {
    if (!userPicker) return;
    userPicker.classList.add('is-visible');
    if (userSearchInput) {
      userSearchInput.value = '';
      userSearchInput.focus();
    }
    if (userSearchResults) {
      userSearchResults.innerHTML = '<p>Search for someone to start a chat.</p>';
    }
    setSearchScope(searchScope);
  };

  const closeUserPicker = () => {
    if (!userPicker) return;
    userPicker.classList.remove('is-visible');
  };

  const searchUsers = async (term) => {
    if (!userSearchResults) return;
    const query = term.trim();
    const minLength = searchScope === 'all' ? 2 : 1;
    if (query.length < minLength) {
      userSearchResults.innerHTML = searchScope === 'all'
        ? '<p>Type at least 2 characters.</p>'
        : '<p>Type a name or ID.</p>';
      return;
    }

    try {
      let items = [];
      if (searchScope === 'friends') {
        const data = await CyberApi.request(`/search/friends?q=${encodeURIComponent(query)}&limit=20`);
        items = data.items || [];
      } else {
        const data = await CyberApi.request(`/search?q=${encodeURIComponent(query)}&limit=12`);
        items = data.users || [];
      }

      items = items.filter((user) => Number(user.id) !== Number(config.userId));
      if (!items.length) {
        userSearchResults.innerHTML = searchScope === 'friends'
          ? '<p>No friends found.</p>'
          : '<p>No users found.</p>';
        return;
      }

      userSearchResults.innerHTML = items.map((user) => {
        const avatar = user.avatar_url
          ? `<img class="avatar avatar--sm" src="${user.avatar_url}" alt="${escapeHtml(user.username || 'User')}" />`
          : '<div class="avatar avatar--sm"></div>';
        const blocked = blockedIds.has(Number(user.id));
        const action = blocked
          ? `<button class="btn btn--ghost" data-unblock-user="${user.id}">Unblock</button>`
          : `<button class="btn btn--primary" data-pick-user="${user.id}">Start chat</button>`;
        return `<div class="chat-item" style="width:100%; margin-bottom:8px;">
          <div class="card__row">
            ${avatar}
            <div>
              <strong>${escapeHtml(user.name || user.username)}</strong>
              <p>@${escapeHtml(user.username)} - ID ${user.id}</p>
            </div>
          </div>
          <div style="margin-top:8px; display:flex; gap:8px;">${action}</div>
        </div>`;
      }).join('');
    } catch (err) {
      userSearchResults.innerHTML = '<p>Search failed. Try again.</p>';
    }
  };

  const startDirectConversation = async (userId) => {
    const result = await CyberApi.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'direct', user_id: Number(userId) }),
    });

    closeUserPicker();
    await loadConversations();
    if (result?.conversation_id) {
      await openConversation(Number(result.conversation_id));
    }
  };

  const setReplyContext = (messageId, previewText) => {
    replyToMessageId = Number(messageId);
    if (!replyPreview) return;
    replyPreview.style.display = 'block';
    replyPreview.innerHTML = `
      <div><strong>Replying to:</strong> ${escapeHtml(previewText || '')}</div>
      <button class="btn btn--ghost" data-reply-cancel>Cancel</button>
    `;
  };

  const clearReplyContext = () => {
    replyToMessageId = null;
    if (replyPreview) {
      replyPreview.style.display = 'none';
      replyPreview.innerHTML = '';
    }
  };

  const sendAttachment = async (file) => {
    if (!currentConversationId || !file) return;
    const token = CyberStorage.get('auth_token');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${config.apiBaseUrl}/conversations/${currentConversationId}/messages/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json();
      throw err;
    }
    const data = await response.json();
    if (data?.message) {
      renderMessage(data.message);
    }
  };

  let aiTimer = null;
  const updateAiHints = (text) => {
    if (!aiHints) return;
    clearTimeout(aiTimer);
    const message = text.trim();
    if (message.length < 3) {
      aiHints.innerHTML = '';
      return;
    }
    aiTimer = setTimeout(async () => {
      try {
        const [suggest, tone, phishing, reminder] = await Promise.all([
          CyberApi.request('/ai/suggest-replies', { method: 'POST', body: JSON.stringify({ message }) }),
          CyberApi.request('/ai/tone-check', { method: 'POST', body: JSON.stringify({ message }) }),
          CyberApi.request('/ai/phishing-check', { method: 'POST', body: JSON.stringify({ message }) }),
          CyberApi.request('/ai/reminder', { method: 'POST', body: JSON.stringify({ message }) }),
        ]);

        let html = '';
        if (tone?.warning) {
          html += `<div class="badge badge--warn">${escapeHtml(tone.warning)}</div>`;
        }
        if (phishing?.warning) {
          html += `<div class="badge badge--warn">${escapeHtml(phishing.warning)}</div>`;
        }
        if (reminder?.reminder?.hint) {
          html += `<div class="badge badge--pill">${escapeHtml(reminder.reminder.hint)}</div>`;
        }
        if (suggest?.suggestions?.length) {
          const chips = suggest.suggestions.map((s) => `<button class="chip" data-ai-reply="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('');
          html += `<div class="chat-ai__suggestions">${chips}</div>`;
        }
        aiHints.innerHTML = html;
      } catch (err) {
        aiHints.innerHTML = '';
      }
    }, 500);
  };

  const bindUI = () => {
    const list = document.querySelector('[data-chat-list]');
    if (list) {
      list.addEventListener('click', (event) => {
        const target = event.target.closest('[data-conversation-id]');
        if (!target) return;

        const id = Number(target.dataset.conversationId);
        if (!id || id === currentConversationId) return;
        openConversation(id).catch((err) => console.error(err));
      });
    }

    const messageList = document.querySelector('[data-chat-messages]');
    if (messageList) {
      messageList.addEventListener('dragover', (event) => {
        event.preventDefault();
      });
      messageList.addEventListener('drop', async (event) => {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        try {
          await sendAttachment(file);
        } catch (err) {
          alert(err?.error || 'Unable to send attachment.');
        }
      });
      messageList.addEventListener('click', async (event) => {
        const replyBtn = event.target.closest('[data-reply]');
        const reactBtn = event.target.closest('[data-react]');
        const editBtn = event.target.closest('[data-edit]');
        const deleteBtn = event.target.closest('[data-delete]');
        const cancelBtn = event.target.closest('[data-reply-cancel]');
        const editsBtn = event.target.closest('[data-edits]');

        if (cancelBtn) {
          clearReplyContext();
          return;
        }

        if (editsBtn) {
          const data = await CyberApi.request(`/messages/${editsBtn.dataset.edits}/edits`);
          const items = data.items || [];
          if (!items.length) {
            alert('No edit history.');
            return;
          }
          const latest = items[0];
          alert(`Last edit: ${latest.body}`);
          return;
        }

        if (replyBtn) {
          const messageEl = event.target.closest('.chat-message');
          const text = messageEl?.querySelector('.chat-message__text')?.textContent || '';
          setReplyContext(replyBtn.dataset.reply, text);
          return;
        }

        if (reactBtn) {
          await CyberApi.request(`/messages/${reactBtn.dataset.react}/reactions`, {
            method: 'POST',
            body: JSON.stringify({ emoji: reactBtn.dataset.emoji || '👍' }),
          });
          const messageEl = event.target.closest('.chat-message');
          const reactions = messageEl?.querySelector('.chat-reactions');
          if (reactions) {
            reactions.textContent = `${reactBtn.dataset.emoji || '👍'}`;
          }
          return;
        }

        if (editBtn) {
          const messageEl = event.target.closest('.chat-message');
          const current = messageEl?.querySelector('.chat-message__text')?.textContent || '';
          const next = window.prompt('Edit message:', current);
          if (next && next.trim() !== '') {
            await CyberApi.request(`/messages/${editBtn.dataset.edit}`, {
              method: 'PUT',
              body: JSON.stringify({ body: next.trim() }),
            });
            await fetchMessages(currentConversationId);
          }
          return;
        }

        if (deleteBtn) {
          const scope = deleteBtn.dataset.scope || 'self';
          await CyberApi.request(`/messages/${deleteBtn.dataset.delete}?scope=${encodeURIComponent(scope)}`, {
            method: 'DELETE',
          });
          await fetchMessages(currentConversationId);
        }
      });
    }

    if (requestsBox) {
      requestsBox.addEventListener('click', async (event) => {
        const acceptId = event.target.getAttribute('data-accept-request');
        const denyId = event.target.getAttribute('data-deny-request');
        if (acceptId) {
          await CyberApi.request(`/message-requests/${acceptId}/accept`, { method: 'POST' });
          await Promise.all([loadMessageRequests(), loadConversations()]);
        }
        if (denyId) {
          await CyberApi.request(`/message-requests/${denyId}/deny`, { method: 'POST' });
          await loadMessageRequests();
        }
      });
    }

    const newChatBtn = document.querySelector('[data-new-chat]');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        openUserPicker();
      });
    }

    if (userPickerClose) {
      userPickerClose.addEventListener('click', () => closeUserPicker());
    }

    if (userPicker) {
      userPicker.addEventListener('click', (event) => {
        if (event.target === userPicker) {
          closeUserPicker();
        }
      });
    }

    if (scopeButtons && scopeButtons.length) {
      scopeButtons.forEach((button) => {
        button.addEventListener('click', () => {
          setSearchScope(button.getAttribute('data-chat-scope'));
          if (userSearchResults) {
            userSearchResults.innerHTML = '<p>Search for someone to start a chat.</p>';
          }
        });
      });
    }

    if (userSearchInput) {
      let timer = null;
      userSearchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          searchUsers(userSearchInput.value).catch((err) => console.error(err));
        }, 280);
      });
    }

    if (userSearchResults) {
      userSearchResults.addEventListener('click', (event) => {
        const pick = event.target.closest('[data-pick-user]');
        if (pick) {
          startDirectConversation(Number(pick.dataset.pickUser)).catch((err) => {
            console.error(err);
            alert(err?.error || 'Unable to start chat.');
          });
          return;
        }

        const unblock = event.target.closest('[data-unblock-user]');
        if (unblock) {
          CyberApi.request(`/users/${unblock.dataset.unblockUser}/unblock`, { method: 'POST' })
            .then(async () => {
              await loadBlockedUsers();
              await loadActiveUsers();
              searchUsers(userSearchInput?.value || '').catch(() => {});
            })
            .catch(() => {});
        }
      });
    }

    if (activeUsersList) {
      activeUsersList.addEventListener('click', (event) => {
        const chat = event.target.closest('[data-active-chat]');
        const block = event.target.closest('[data-block-user]');
        const unblock = event.target.closest('[data-unblock-user]');

        if (chat) {
          startDirectConversation(Number(chat.dataset.activeChat)).catch((err) => {
            console.error(err);
            alert(err?.error || 'Unable to start chat.');
          });
        }

        if (block) {
          CyberApi.request(`/users/${block.dataset.blockUser}/block`, { method: 'POST' })
            .then(async () => {
              await loadBlockedUsers();
              await loadActiveUsers();
            })
            .catch(() => {});
        }

        if (unblock) {
          CyberApi.request(`/users/${unblock.dataset.unblockUser}/unblock`, { method: 'POST' })
            .then(async () => {
              await loadBlockedUsers();
              await loadActiveUsers();
            })
            .catch(() => {});
        }
      });
    }

    const newGroupBtn = document.querySelector('[data-new-group]');
    if (newGroupBtn) {
      newGroupBtn.addEventListener('click', async () => {
        const title = window.prompt('Group name:') || 'Group Chat';
        const ids = window.prompt('Participant user IDs (comma separated):');
        const participants = ids
          ? ids.split(',').map((id) => Number(id.trim())).filter(Boolean)
          : [];

        await CyberApi.request('/conversations', {
          method: 'POST',
          body: JSON.stringify({ type: 'group', title, participants }),
        });
        await loadConversations();
      });
    }

    const form = document.getElementById('chatForm');
    if (form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = form.message.value.trim();
        if (!message) return;

        await sendMessage(message);
        form.reset();
      });

      form.message.addEventListener('input', () => {
        setTyping().catch(() => {});
        updateAiHints(form.message.value);
      });
    }

    if (aiHints && form) {
      aiHints.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-ai-reply]');
        if (!chip) return;
        form.message.value = chip.dataset.aiReply || '';
        form.message.focus();
      });
    }

    if (attachBtn && attachInput) {
      attachBtn.addEventListener('click', () => attachInput.click());
      attachInput.addEventListener('change', async () => {
        const file = attachInput.files?.[0];
        if (!file) return;
        try {
          await sendAttachment(file);
        } catch (err) {
          alert(err?.error || 'Unable to send attachment.');
        } finally {
          attachInput.value = '';
        }
      });
    }

    if (recordBtn) {
      recordBtn.addEventListener('click', async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
          alert('Voice recording not supported in this browser.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          try {
            await sendAttachment(new File([blob], 'voice.webm', { type: 'audio/webm' }));
          } catch (err) {
            alert(err?.error || 'Unable to send voice note.');
          }
        };
        recorder.start();
        setTimeout(() => recorder.stop(), 5000);
      });
    }

    if (pinBtn) {
      pinBtn.addEventListener('click', async () => {
        if (!currentConversationId) return;
        const current = latestConversations.find((c) => Number(c.id) === Number(currentConversationId));
        const pinned = current && current.pinned_at;
        await CyberApi.request(`/conversations/${currentConversationId}/${pinned ? 'unpin' : 'pin'}`, { method: 'POST' });
        await loadConversations();
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', async () => {
        if (!currentConversationId) return;
        const current = latestConversations.find((c) => Number(c.id) === Number(currentConversationId));
        const muted = current && current.muted_until;
        if (muted) {
          await CyberApi.request(`/conversations/${currentConversationId}/unmute`, { method: 'POST' });
        } else {
          const minutes = window.prompt('Mute duration (minutes):', '60');
          if (!minutes) return;
          await CyberApi.request(`/conversations/${currentConversationId}/mute`, {
            method: 'POST',
            body: JSON.stringify({ minutes: Number(minutes) || 60 }),
          });
        }
        await loadConversations();
      });
    }

    if (summaryBtn) {
      summaryBtn.addEventListener('click', async () => {
        const messages = Array.from(document.querySelectorAll('.chat-message__text'))
          .map((el) => el.textContent || '')
          .filter(Boolean)
          .join(' ');
        if (!messages) return;
        const data = await CyberApi.request('/ai/summarize', {
          method: 'POST',
          body: JSON.stringify({ text: messages }),
        });
        if (data?.summary) {
          alert(`Summary: ${data.summary}`);
        }
      });
    }

    if (chatSearchInput) {
      chatSearchInput.addEventListener('input', () => {
        const filtered = filterConversations(latestConversations, chatSearchInput.value);
        renderConversations(filtered);
        highlightActiveConversation();
      });
    }
  };

  const init = async () => {
    bindUI();
    updatePrivacyBadge();
    await loadBlockedUsers();
    await Promise.all([loadConversations(), loadMessageRequests(), loadActiveUsers()]);
  };

  return { init };
})();

window.CyberChat = CyberChat;
