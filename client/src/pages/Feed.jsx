import { useEffect, useMemo, useRef, useState } from 'react';
import { http } from '../lib/http.js';
import { useToast } from '../state/ToastProvider.jsx';

const toFormData = (obj) => {
  const fd = new FormData();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, v);
  });
  return fd;
};

export const FeedPage = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [requests, setRequests] = useState({ items: [], sent: [] });
  const [stories, setStories] = useState([]);

  const sentinelRef = useRef(null);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const resp = await http.get('/posts/feed?limit=12');
      setPosts(resp.data.items || []);
      setNextCursor(resp.data.next_cursor || null);
    } catch (e) {
      toast('Unable to load feed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const resp = await http.get(`/posts/feed?limit=12&cursor=${nextCursor}`);
      const items = resp.data.items || [];
      setPosts((prev) => prev.concat(items));
      setNextCursor(resp.data.next_cursor || null);
    } catch (e) {
      toast('Unable to load more', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      const resp = await http.get('/users/suggestions?limit=20');
      setSuggestions(resp.data.items || []);
    } catch (e) {
      setSuggestions([]);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const resp = await http.get('/friend-requests');
      setRequests({ items: resp.data.items || [], sent: resp.data.sent || [] });
    } catch (e) {
      setRequests({ items: [], sent: [] });
    }
  };

  const loadStories = async () => {
    try {
      const resp = await http.get('/stories?limit=30');
      setStories(resp.data.items || []);
    } catch (e) {
      setStories([]);
    }
  };

  useEffect(() => {
    loadFeed();
    loadSuggestions();
    loadFriendRequests();
    loadStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sentinelRef.current) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      const hit = entries.some((e) => e.isIntersecting);
      if (!hit) return;
      loadMore();
    }, { rootMargin: '600px 0px' });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor]);

  const onCreatePost = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = form.body.value || '';
    const files = form.media.files;
    if (!body.trim() && (!files || files.length === 0)) return;

    const fd = new FormData();
    fd.append('body', body);
    fd.append('visibility', 'public');
    for (let i = 0; i < files.length; i += 1) fd.append('media', files[i]);

    try {
      const resp = await http.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (resp.data?.post) {
        setPosts((prev) => [resp.data.post, ...prev]);
      } else {
        await loadFeed();
      }
      form.reset();
      toast('Posted', 'success', 1400);
    } catch (err) {
      toast(err?.response?.data?.error || 'Post failed', 'error');
    }
  };

  const onCreateStory = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = form.media.files && form.media.files[0];
    if (!file) return;
    const fd = toFormData({ media: file });
    try {
      await http.post('/stories', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      form.reset();
      toast('Story posted', 'success', 1400);
      await loadStories();
    } catch (err) {
      toast(err?.response?.data?.error || 'Story failed', 'error');
    }
  };

  const toggleLike = async (post) => {
    const liked = Number(post.liked_by_me) === 1;
    try {
      if (liked) {
        await http.delete(`/posts/${post.id}/like`);
      } else {
        await http.post(`/posts/${post.id}/like`);
      }
      setPosts((prev) => prev.map((p) => (
        p.id !== post.id ? p : {
          ...p,
          liked_by_me: liked ? 0 : 1,
          likes_count: Number(p.likes_count || 0) + (liked ? -1 : 1),
        }
      )));
    } catch (e) {
      toast('Like failed', 'error');
    }
  };

  const loadLatestComments = async (postId) => {
    try {
      const resp = await http.get(`/posts/${postId}/comments?limit=5&order=desc`);
      const list = document.getElementById(`comment-list-${postId}`);
      if (!list) return;
      const items = (resp.data.items || []).slice().reverse();
      list.innerHTML = items.map((c) => (
        `<div class="comment">
          <div class="card__row">
            ${c.avatar_url ? `<img class="avatar avatar--sm" src="${c.avatar_url}" />` : '<div class="avatar avatar--sm"></div>'}
            <div>
              <strong>${c.username}</strong>
              <span class="badge">${new Date(c.created_at).toLocaleString()}</span>
            </div>
          </div>
          <p>${String(c.body || '').replace(/</g, '&lt;')}</p>
        </div>`
      )).join('');
    } catch (e) {
      // ignore
    }
  };

  const openComments = async (postId) => {
    const el = document.getElementById(`comments-${postId}`);
    if (!el) return;
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      await loadLatestComments(postId);
    }
  };

  const submitComment = async (e, postId) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = form.comment.value.trim();
    if (!body) return;
    try {
      await http.post(`/posts/${postId}/comment`, { body });
      form.reset();
      toast('Comment added', 'success', 1200);
      await loadLatestComments(postId);
    } catch (err) {
      toast(err?.response?.data?.error || 'Comment failed', 'error');
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      await http.post('/friend-requests', { userId });
      toast('Friend request sent', 'success', 1400);
      await Promise.all([loadSuggestions(), loadFriendRequests()]);
    } catch (e) {
      toast('Friend request failed', 'error');
    }
  };

  const acceptRequest = async (id) => {
    try {
      await http.post(`/friend-requests/${id}/accept`);
      toast('Friend added', 'success', 1400);
      await Promise.all([loadFriendRequests(), loadSuggestions()]);
    } catch (e) {
      toast('Accept failed', 'error');
    }
  };

  const rejectRequest = async (id) => {
    try {
      await http.post(`/friend-requests/${id}/reject`);
      toast('Request removed', 'success', 1400);
      await loadFriendRequests();
    } catch (e) {
      toast('Reject failed', 'error');
    }
  };

  const storyCards = useMemo(() => {
    if (!stories.length) {
      return <div className="story story--empty"><strong>No stories yet</strong><span>Be the first</span></div>;
    }
    return stories.map((s) => (
      <div key={s.id} className={Number(s.viewed_by_me) === 1 ? 'story story--seen' : 'story'}>
        <div className="story__media" style={s.media_type === 'image' ? { backgroundImage: `url('${s.media_url}')` } : undefined}>
          <div className="story__top">
            <div className="story__ring">
              {s.avatar_url ? <img className="avatar avatar--sm" src={s.avatar_url} alt={s.username} /> : <div className="avatar avatar--sm" />}
            </div>
            {s.media_type === 'video' ? <span className="story__badge">Video</span> : null}
          </div>
          <div className="story__footer">
            <div>
              <strong>{s.username}</strong>
              <span>expires {new Date(s.expires_at).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    ));
  }, [stories]);

  return (
    <div>
      <section className="story-row">{storyCards}</section>

      <section className="feed-grid">
        <div className="feed-left">
          <section className="feed-compose" id="compose">
            <form className="card composer composer--post" onSubmit={onCreatePost}>
              <div className="composer__head">
                <div className="composer__head-text">
                  <div className="composer__title">Create post</div>
                  <div className="composer__subtitle">Share an update with your people.</div>
                </div>
              </div>
              <textarea className="input composer__textarea" name="body" rows="3" placeholder="What's on your mind?" />
              <div className="composer__bar">
                <input className="composer__file" id="postMedia" type="file" name="media" multiple accept="image/*,video/*" />
                <label className="btn btn--ghost" htmlFor="postMedia">Photo/Video</label>
                <div className="composer__spacer" />
                <button className="btn btn--primary" type="submit">Post</button>
              </div>
            </form>

            <form className="card composer composer--story" onSubmit={onCreateStory}>
              <div className="composer__head">
                <div className="composer__head-text">
                  <div className="composer__title">Add to story</div>
                  <div className="composer__subtitle">Photo or video, expires in 24 hours.</div>
                </div>
              </div>
              <div className="composer__bar">
                <input className="composer__file" id="storyMedia" type="file" name="media" accept="image/*,video/*" required />
                <label className="btn btn--accent" htmlFor="storyMedia">Upload story</label>
                <div className="composer__spacer" />
                <button className="btn btn--ghost" type="submit">Post</button>
              </div>
            </form>
          </section>

          <div style={{ marginTop: 16 }}>
            {loading ? (
              <div className="card">Loading feed...</div>
            ) : (
              posts.map((p) => (
                <article key={p.id} className="post">
                  <div className="post__header">
                    <div className="post__header-left">
                      {p.avatar_url ? <img className="avatar" src={p.avatar_url} alt={p.username} /> : <div className="avatar" />}
                      <div className="post__header-main">
                        <div className="post__author">
                          <strong>{p.name || p.username}</strong>
                          <span className="badge">@{p.username}</span>
                        </div>
                        <div className="post__time">{new Date(p.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                  {p.body ? <p>{p.body}</p> : null}
                  {p.media_url ? (
                    p.media_type === 'video' ? (
                      <video className="post__media-video" controls preload="metadata" src={p.media_url} />
                    ) : (
                      <img className="post__media-img" src={p.media_url} alt="Post media" loading="lazy" />
                    )
                  ) : null}
                  <div className="post__actions">
                    <button className="btn btn--ghost" type="button" onClick={() => toggleLike(p)}>
                      {Number(p.liked_by_me) === 1 ? 'Unlike' : 'Like'}
                    </button>
                    <button className="btn btn--ghost" type="button" onClick={() => openComments(p.id)}>Comment</button>
                    <button className="btn btn--ghost" type="button" disabled>Share</button>
                    <button className="btn btn--ghost" type="button" disabled>Save</button>
                  </div>
                  <div className="post__meta">
                    <span>{p.likes_count || 0} likes</span>
                    <span>{p.comments_count || 0} comments</span>
                  </div>
                  <div className="post__comments" id={`comments-${p.id}`} style={{ display: 'none' }}>
                    <form className="post__comment-form" onSubmit={(e) => submitComment(e, p.id)}>
                      <input className="input" name="comment" placeholder="Write a comment..." required />
                      <button className="btn btn--primary" type="submit">Send</button>
                    </form>
                    <div className="post__comment-list" id={`comment-list-${p.id}`} />
                  </div>
                </article>
              ))
            )}

            <div ref={sentinelRef} style={{ height: 1 }} />
            {nextCursor ? (
              <div style={{ marginTop: 12 }}>
                <button className="btn btn--ghost" type="button" onClick={loadMore} disabled={loadingMore} style={{ width: '100%' }}>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            ) : (
              <div className="hint" style={{ marginTop: 12 }}>You are all caught up.</div>
            )}
          </div>
        </div>

        <aside className="feed-aside">
          <div className="card">
            <div className="feed-aside__head">
              <h3 style={{ margin: 0 }}>Friend requests</h3>
              <span className="badge" style={{ display: requests.items.length ? 'inline-flex' : 'none' }}>{requests.items.length}</span>
            </div>
            {requests.items.length ? requests.items.map((r) => (
              <div key={r.id} className="mini-card">
                <div className="card__row">
                  {r.avatar_url ? <img className="avatar avatar--sm" src={r.avatar_url} alt={r.username} /> : <div className="avatar avatar--sm" />}
                  <div>
                    <strong>{r.name || r.username}</strong>
                    <div className="badge">@{r.username}</div>
                  </div>
                </div>
                <div className="mini-card__actions">
                  <button className="btn btn--primary" type="button" onClick={() => acceptRequest(r.id)}>Accept</button>
                  <button className="btn btn--ghost" type="button" onClick={() => rejectRequest(r.id)}>Reject</button>
                </div>
              </div>
            )) : <p className="hint">No pending requests.</p>}
          </div>

          <div className="card">
            <div className="feed-aside__head">
              <h3 style={{ margin: 0 }}>People you may know</h3>
              <button className="btn btn--ghost" type="button" onClick={loadSuggestions} style={{ padding: '6px 10px' }}>Refresh</button>
            </div>
            {suggestions.length ? suggestions.map((u) => (
              <div key={u.id} className="mini-card">
                <div className="card__row">
                  {u.avatar_url ? <img className="avatar avatar--sm" src={u.avatar_url} alt={u.username} /> : <div className="avatar avatar--sm" />}
                  <div>
                    <strong>{u.name || u.username}</strong>
                    <div className="badge">@{u.username}</div>
                  </div>
                </div>
                <div className="mini-card__meta">{u.is_online ? 'Active now' : 'Offline'}</div>
                <div className="mini-card__actions">
                  <button className="btn btn--primary" type="button" onClick={() => sendFriendRequest(u.id)}>Add friend</button>
                </div>
              </div>
            )) : <p className="hint">No suggestions yet.</p>}
          </div>
        </aside>
      </section>
    </div>
  );
};
