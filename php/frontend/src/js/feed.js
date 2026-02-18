const FeedPage = (() => {
  const apiBaseUrl = window.CYBER_CONFIG?.apiBaseUrl || 'http://localhost/cyber/php/backend/public/index.php/api';
  const listEl = document.querySelector('[data-feed-list]');
  const storyEl = document.querySelector('[data-story-list]');
  const form = document.getElementById('postForm');
  const storyForm = document.getElementById('storyForm');
  const logoutLink = document.querySelector('[data-logout]');
  const searchInput = document.querySelector('[data-search-input]');
  const searchResults = document.getElementById('searchResults');
  const friendRequestsBox = document.getElementById('friendRequests');
  const suggestionsBox = document.getElementById('suggestionsList');
  const reportModal = document.getElementById('reportModal');
  const reportReason = document.getElementById('reportReason');
  const reportSubmit = document.getElementById('reportSubmit');
  const reportCancel = document.getElementById('reportCancel');
  const storyModal = document.getElementById('storyModal');
  const storyModalTitle = document.getElementById('storyModalTitle');
  const storyModalMedia = document.getElementById('storyModalMedia');
  const storyModalMeta = document.getElementById('storyModalMeta');
  const storyReplyForm = document.getElementById('storyReplyForm');
  const storyReplyInput = document.getElementById('storyReplyInput');
  const storyReplies = document.getElementById('storyReplies');
  const storyModalClose = document.getElementById('storyModalClose');
  let pendingReport = null;
  let friendRequestRefreshTimer = null;
  let feedRefreshTimer = null;
  let storyRefreshTimer = null;
  let suggestionRefreshTimer = null;
  let feedLoading = false;
  let storyLoading = false;
  let friendRequestLoading = false;
  let suggestionLoading = false;
  const storyCache = new Map();
  let activeStoryId = null;

  const escapeHtml = (value) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const renderStory = (story) => {
    const item = document.createElement('div');
    item.className = story.viewed_by_me ? 'story story--seen' : 'story';
    item.dataset.storyId = story.id;
    const mediaStyle = story.media_type === 'image' && story.media_url
      ? `style="background-image:url('${story.media_url}');"`
      : '';
    const mediaBadge = story.media_type === 'video' ? '<span class="story__badge">Video</span>' : '';
    const avatar = story.avatar_url
      ? `<img class="avatar avatar--sm" src="${story.avatar_url}" alt="${escapeHtml(story.username || 'User')}" />`
      : '<div class="avatar avatar--sm"></div>';
    item.innerHTML = `
      <div class="story__media" ${mediaStyle}>
        <div class="story__top">
          <div class="story__ring">${avatar}</div>
          ${mediaBadge}
        </div>
        <div class="story__footer">
          <div>
            <strong>${escapeHtml(story.username || 'Story')}</strong>
            <span>expires ${new Date(story.expires_at).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    `;
    return item;
  };

  const renderPost = (post) => {
    const item = document.createElement('article');
    item.className = 'post';
    item.dataset.postId = post.id;
    const liked = Number(post.liked_by_me) === 1;
    const likeLabel = liked ? 'Unlike' : 'Like';
    const bodyBlock = post.body ? `<p>${escapeHtml(post.body)}</p>` : '';
    let mediaBlock = '';
    if (post.media_url) {
      if (post.media_type === 'video') {
        mediaBlock = `<video class="post__media-video" controls src="${post.media_url}"></video>`;
      } else {
        mediaBlock = `<img class="post__media-img" src="${post.media_url}" alt="Post media" />`;
      }
    }

    const avatar = post.avatar_url
      ? `<img class="avatar" src="${post.avatar_url}" alt="${escapeHtml(post.username || 'User')}" />`
      : '<div class="avatar"></div>';
    item.innerHTML = `
      <div class="post__header">
        ${avatar}
        <div>
          <a href="Profile.html?id=${post.user_id}"><strong>${escapeHtml(post.username || 'User')}</strong></a>
          <div class="badge">${new Date(post.created_at).toLocaleString()}</div>
        </div>
      </div>
      ${bodyBlock}
      ${mediaBlock}
      <div class="post__actions">
        <button class="btn btn--ghost" data-like="${post.id}" data-liked="${liked ? '1' : '0'}">${likeLabel}</button>
        <button class="btn btn--ghost" data-love="${post.id}">Love</button>
        <button class="btn btn--ghost" data-comment-toggle="${post.id}">Comment</button>
        <button class="btn btn--ghost" data-share="${post.id}">Share</button>
        <button class="btn btn--ghost" data-report-post="${post.id}">Report</button>
      </div>
      <div class="post__meta">
        <span data-likes-count="${post.id}">${post.likes_count || 0} likes</span>
        <span data-comments-count="${post.id}">${post.comments_count || 0} comments</span>
      </div>
      <div class="post__comments" data-comments="${post.id}" style="display:none;">
        <form class="post__comment-form" data-comment-form="${post.id}">
          <input class="input" name="comment" placeholder="Write a comment..." required />
          <button class="btn btn--primary" type="submit">Send</button>
        </form>
        <div class="post__comment-list" data-comment-list="${post.id}"></div>
      </div>
    `;
    return item;
  };

  const renderFriendRequest = (req) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.marginBottom = '10px';
    const avatar = req.avatar_url
      ? `<img class="avatar avatar--sm" src="${req.avatar_url}" alt="${escapeHtml(req.username || 'User')}" />`
      : '<div class="avatar avatar--sm"></div>';
    item.innerHTML = `
      <div class="card__row">
        ${avatar}
        <div>
          <strong>${req.name || req.username}</strong>
          <div class="badge">@${req.username}</div>
        </div>
      </div>
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button class="btn btn--primary" data-accept="${req.id}">Accept</button>
        <button class="btn btn--ghost" data-reject="${req.id}">Reject</button>
      </div>
    `;
    return item;
  };

  const renderSentFriendRequest = (req) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.marginBottom = '10px';
    const avatar = req.avatar_url
      ? `<img class="avatar avatar--sm" src="${req.avatar_url}" alt="${escapeHtml(req.username || 'User')}" />`
      : '<div class="avatar avatar--sm"></div>';
    item.innerHTML = `
      <div class="card__row">
        ${avatar}
        <div>
          <strong>${req.name || req.username}</strong>
          <div class="badge">@${req.username}</div>
        </div>
      </div>
      <div style="margin-top:10px; color:#6b6f76; font-size:0.85rem;">Request sent</div>
    `;
    return item;
  };

  const renderSuggestion = (user) => {
    const item = document.createElement('div');
    item.style.marginBottom = '10px';
    const mutualText = user.mutual_friends ? `${user.mutual_friends} mutual friends` : 'New to you';
    const lastActive = user.last_activity ? new Date(user.last_activity).toLocaleDateString() : 'recently';
    const avatar = user.avatar_url
      ? `<img class="avatar avatar--sm" src="${user.avatar_url}" alt="${escapeHtml(user.username || 'User')}" />`
      : '<div class="avatar avatar--sm"></div>';
    item.innerHTML = `
      <div class="card__row">
        ${avatar}
        <div>
          <strong>${user.name || user.username}</strong>
          <div class="badge">@${user.username}</div>
        </div>
      </div>
      <div style="color:#6b6f76; font-size:0.85rem;">${mutualText} - active ${lastActive}</div>
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button class="btn btn--primary" data-suggest="${user.id}">Add friend</button>
        <a class="btn btn--ghost" href="Profile.html?id=${user.id}">View</a>
      </div>
    `;
    return item;
  };

  const renderComment = (comment) => {
    const time = comment.created_at ? new Date(comment.created_at).toLocaleString() : '';
    const avatar = comment.avatar_url
      ? `<img class="avatar avatar--sm" src="${comment.avatar_url}" alt="${escapeHtml(comment.username || 'User')}" />`
      : '<div class="avatar avatar--sm"></div>';
    return `
      <div class="comment">
        <div class="card__row">
          ${avatar}
          <div>
            <strong>${escapeHtml(comment.username || 'User')}</strong>
            <span class="badge">${time}</span>
          </div>
        </div>
        <p>${escapeHtml(comment.body || '')}</p>
      </div>
    `;
  };

  const loadComments = async (postId) => {
    const list = document.querySelector(`[data-comment-list="${postId}"]`);
    if (!list) return;
    list.innerHTML = 'Loading comments...';
    try {
      const data = await CyberApi.request(`/posts/${postId}/comments`);
      const items = data.items || [];
      if (!items.length) {
        list.innerHTML = '<p>No comments yet.</p>';
        return;
      }
      list.innerHTML = items.map((comment) => renderComment(comment)).join('');
    } catch (err) {
      list.innerHTML = '<p>Unable to load comments.</p>';
    }
  };

  const toggleComments = async (postId) => {
    const container = document.querySelector(`[data-comments="${postId}"]`);
    if (!container) return;
    const visible = container.style.display !== 'none';
    if (visible) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';
    await loadComments(postId);
  };

  const submitComment = async (postId, body) => {
    if (!body) return;
    await CyberApi.request(`/posts/${postId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    await loadComments(postId);
    const countEl = document.querySelector(`[data-comments-count="${postId}"]`);
    if (countEl) {
      const current = parseInt(countEl.textContent, 10) || 0;
      countEl.textContent = `${current + 1} comments`;
    }
  };

  const toggleLike = async (postId, liked) => {
    if (liked) {
      await CyberApi.request(`/posts/${postId}/like`, { method: 'DELETE' });
    } else {
      await CyberApi.request(`/posts/${postId}/like`, { method: 'POST' });
    }
    const btn = document.querySelector(`[data-like="${postId}"]`);
    if (btn) {
      btn.setAttribute('data-liked', liked ? '0' : '1');
      btn.textContent = liked ? 'Like' : 'Unlike';
    }
    const countEl = document.querySelector(`[data-likes-count="${postId}"]`);
    if (countEl) {
      const current = parseInt(countEl.textContent, 10) || 0;
      countEl.textContent = `${liked ? current - 1 : current + 1} likes`;
    }
  };

  const sharePost = async (postId) => {
    const text = window.prompt('Add a message (optional):', '');
    await CyberApi.request(`/posts/${postId}/share`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    alert('Post shared.');
  };

  const loadFriendRequests = async () => {
    if (!friendRequestsBox) return;
    if (friendRequestLoading) return;
    friendRequestLoading = true;
    friendRequestsBox.innerHTML = '';
    try {
      const data = await CyberApi.request('/friend-requests');
      const incoming = data.items || [];
      const sent = data.sent || [];

      if (!incoming.length && !sent.length) {
        friendRequestsBox.innerHTML = '<p>No pending requests.</p>';
        return;
      }

      if (incoming.length) {
        const incomingTitle = document.createElement('h4');
        incomingTitle.textContent = 'Incoming';
        incomingTitle.style.margin = '0 0 8px 0';
        friendRequestsBox.appendChild(incomingTitle);
        incoming.forEach((req) => friendRequestsBox.appendChild(renderFriendRequest(req)));
      }

      if (sent.length) {
        const sentTitle = document.createElement('h4');
        sentTitle.textContent = 'Sent';
        sentTitle.style.margin = '12px 0 8px 0';
        friendRequestsBox.appendChild(sentTitle);
        sent.forEach((req) => friendRequestsBox.appendChild(renderSentFriendRequest(req)));
      }
    } catch (err) {
      friendRequestsBox.innerHTML = '<p>Unable to load friend requests.</p>';
    } finally {
      friendRequestLoading = false;
    }
  };

  const loadSuggestions = async () => {
    if (!suggestionsBox) return;
    if (suggestionLoading) return;
    suggestionLoading = true;
    suggestionsBox.innerHTML = '';
    try {
      const data = await CyberApi.request('/users/suggestions?limit=100');
      if (!data.items.length) {
        suggestionsBox.innerHTML = '<p>No suggestions yet.</p>';
        return;
      }
      data.items.forEach((user) => suggestionsBox.appendChild(renderSuggestion(user)));
    } catch (err) {
      suggestionsBox.innerHTML = '<p>Unable to load suggestions.</p>';
    } finally {
      suggestionLoading = false;
    }
  };

  const loadStories = async () => {
    if (!storyEl) return;
    if (storyLoading) return;
    storyLoading = true;
    storyEl.innerHTML = '';
    try {
      const data = await CyberApi.request('/stories');
      const items = data.items || [];
      storyCache.clear();
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'story story--empty';
        empty.innerHTML = '<strong>No stories yet</strong><span>Be the first</span>';
        storyEl.appendChild(empty);
        return;
      }
      items.forEach((story) => {
        storyCache.set(Number(story.id), story);
        storyEl.appendChild(renderStory(story));
      });
    } catch (err) {
      console.error(err);
    } finally {
      storyLoading = false;
    }
  };

  const loadStoryReplies = async (storyId) => {
    if (!storyReplies) return;
    storyReplies.innerHTML = 'Loading replies...';
    try {
      const data = await CyberApi.request(`/stories/${storyId}/replies`);
      const items = data.items || [];
      if (!items.length) {
        storyReplies.innerHTML = '<p>No replies yet.</p>';
        return;
      }
      storyReplies.innerHTML = items.map((reply) => {
        return `<div class="comment">
          <strong>${escapeHtml(reply.username || 'User')}</strong>
          <p>${escapeHtml(reply.body || '')}</p>
        </div>`;
      }).join('');
    } catch (err) {
      storyReplies.innerHTML = '<p>Unable to load replies.</p>';
    }
  };

  const openStoryModal = async (storyId) => {
    const story = storyCache.get(Number(storyId));
    if (!story || !storyModal) return;
    activeStoryId = Number(storyId);
    storyModal.classList.add('is-visible');

    if (storyModalTitle) {
      storyModalTitle.textContent = story.username ? `${story.username}'s story` : 'Story';
    }
    if (storyModalMedia) {
      if (story.media_type === 'video') {
        storyModalMedia.innerHTML = `<video class="story-media" controls src="${story.media_url}"></video>`;
      } else {
        storyModalMedia.innerHTML = `<img class="story-media" src="${story.media_url}" alt="Story media" />`;
      }
    }
    if (storyModalMeta) {
      const caption = story.caption ? `<div>${escapeHtml(story.caption)}</div>` : '';
      storyModalMeta.innerHTML = `${caption}<div>${new Date(story.created_at).toLocaleString()}</div>`;
    }

    CyberApi.request(`/stories/${storyId}/view`, { method: 'POST' }).catch(() => {});
    await loadStoryReplies(storyId);
  };

  const closeStoryModal = () => {
    activeStoryId = null;
    if (storyModal) storyModal.classList.remove('is-visible');
  };

  const loadFeed = async () => {
    if (!listEl) return;
    if (feedLoading) return;
    feedLoading = true;
    listEl.innerHTML = '';
    try {
      const data = await CyberApi.request('/posts/feed');
      const items = data.items || [];
      if (!items.length) {
        listEl.innerHTML = '<div class="card">No posts yet. Create one!</div>';
        return;
      }
      items.forEach((post) => listEl.appendChild(renderPost(post)));
    } catch (err) {
      listEl.innerHTML = '<div class="card">Unable to load feed.</div>';
    } finally {
      feedLoading = false;
    }
  };

  const handlePostCreate = async (event) => {
    event.preventDefault();
    const token = CyberStorage.get('auth_token');
    const body = form.body.value.trim();
    const files = form.media.files;
    if (!body && files.length === 0) return;

    const formData = new FormData();
    formData.append('body', body);
    formData.append('visibility', 'public');
    for (let i = 0; i < files.length; i += 1) {
      formData.append('media', files[i]);
    }

    const response = await fetch(`${apiBaseUrl}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw data;
    }
    form.reset();
    if (data?.post && listEl) {
      const card = renderPost(data.post);
      listEl.prepend(card);
    } else {
      await loadFeed();
    }
  };

  const handleStoryCreate = async (event) => {
    event.preventDefault();
    const token = CyberStorage.get('auth_token');
    const files = storyForm.media.files;
    if (!files.length) return;
    const formData = new FormData();
    formData.append('media', files[0]);

    const response = await fetch(`${apiBaseUrl}/stories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    if (!response.ok) {
      const err = await response.json();
      throw err;
    }
    storyForm.reset();
    await loadStories();
  };

  const openReportModal = (type, targetId) => {
    pendingReport = { type, targetId };
    if (reportModal) {
      reportModal.classList.add('is-visible');
    }
  };

  const closeReportModal = () => {
    pendingReport = null;
    if (reportModal) {
      reportModal.classList.remove('is-visible');
    }
  };

  const submitReport = async () => {
    if (!pendingReport) return;
    await CyberApi.request('/reports', {
      method: 'POST',
      body: JSON.stringify({
        type: pendingReport.type,
        target_id: Number(pendingReport.targetId),
        reason: reportReason ? reportReason.value : 'Other'
      })
    });
    closeReportModal();
    alert('Report submitted.');
  };

  const handleSearch = async (value) => {
    if (!searchResults) return;
    const term = value.trim();
    if (!term || term.length < 2) {
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      return;
    }
    try {
      const data = await CyberApi.request(`/search?q=${encodeURIComponent(term)}`);
      let html = '<h3>Search results</h3>';
      html += '<strong>Users</strong>';
      html += '<ul>' + (data.users || []).map((u) => {
        const avatar = u.avatar_url
          ? `<img class="avatar avatar--xs" src="${u.avatar_url}" alt="${escapeHtml(u.username || 'User')}" />`
          : '<div class="avatar avatar--xs"></div>';
        return `<li class="list-row">${avatar}<span>${escapeHtml(u.name || u.username)} (@${escapeHtml(u.username)})</span> ` +
          `<button class="btn btn--ghost" data-search-friend="${u.id}">Add friend</button> ` +
          `<a href="Profile.html?id=${u.id}">View</a></li>`;
      }).join('') + '</ul>';
      html += '<strong>Posts</strong>';
      html += '<ul>' + (data.posts || []).map((p) => {
        const snippet = (p.body || 'Post').slice(0, 80);
        return `<li><a href="Profile.html?id=${p.user_id}">${escapeHtml(snippet)}...</a></li>`;
      }).join('') + '</ul>';
      searchResults.innerHTML = html;
      searchResults.style.display = 'block';
    } catch (err) {
      searchResults.innerHTML = '<p>Search failed. Try again.</p>';
      searchResults.style.display = 'block';
    }
  };

  const attachEvents = () => {
    if (form) {
      form.addEventListener('submit', (event) => {
        handlePostCreate(event).catch((err) => {
          console.error(err);
        });
      });
    }
    if (storyForm) {
      storyForm.addEventListener('submit', (event) => {
        handleStoryCreate(event).catch((err) => {
          console.error(err);
        });
      });
    }
    if (storyEl) {
      storyEl.addEventListener('click', (event) => {
        const card = event.target.closest('[data-story-id]');
        if (!card) return;
        openStoryModal(card.getAttribute('data-story-id')).catch((err) => console.error(err));
      });
    }
    if (listEl) {
      listEl.addEventListener('click', async (event) => {
        const likeBtn = event.target.closest('[data-like]');
        const loveBtn = event.target.closest('[data-love]');
        const commentToggle = event.target.closest('[data-comment-toggle]');
        const shareBtn = event.target.closest('[data-share]');
        const reportBtn = event.target.closest('[data-report-post]');

        if (likeBtn) {
          const postId = likeBtn.getAttribute('data-like');
          const liked = likeBtn.getAttribute('data-liked') === '1';
          await toggleLike(postId, liked);
          return;
        }

        if (loveBtn) {
          const postId = loveBtn.getAttribute('data-love');
          await CyberApi.request(`/posts/${postId}/like`, { method: 'POST' });
          await loadFeed();
          return;
        }

        if (commentToggle) {
          const postId = commentToggle.getAttribute('data-comment-toggle');
          await toggleComments(postId);
          return;
        }

        if (shareBtn) {
          const postId = shareBtn.getAttribute('data-share');
          await sharePost(postId);
          return;
        }

        if (reportBtn) {
          const reportId = reportBtn.getAttribute('data-report-post');
          openReportModal('post', reportId);
        }
      });

      listEl.addEventListener('submit', async (event) => {
        const formEl = event.target.closest('[data-comment-form]');
        if (!formEl) return;
        event.preventDefault();
        const postId = formEl.getAttribute('data-comment-form');
        const input = formEl.querySelector('input[name="comment"]');
        const body = input ? input.value.trim() : '';
        if (!body) return;
        await submitComment(postId, body);
        formEl.reset();
      });
    }
    if (friendRequestsBox) {
      friendRequestsBox.addEventListener('click', async (event) => {
        const acceptId = event.target.getAttribute('data-accept');
        const rejectId = event.target.getAttribute('data-reject');
        if (acceptId) {
          await CyberApi.request(`/friend-requests/${acceptId}/accept`, { method: 'POST' });
          await loadFriendRequests();
        }
        if (rejectId) {
          await CyberApi.request(`/friend-requests/${rejectId}/reject`, { method: 'POST' });
          await loadFriendRequests();
        }
      });
    }
    if (suggestionsBox) {
      suggestionsBox.addEventListener('click', async (event) => {
        const id = event.target.getAttribute('data-suggest');
        if (!id) return;
        await CyberApi.request(`/users/${id}/friend-request`, { method: 'POST' });
        await Promise.all([loadSuggestions(), loadFriendRequests()]);
      });
    }
    if (searchResults) {
      searchResults.addEventListener('click', async (event) => {
        const id = event.target.getAttribute('data-search-friend');
        if (!id) return;
        await CyberApi.request(`/users/${id}/friend-request`, { method: 'POST' });
        await loadFriendRequests();
        alert('Friend request action completed.');
      });
    }
    if (searchInput) {
      let timer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          handleSearch(searchInput.value).catch((err) => console.error(err));
        }, 300);
      });
    }
    if (logoutLink) {
      logoutLink.addEventListener('click', () => {
        CyberAuth.logout();
      });
    }
    if (reportCancel) {
      reportCancel.addEventListener('click', () => closeReportModal());
    }
    if (reportSubmit) {
      reportSubmit.addEventListener('click', () => {
        submitReport().catch((err) => console.error(err));
      });
    }
    if (reportModal) {
      reportModal.addEventListener('click', (event) => {
        if (event.target === reportModal) {
          closeReportModal();
        }
      });
    }
    if (storyReplyForm) {
      storyReplyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!activeStoryId) return;
        const body = storyReplyInput?.value.trim() || '';
        if (!body) return;
        await CyberApi.request(`/stories/${activeStoryId}/reply`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        });
        if (storyReplyInput) storyReplyInput.value = '';
        await loadStoryReplies(activeStoryId);
      });
    }
    if (storyModalClose) {
      storyModalClose.addEventListener('click', () => closeStoryModal());
    }
    if (storyModal) {
      storyModal.addEventListener('click', (event) => {
        if (event.target === storyModal) {
          closeStoryModal();
        }
      });
    }
    window.addEventListener('focus', () => {
      loadFriendRequests().catch((err) => console.error(err));
      loadFeed().catch((err) => console.error(err));
      loadStories().catch((err) => console.error(err));
      loadSuggestions().catch((err) => console.error(err));
    });
  };

  const init = async () => {
    await CyberApp.requireAuth();
    attachEvents();
    await Promise.all([loadFeed(), loadStories(), loadFriendRequests(), loadSuggestions()]);
    const canRefresh = () => document.visibilityState === 'visible';
    friendRequestRefreshTimer = setInterval(() => {
      if (!canRefresh()) return;
      loadFriendRequests().catch((err) => console.error(err));
    }, 10000);
    feedRefreshTimer = setInterval(() => {
      if (!canRefresh()) return;
      loadFeed().catch((err) => console.error(err));
    }, 12000);
    storyRefreshTimer = setInterval(() => {
      if (!canRefresh()) return;
      loadStories().catch((err) => console.error(err));
    }, 20000);
    suggestionRefreshTimer = setInterval(() => {
      if (!canRefresh()) return;
      loadSuggestions().catch((err) => console.error(err));
    }, 45000);
  };

  return { init };
})();

window.FeedPage = FeedPage;
