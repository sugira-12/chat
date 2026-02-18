const ProfilePage = (() => {
  const profileCover = document.querySelector('[data-profile-cover]');
  const profileAvatar = document.querySelector('[data-profile-avatar]');
  const profileName = document.querySelector('[data-profile-name]');
  const profileBio = document.querySelector('[data-profile-bio]');
  const profileHandle = document.querySelector('[data-profile-handle]');
  const verifiedBadge = document.querySelector('[data-profile-verified]');

  const statsFollowers = document.querySelector('[data-profile-followers]');
  const statsFollowing = document.querySelector('[data-profile-following]');
  const statsPosts = document.querySelector('[data-profile-posts]');
  const statsFriends = document.querySelector('[data-profile-friends]');

  const actions = document.getElementById('profileActions');

  const introView = document.getElementById('introView');
  const introForm = document.getElementById('introForm');
  const introEditBtn = document.getElementById('introEditBtn');

  const highlightsList = document.getElementById('highlightsList');
  const highlightForm = document.getElementById('highlightForm');
  const highlightToggle = document.getElementById('highlightToggle');

  const friendsList = document.getElementById('friendsList');
  const friendsMeta = document.getElementById('friendsMeta');
  const suggestionsList = document.getElementById('suggestionsList');
  const photosGrid = document.getElementById('photosGrid');
  const albumsList = document.getElementById('albumsList');
  const albumForm = document.getElementById('albumForm');
  const albumToggle = document.getElementById('albumToggle');

  const groupsList = document.getElementById('groupsList');
  const groupForm = document.getElementById('groupForm');
  const groupToggle = document.getElementById('groupToggle');

  const pagesList = document.getElementById('pagesList');
  const pageForm = document.getElementById('pageForm');
  const pageToggle = document.getElementById('pageToggle');

  const eventsList = document.getElementById('eventsList');
  const eventForm = document.getElementById('eventForm');
  const eventToggle = document.getElementById('eventToggle');

  const pinnedPosts = document.getElementById('pinnedPosts');
  const activityList = document.getElementById('activityList');

  const postsList = document.getElementById('postsList');
  const reelsList = document.getElementById('reelsList');
  const mediaList = document.getElementById('mediaList');
  const taggedList = document.getElementById('taggedList');
  const postFilterButtons = document.querySelectorAll('[data-post-filter]');

  const highlightViewer = document.getElementById('highlightViewer');
  const highlightItems = document.getElementById('highlightItems');
  const highlightClose = document.getElementById('highlightClose');
  const albumViewer = document.getElementById('albumViewer');
  const albumItems = document.getElementById('albumItems');
  const albumClose = document.getElementById('albumClose');
  const editProfileModal = document.getElementById('editProfileModal');
  const editProfileForm = document.getElementById('editProfileForm');
  const editProfileClose = document.getElementById('editProfileClose');
  let activePostFilter = 'all';

  const tabButtons = document.querySelectorAll('.profile-tab');
  const tabPanels = {
    posts: document.getElementById('profileTabPosts'),
    reels: document.getElementById('profileTabReels'),
    media: document.getElementById('profileTabMedia'),
    tagged: document.getElementById('profileTabTagged'),
  };

  let currentUserId = null;
  let viewerId = null;
  let isOwner = false;
  let profileUser = null;

  const escapeHtml = (value) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const setTab = (name) => {
    tabButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === name);
    });
    Object.keys(tabPanels).forEach((key) => {
      const panel = tabPanels[key];
      if (panel) {
        panel.classList.toggle('is-visible', key === name);
      }
    });
  };

  const renderIntro = (intro, website = '') => {
    if (!introView) return;
    const rows = [];
    if (intro.workplace) rows.push(`Works at ${escapeHtml(intro.workplace)}`);
    if (intro.education) rows.push(`Studied at ${escapeHtml(intro.education)}`);
    if (intro.hometown) rows.push(`From ${escapeHtml(intro.hometown)}`);
    if (intro.location) rows.push(`Lives in ${escapeHtml(intro.location)}`);
    if (intro.relationship_status) rows.push(`Relationship: ${escapeHtml(intro.relationship_status)}`);
    if (intro.pronouns) rows.push(`Pronouns: ${escapeHtml(intro.pronouns)}`);
    if (intro.birthday) rows.push(`Birthday: ${escapeHtml(intro.birthday)}`);
    if (website) rows.push(`Website: ${escapeHtml(website)}`);
    introView.innerHTML = rows.length ? rows.map((line) => `<div class="badge">${line}</div>`).join(' ') : '<p class="hint">No intro details yet.</p>';
  };

  const renderMiniGrid = (container, items, labelKey = 'name') => {
    if (!container) return;
    if (!items.length) {
      container.innerHTML = '<div class="hint">Nothing here yet.</div>';
      return;
    }
    container.innerHTML = items.map((item) => {
      const title = escapeHtml(item[labelKey] || item.title || 'Item');
      const avatar = item.avatar_url
        ? `<img class="avatar avatar--sm" src="${item.avatar_url}" alt="${title}" />`
        : '<div class="avatar avatar--sm"></div>';
      const dataAttr = item.id ? `data-item-id="${item.id}"` : '';
      return `<div class="profile-mini-item" ${dataAttr}>
        <div class="card__row">${avatar}<strong>${title}</strong></div>
      </div>`;
    }).join('');
  };

  const renderPhotos = (items) => {
    if (!photosGrid) return;
    if (!items.length) {
      photosGrid.innerHTML = '<p class="hint">No photos yet.</p>';
      return;
    }
    photosGrid.innerHTML = items.map((m) => {
      const media = m.media_type === 'video'
        ? `<video src="${m.url || m.media_url}" muted></video>`
        : `<img src="${m.url || m.media_url}" alt="media" />`;
      return `<div class="profile-media-item">${media}</div>`;
    }).join('');
  };

  const renderMediaGrid = (container, items) => {
    if (!container) return;
    if (!items.length) {
      container.innerHTML = '<p class="hint">No items yet.</p>';
      return;
    }
    container.innerHTML = items.map((m) => {
      const url = m.media_url || m.url;
      const type = m.media_type || m.type || 'image';
      const media = type === 'video'
        ? `<video src="${url}" controls></video>`
        : `<img src="${url}" alt="media" />`;
      return `<div class="profile-media-item">${media}</div>`;
    }).join('');
  };

  const renderActivity = (items) => {
    if (!activityList) return;
    if (!items.length) {
      activityList.innerHTML = '<p class="hint">No recent activity.</p>';
      return;
    }
    activityList.innerHTML = items.map((a) => {
      const label = a.type === 'comment' ? 'commented on' : 'liked';
      return `<div class="card__row">
        <span class="badge">${label}</span>
        <span>${escapeHtml(a.target_username || 'a post')}</span>
        <span class="badge">${new Date(a.created_at).toLocaleString()}</span>
      </div>`;
    }).join('');
  };

  const renderPostCard = (post, allowPin) => {
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
    const pinBtn = allowPin ? `<button class="btn btn--ghost" data-pin-post="${post.id}">Pin</button>` : '';
    return `
      <article class="post" data-post-id="${post.id}">
        <div class="post__header">
          ${post.avatar_url ? `<img class="avatar" src="${post.avatar_url}" alt="${escapeHtml(post.username || 'User')}" />` : '<div class="avatar"></div>'}
          <div>
            <strong>${escapeHtml(post.username || 'User')}</strong>
            <div class="badge">${new Date(post.created_at).toLocaleString()}</div>
          </div>
        </div>
        ${bodyBlock}
        ${mediaBlock}
        <div class="post__actions">
          <button class="btn btn--ghost" data-like="${post.id}" data-liked="${liked ? '1' : '0'}">${likeLabel}</button>
          <button class="btn btn--ghost" data-comment-toggle="${post.id}">Comment</button>
          <button class="btn btn--ghost" data-share="${post.id}">Share</button>
          ${pinBtn}
        </div>
        <div class="post__meta">
          <span data-likes-count="${post.id}">${post.likes_count || 0} likes</span>
          <span data-comments-count="${post.id}">${post.comments_count || 0} comments</span>
        </div>
      </article>
    `;
  };

  const loadOverview = async () => {
    const data = await CyberApi.request(`/profile/${currentUserId}`);
    const user = data.user || {};
    profileUser = user;
    const intro = data.intro || {};

    if (profileCover) {
      if (user.cover_photo_url) {
        profileCover.style.backgroundImage = `linear-gradient(120deg, rgba(15, 118, 110, 0.55), rgba(249, 115, 22, 0.5)), url('${user.cover_photo_url}')`;
        profileCover.style.backgroundSize = 'cover';
        profileCover.style.backgroundPosition = 'center';
      } else {
        profileCover.style.backgroundImage = '';
      }
    }
    if (profileAvatar) {
      profileAvatar.src = user.avatar_url || '';
    }
    if (profileName) profileName.textContent = user.name || user.username;
    if (profileBio) profileBio.textContent = user.bio || 'Share your story.';
    if (profileHandle) profileHandle.textContent = `@${user.username}`;
    if (verifiedBadge) {
      verifiedBadge.style.display = Number(user.is_verified) === 1 ? 'inline-flex' : 'none';
    }

    if (statsFollowers) statsFollowers.textContent = data.stats?.followers ?? 0;
    if (statsFollowing) statsFollowing.textContent = data.stats?.following ?? 0;
    if (statsPosts) statsPosts.textContent = data.stats?.posts ?? 0;
    if (statsFriends) statsFriends.textContent = data.friends_count ?? (data.friends?.length ?? 0);

    renderIntro(intro, user.website || '');
    if (introForm) {
      introForm.workplace.value = intro.workplace || '';
      introForm.education.value = intro.education || '';
      introForm.hometown.value = intro.hometown || '';
      introForm.location.value = intro.location || '';
      introForm.relationship_status.value = intro.relationship_status || '';
      introForm.pronouns.value = intro.pronouns || '';
      introForm.birthday.value = intro.birthday || '';
      introForm.show_friends.checked = Number(intro.show_friends) === 1;
      introForm.show_followers.checked = Number(intro.show_followers) === 1;
      introForm.show_photos.checked = Number(intro.show_photos) === 1;
      introForm.show_activity.checked = Number(intro.show_activity) === 1;
    }

    renderMiniGrid(highlightsList, data.highlights || [], 'title');
    renderMiniGrid(albumsList, data.albums || [], 'title');
    renderMiniGrid(groupsList, data.groups || [], 'name');
    renderMiniGrid(pagesList, data.pages || [], 'name');
    renderMiniGrid(eventsList, data.events || [], 'title');

    renderMiniGrid(friendsList, data.friends || [], 'name');
    if (friendsMeta) {
      const mutual = data.mutual_friends ? `${data.mutual_friends} mutual friends` : '';
      friendsMeta.textContent = mutual;
    }

    renderPhotos(data.media || []);
    renderActivity(data.activity || []);

    if (data.locked) {
      if (postsList) postsList.innerHTML = '<div class="card"><h3>Private profile</h3><p>This profile is private. Follow or friend to see posts.</p></div>';
      if (reelsList) reelsList.innerHTML = '<p class="hint">Private profile.</p>';
      if (mediaList) mediaList.innerHTML = '<p class="hint">Private profile.</p>';
      if (taggedList) taggedList.innerHTML = '<p class="hint">Private profile.</p>';
    }

    if (pinnedPosts) {
      if (!data.pinned_posts || !data.pinned_posts.length) {
        pinnedPosts.innerHTML = '<h3>Pinned posts</h3><p class="hint">No pinned posts.</p>';
      } else {
        pinnedPosts.innerHTML = `<h3>Pinned posts</h3>${data.pinned_posts.map((post) => renderPostCard(post, isOwner)).join('')}`;
      }
    }
  };

  const loadPosts = async () => {
    if (!postsList) return;
    try {
      const filter = activePostFilter === 'all' ? '' : `?type=${activePostFilter}`;
      const data = await CyberApi.request(`/profile/${currentUserId}/posts${filter}`);
      postsList.innerHTML = data.items.map((post) => renderPostCard(post, isOwner)).join('');
    } catch (err) {
      postsList.innerHTML = '<p class="hint">Unable to load posts.</p>';
    }
  };

  const loadReels = async () => {
    if (!reelsList) return;
    try {
      const data = await CyberApi.request(`/profile/${currentUserId}/posts?type=video&limit=30`);
      renderMediaGrid(reelsList, data.items || []);
    } catch (err) {
      reelsList.innerHTML = '<p class="hint">Unable to load reels.</p>';
    }
  };

  const loadMedia = async () => {
    if (!mediaList) return;
    try {
      const data = await CyberApi.request(`/profile/${currentUserId}/media?limit=30`);
      renderMediaGrid(mediaList, data.items || []);
    } catch (err) {
      mediaList.innerHTML = '<p class="hint">Unable to load media.</p>';
    }
  };

  const loadTagged = async () => {
    if (!taggedList) return;
    try {
      const data = await CyberApi.request(`/profile/${currentUserId}/tagged?limit=30`);
      renderMediaGrid(taggedList, data.items || []);
    } catch (err) {
      taggedList.innerHTML = '<p class="hint">Unable to load tagged posts.</p>';
    }
  };

  const loadSuggestions = async () => {
    if (!suggestionsList) return;
    try {
      const data = await CyberApi.request('/users/suggestions?limit=6');
      const items = data.items || [];
      if (!items.length) {
        suggestionsList.innerHTML = '<p class="hint">No suggestions yet.</p>';
        return;
      }
      suggestionsList.innerHTML = items.map((user) => {
        const avatar = user.avatar_url
          ? `<img class="avatar avatar--sm" src="${user.avatar_url}" alt="${escapeHtml(user.username || 'User')}" />`
          : '<div class="avatar avatar--sm"></div>';
        return `<div class="profile-mini-item">
          <div class="card__row">${avatar}<strong>${escapeHtml(user.name || user.username)}</strong></div>
          <div class="hint">@${escapeHtml(user.username)}</div>
          <button class="btn btn--ghost" data-suggest-friend="${user.id}">Add friend</button>
        </div>`;
      }).join('');
    } catch (err) {
      suggestionsList.innerHTML = '<p class="hint">Unable to load suggestions.</p>';
    }
  };

  const openModal = (modal) => {
    if (modal) modal.classList.add('is-visible');
  };

  const closeModal = (modal) => {
    if (modal) modal.classList.remove('is-visible');
  };

  const attachActions = () => {
    if (tabButtons.length) {
      tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          setTab(tab);
          if (tab === 'reels') loadReels().catch(() => {});
          if (tab === 'media') loadMedia().catch(() => {});
          if (tab === 'tagged') loadTagged().catch(() => {});
        });
      });
    }

    if (postFilterButtons.length) {
      postFilterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          activePostFilter = btn.getAttribute('data-post-filter') || 'all';
          postFilterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
          loadPosts().catch(() => {});
        });
      });
    }

    if (introEditBtn && introForm) {
      introEditBtn.addEventListener('click', () => {
        introForm.style.display = introForm.style.display === 'none' ? 'grid' : 'none';
      });
    }

    if (introForm) {
      introForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
          workplace: introForm.workplace.value,
          education: introForm.education.value,
          hometown: introForm.hometown.value,
          location: introForm.location.value,
          relationship_status: introForm.relationship_status.value,
          pronouns: introForm.pronouns.value,
          birthday: introForm.birthday.value || null,
          show_friends: introForm.show_friends.checked ? 1 : 0,
          show_followers: introForm.show_followers.checked ? 1 : 0,
          show_photos: introForm.show_photos.checked ? 1 : 0,
          show_activity: introForm.show_activity.checked ? 1 : 0,
        };
        await CyberApi.request('/profile/intro', { method: 'PUT', body: JSON.stringify(payload) });
        await loadOverview();
        introForm.style.display = 'none';
      });
    }

    if (highlightToggle && highlightForm) {
      highlightToggle.addEventListener('click', () => {
        highlightForm.style.display = highlightForm.style.display === 'none' ? 'grid' : 'none';
      });
    }
    if (highlightForm) {
      highlightForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await CyberApi.request('/profile/highlights', {
          method: 'POST',
          body: JSON.stringify({
            title: highlightForm.title.value,
            cover_url: highlightForm.cover_url.value || null,
          }),
        });
        highlightForm.reset();
        await loadOverview();
      });
    }

    if (albumToggle && albumForm) {
      albumToggle.addEventListener('click', () => {
        albumForm.style.display = albumForm.style.display === 'none' ? 'grid' : 'none';
      });
    }
    if (albumForm) {
      albumForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await CyberApi.request('/profile/albums', {
          method: 'POST',
          body: JSON.stringify({
            title: albumForm.title.value,
            description: albumForm.description.value || null,
            cover_url: albumForm.cover_url.value || null,
          }),
        });
        albumForm.reset();
        await loadOverview();
      });
    }

    if (groupToggle && groupForm) {
      groupToggle.addEventListener('click', () => {
        groupForm.style.display = groupForm.style.display === 'none' ? 'grid' : 'none';
      });
    }
    if (groupForm) {
      groupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await CyberApi.request('/profile/groups', {
          method: 'POST',
          body: JSON.stringify({
            name: groupForm.name.value,
            description: groupForm.description.value || null,
          }),
        });
        groupForm.reset();
        await loadOverview();
      });
    }

    if (pageToggle && pageForm) {
      pageToggle.addEventListener('click', () => {
        pageForm.style.display = pageForm.style.display === 'none' ? 'grid' : 'none';
      });
    }
    if (pageForm) {
      pageForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await CyberApi.request('/profile/pages', {
          method: 'POST',
          body: JSON.stringify({
            name: pageForm.name.value,
            category: pageForm.category.value || null,
          }),
        });
        pageForm.reset();
        await loadOverview();
      });
    }

    if (eventToggle && eventForm) {
      eventToggle.addEventListener('click', () => {
        eventForm.style.display = eventForm.style.display === 'none' ? 'grid' : 'none';
      });
    }
    if (eventForm) {
      eventForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await CyberApi.request('/profile/events', {
          method: 'POST',
          body: JSON.stringify({
            title: eventForm.title.value,
            location: eventForm.location.value || null,
            starts_at: eventForm.starts_at.value,
            ends_at: eventForm.ends_at.value || null,
          }),
        });
        eventForm.reset();
        await loadOverview();
      });
    }

    if (highlightsList) {
      highlightsList.addEventListener('click', async (event) => {
        const item = event.target.closest('[data-item-id]');
        if (!item) return;
        try {
          const data = await CyberApi.request(`/profile/highlights/${item.dataset.itemId}/items`);
          renderMediaGrid(highlightItems, data.items || []);
          openModal(highlightViewer);
        } catch (err) {
          alert('Unable to load highlight items.');
        }
      });
    }

    if (albumsList) {
      albumsList.addEventListener('click', async (event) => {
        const item = event.target.closest('[data-item-id]');
        if (!item) return;
        try {
          const data = await CyberApi.request(`/profile/albums/${item.dataset.itemId}/items`);
          renderMediaGrid(albumItems, data.items || []);
          openModal(albumViewer);
        } catch (err) {
          alert('Unable to load album items.');
        }
      });
    }

    if (highlightClose) highlightClose.addEventListener('click', () => closeModal(highlightViewer));
    if (albumClose) albumClose.addEventListener('click', () => closeModal(albumViewer));
    if (highlightViewer) {
      highlightViewer.addEventListener('click', (event) => {
        if (event.target === highlightViewer) closeModal(highlightViewer);
      });
    }
    if (albumViewer) {
      albumViewer.addEventListener('click', (event) => {
        if (event.target === albumViewer) closeModal(albumViewer);
      });
    }

    if (editProfileClose) editProfileClose.addEventListener('click', () => closeModal(editProfileModal));
    if (editProfileModal) {
      editProfileModal.addEventListener('click', (event) => {
        if (event.target === editProfileModal) closeModal(editProfileModal);
      });
    }

    if (editProfileForm) {
      editProfileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await CyberApi.request('/users/me', {
          method: 'PUT',
          body: JSON.stringify({
            name: editProfileForm.name.value,
            bio: editProfileForm.bio.value,
            website: editProfileForm.website.value,
            avatar_url: editProfileForm.avatar_url.value,
            cover_photo_url: editProfileForm.cover_photo_url.value,
          }),
        });
        const avatarFile = editProfileForm.avatar_file.files?.[0];
        const coverFile = editProfileForm.cover_file.files?.[0];
        if (avatarFile || coverFile) {
          const token = CyberStorage.get('auth_token');
          const formData = new FormData();
          if (avatarFile) formData.append('avatar', avatarFile);
          if (coverFile) formData.append('cover', coverFile);
          await fetch(`${window.CYBER_CONFIG.apiBaseUrl}/users/me/media`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
        }
        closeModal(editProfileModal);
        await loadOverview();
      });
    }

    if (postsList) {
      postsList.addEventListener('click', async (event) => {
        const likeBtn = event.target.closest('[data-like]');
        const shareBtn = event.target.closest('[data-share]');
        const pinBtn = event.target.closest('[data-pin-post]');
        if (likeBtn) {
          const postId = likeBtn.getAttribute('data-like');
          const liked = likeBtn.getAttribute('data-liked') === '1';
          if (liked) {
            await CyberApi.request(`/posts/${postId}/like`, { method: 'DELETE' });
            likeBtn.textContent = 'Like';
            likeBtn.setAttribute('data-liked', '0');
          } else {
            await CyberApi.request(`/posts/${postId}/like`, { method: 'POST' });
            likeBtn.textContent = 'Unlike';
            likeBtn.setAttribute('data-liked', '1');
          }
          return;
        }
        if (shareBtn) {
          const postId = shareBtn.getAttribute('data-share');
          await CyberApi.request(`/posts/${postId}/share`, { method: 'POST', body: JSON.stringify({ text: '' }) });
          alert('Post shared.');
          return;
        }
        if (pinBtn) {
          const postId = pinBtn.getAttribute('data-pin-post');
          await CyberApi.request('/profile/pins', { method: 'POST', body: JSON.stringify({ post_id: Number(postId) }) });
          await loadOverview();
        }
      });
    }

    if (suggestionsList) {
      suggestionsList.addEventListener('click', async (event) => {
        const btn = event.target.closest('[data-suggest-friend]');
        if (!btn) return;
        await CyberApi.request(`/users/${btn.dataset.suggestFriend}/friend-request`, { method: 'POST' });
        btn.textContent = 'Requested';
      });
    }
  };

  const buildActions = () => {
    if (!actions) return;
    actions.innerHTML = '';
    if (isOwner) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn--ghost';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit profile';
      editBtn.addEventListener('click', () => {
        if (editProfileForm) {
          editProfileForm.name.value = profileUser?.name || profileUser?.username || '';
          editProfileForm.bio.value = profileUser?.bio || '';
          editProfileForm.website.value = profileUser?.website || '';
          editProfileForm.avatar_url.value = profileUser?.avatar_url || '';
          editProfileForm.cover_photo_url.value = profileUser?.cover_photo_url || '';
        }
        openModal(editProfileModal);
      });
      actions.appendChild(editBtn);
      return;
    }

    const friendBtn = document.createElement('button');
    friendBtn.className = 'btn btn--primary';
    friendBtn.textContent = 'Add friend';
    friendBtn.addEventListener('click', async () => {
      await CyberApi.request(`/users/${currentUserId}/friend-request`, { method: 'POST' });
      friendBtn.textContent = 'Requested';
    });

    const followBtn = document.createElement('button');
    followBtn.className = 'btn btn--ghost';
    followBtn.textContent = 'Follow';
    followBtn.addEventListener('click', async () => {
      const res = await CyberApi.request(`/users/${currentUserId}/follow`, { method: 'POST' });
      followBtn.textContent = res.status === 'requested' ? 'Requested' : 'Following';
    });

    const messageBtn = document.createElement('a');
    messageBtn.className = 'btn btn--accent';
    messageBtn.href = 'Chat.html';
    messageBtn.textContent = 'Message';

    const blockBtn = document.createElement('button');
    blockBtn.className = 'btn btn--ghost';
    blockBtn.textContent = 'Block';
    blockBtn.addEventListener('click', async () => {
      await CyberApi.request(`/users/${currentUserId}/block`, { method: 'POST' });
      blockBtn.textContent = 'Blocked';
    });

    actions.appendChild(friendBtn);
    actions.appendChild(followBtn);
    actions.appendChild(messageBtn);
    actions.appendChild(blockBtn);
  };

  const init = async () => {
    const me = await CyberApp.requireAuth();
    const params = new URLSearchParams(window.location.search);
    currentUserId = params.get('id') || me.id;
    viewerId = me.id;
    isOwner = String(currentUserId) === String(viewerId);

    buildActions();
    if (introEditBtn) introEditBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (highlightToggle) highlightToggle.style.display = isOwner ? 'inline-flex' : 'none';
    if (albumToggle) albumToggle.style.display = isOwner ? 'inline-flex' : 'none';
    if (groupToggle) groupToggle.style.display = isOwner ? 'inline-flex' : 'none';
    if (pageToggle) pageToggle.style.display = isOwner ? 'inline-flex' : 'none';
    if (eventToggle) eventToggle.style.display = isOwner ? 'inline-flex' : 'none';

    attachActions();
    await loadOverview();
    await loadPosts();
    await loadSuggestions();
    setTab('posts');
  };

  return { init };
})();

window.ProfilePage = ProfilePage;
