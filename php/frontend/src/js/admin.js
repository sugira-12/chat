const AdminPage = (() => {
  const metricsEl = document.getElementById('adminMetrics');
  const usersEl = document.getElementById('adminUsers');
  const reportsEl = document.getElementById('adminReports');

  const reportType = document.getElementById('reportType');
  const reportStatus = document.getElementById('reportStatus');
  const reportSearch = document.getElementById('reportSearch');
  const reportFilterBtn = document.getElementById('reportFilterBtn');

  const userSearch = document.getElementById('userSearch');
  const userRole = document.getElementById('userRole');
  const userStatus = document.getElementById('userStatus');
  const userFilterBtn = document.getElementById('userFilterBtn');
  const adsEl = document.getElementById('adminAds');
  const adForm = document.getElementById('adForm');
  const adTitle = document.getElementById('adTitle');
  const adBody = document.getElementById('adBody');
  const adImageUrl = document.getElementById('adImageUrl');
  const adLinkUrl = document.getElementById('adLinkUrl');
  const adStartsAt = document.getElementById('adStartsAt');
  const adEndsAt = document.getElementById('adEndsAt');
  const adIsActive = document.getElementById('adIsActive');
  const adStatus = document.getElementById('adStatus');
  const adRefreshBtn = document.getElementById('adRefreshBtn');
  let refreshTimer = null;
  let loadInFlight = false;

  const renderMetrics = (metrics) => {
    if (!metricsEl) return;

    metricsEl.innerHTML = `
      <div class="card"><h3>Users</h3><p>${metrics.users ?? 0}</p></div>
      <div class="card"><h3>Posts</h3><p>${metrics.posts ?? 0}</p></div>
      <div class="card"><h3>Messages</h3><p>${metrics.messages ?? 0}</p></div>
      <div class="card"><h3>Conversations</h3><p>${metrics.conversations ?? 0}</p></div>
      <div class="card"><h3>Open reports</h3><p>${metrics.open_reports ?? 0}</p></div>
      <div class="card"><h3>Pending friends</h3><p>${metrics.pending_friend_requests ?? 0}</p></div>
      <div class="card"><h3>Pending follows</h3><p>${metrics.pending_follow_requests ?? 0}</p></div>
    `;
  };

  const renderUsers = (users) => {
    if (!usersEl) return;

    if (!users.length) {
      usersEl.innerHTML = '<p>No users found with current filters.</p>';
      return;
    }

    usersEl.innerHTML = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th align="left">ID</th>
            <th align="left">Name</th>
            <th align="left">Username</th>
            <th align="left">Email</th>
            <th align="left">Role</th>
            <th align="left">Status</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u) => `
            <tr>
              <td>${u.id}</td>
              <td>${u.name || ''}</td>
              <td>@${u.username}</td>
              <td>${u.email || ''}</td>
              <td>${u.role}</td>
              <td>${u.status}</td>
              <td>
                <button class="btn btn--ghost" data-action="role" data-id="${u.id}" data-role="${u.role === 'admin' ? 'user' : 'admin'}">${u.role === 'admin' ? 'Make User' : 'Make Admin'}</button>
                <button class="btn btn--accent" data-action="status" data-id="${u.id}" data-status="${u.status === 'active' ? 'suspended' : 'active'}">${u.status === 'active' ? 'Suspend' : 'Activate'}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderReports = (reports) => {
    if (!reportsEl) return;

    if (!reports.length) {
      reportsEl.innerHTML = '<p>No reports found with current filters.</p>';
      return;
    }

    reportsEl.innerHTML = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th align="left">ID</th>
            <th align="left">Status</th>
            <th align="left">Type</th>
            <th align="left">Target</th>
            <th align="left">Reporter</th>
            <th align="left">Reason</th>
            <th align="left">Created</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${reports.map((r) => {
            const target = r.target_type === 'user'
              ? `User: ${r.target_user || r.target_id}`
              : `Post: ${(r.target_post_body || '').slice(0, 60)} (by ${r.target_post_owner || ''})`;
            return `
              <tr>
                <td>${r.id}</td>
                <td>${r.status}</td>
                <td>${r.target_type}</td>
                <td>${target}</td>
                <td>${r.reporter_username || r.reporter_id}</td>
                <td>${r.reason}</td>
                <td>${new Date(r.created_at).toLocaleString()}</td>
                <td>
                  ${r.status === 'open' ? `<button class="btn btn--ghost" data-action="resolve-report" data-id="${r.id}">Resolve</button>` : ''}
                  ${r.target_type === 'user' ? `<button class="btn btn--accent" data-action="ban-user" data-user="${r.target_id}">Suspend user</button>` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  };

  const renderAds = (ads) => {
    if (!adsEl) return;
    if (!ads.length) {
      adsEl.innerHTML = '<p>No ads created yet.</p>';
      return;
    }
    adsEl.innerHTML = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th align="left">ID</th>
            <th align="left">Title</th>
            <th align="left">Window</th>
            <th align="left">Status</th>
            <th align="left">Creator</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${ads.map((ad) => `
            <tr>
              <td>${ad.id}</td>
              <td>${ad.title || ''}</td>
              <td>${new Date(ad.starts_at).toLocaleString()} - ${new Date(ad.ends_at).toLocaleString()}</td>
              <td>${Number(ad.is_active) === 1 ? 'Active' : 'Inactive'}</td>
              <td>@${ad.creator_username || ad.created_by}</td>
              <td>
                ${Number(ad.is_active) === 1 ? `<button class="btn btn--ghost" data-action="deactivate-ad" data-id="${ad.id}">Deactivate</button>` : '<span class="badge">Inactive</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const toMysqlDateTime = (value) => {
    if (!value) return '';
    const cleaned = value.replace('T', ' ');
    return cleaned.length === 16 ? `${cleaned}:00` : cleaned;
  };

  const buildReportQuery = () => {
    const params = new URLSearchParams();
    if (reportType?.value) params.set('type', reportType.value);
    if (reportStatus?.value) params.set('status', reportStatus.value);
    if (reportSearch?.value.trim()) params.set('search', reportSearch.value.trim());
    params.set('limit', '100');
    const query = params.toString();
    return query ? `?${query}` : '';
  };

  const buildUserQuery = () => {
    const params = new URLSearchParams();
    if (userSearch?.value.trim()) params.set('search', userSearch.value.trim());
    if (userRole?.value) params.set('role', userRole.value);
    if (userStatus?.value) params.set('status', userStatus.value);
    params.set('limit', '100');
    const query = params.toString();
    return query ? `?${query}` : '';
  };

  const loadMetrics = async () => {
    const metrics = await CyberApi.request('/admin/metrics');
    renderMetrics(metrics);
  };

  const loadUsers = async () => {
    const users = await CyberApi.request(`/admin/users${buildUserQuery()}`);
    renderUsers(users.items || []);
  };

  const loadReports = async () => {
    const reports = await CyberApi.request(`/admin/reports${buildReportQuery()}`);
    renderReports(reports.items || []);
  };

  const loadAds = async () => {
    const ads = await CyberApi.request('/admin/ads?limit=100');
    renderAds(ads.items || []);
  };

  const load = async () => {
    if (loadInFlight) return;
    loadInFlight = true;
    try {
      await Promise.all([loadMetrics(), loadUsers(), loadReports(), loadAds()]);
    } finally {
      loadInFlight = false;
    }
  };

  const bindActions = () => {
    if (usersEl) {
      usersEl.addEventListener('click', async (event) => {
        const btn = event.target.closest('button');
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'role') {
          await CyberApi.request(`/admin/users/${id}/role`, {
            method: 'POST',
            body: JSON.stringify({ role: btn.dataset.role }),
          });
        }
        if (action === 'status') {
          await CyberApi.request(`/admin/users/${id}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: btn.dataset.status }),
          });
        }
        await load();
      });
    }

    if (reportsEl) {
      reportsEl.addEventListener('click', async (event) => {
        const btn = event.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'resolve-report') {
          await CyberApi.request(`/admin/reports/${btn.dataset.id}/resolve`, { method: 'POST' });
        }
        if (action === 'ban-user') {
          await CyberApi.request(`/admin/users/${btn.dataset.user}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: 'suspended' }),
          });
        }
        await load();
      });
    }

    if (adsEl) {
      adsEl.addEventListener('click', async (event) => {
        const btn = event.target.closest('button');
        if (!btn) return;
        if (btn.dataset.action === 'deactivate-ad') {
          await CyberApi.request(`/admin/ads/${btn.dataset.id}/deactivate`, { method: 'POST' });
          await loadAds();
        }
      });
    }

    if (adForm) {
      adForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!adTitle?.value || !adStartsAt?.value || !adEndsAt?.value) {
          if (adStatus) adStatus.textContent = 'Title, start, and end time are required.';
          return;
        }
        await CyberApi.request('/admin/ads', {
          method: 'POST',
          body: JSON.stringify({
            title: adTitle.value.trim(),
            body: adBody?.value.trim() || null,
            image_url: adImageUrl?.value.trim() || null,
            link_url: adLinkUrl?.value.trim() || null,
            starts_at: toMysqlDateTime(adStartsAt.value),
            ends_at: toMysqlDateTime(adEndsAt.value),
            is_active: adIsActive?.checked ? 1 : 0,
          }),
        });
        if (adStatus) adStatus.textContent = 'Ad created.';
        adForm.reset();
        if (adIsActive) adIsActive.checked = true;
        await loadAds();
      });
    }

    if (adRefreshBtn) {
      adRefreshBtn.addEventListener('click', () => {
        loadAds().catch((err) => console.error(err));
      });
    }

    if (reportFilterBtn) {
      reportFilterBtn.addEventListener('click', () => {
        loadReports().catch((err) => console.error(err));
      });
    }

    if (userFilterBtn) {
      userFilterBtn.addEventListener('click', () => {
        loadUsers().catch((err) => console.error(err));
      });
    }
  };

  const init = async () => {
    await CyberApp.requireAuth();
    bindActions();
    await load();

    const canRefresh = () => document.visibilityState === 'visible';
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!canRefresh()) return;
      load().catch((err) => console.error(err));
    }, 15000);

    window.addEventListener('focus', () => {
      load().catch((err) => console.error(err));
    });
  };

  return { init };
})();

window.AdminPage = AdminPage;
