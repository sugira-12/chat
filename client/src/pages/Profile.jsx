import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { http } from '../lib/http.js';
import { useAuth } from '../state/AuthProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

export const ProfilePage = () => {
  const { id } = useParams();
  const { user, refreshMe } = useAuth();
  const { toast } = useToast();

  const targetId = useMemo(() => {
    const n = Number(id || 0);
    return n || Number(user?.id || 0);
  }, [id, user]);

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const isMe = Number(targetId) === Number(user?.id);

  const load = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const resp = await http.get(`/users/${targetId}`);
      setProfile(resp.data.user || null);
      setStats(resp.data.stats || null);
    } catch (e) {
      toast('Unable to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const upload = async (kind, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await http.post(`/uploads/${kind}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast('Uploaded', 'success', 1400);
      await Promise.all([load(), refreshMe()]);
    } catch (e) {
      toast(e?.response?.data?.error || 'Upload failed', 'error');
    }
  };

  if (loading) {
    return <div className="card">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="card">Profile not found.</div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          height: 220,
          background: profile.coverUrl ? `url('${profile.coverUrl}') center/cover no-repeat` : 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(96,165,250,0.18))',
          position: 'relative',
        }}
      >
        {isMe ? (
          <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', gap: 10 }}>
            <label className="btn btn--ghost" style={{ padding: '8px 12px' }}>
              Change cover
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => upload('cover', e.target.files && e.target.files[0])} />
            </label>
          </div>
        ) : null}
      </div>

      <div style={{ padding: 22 }}>
        <div className="card__row" style={{ justifyContent: 'space-between' }}>
          <div className="card__row">
            {profile.avatarUrl ? (
              <img className="avatar avatar--photo" src={profile.avatarUrl} alt={profile.username} style={{ width: 74, height: 74 }} />
            ) : (
              <div className="avatar" style={{ width: 74, height: 74 }} />
            )}
            <div>
              <h2 style={{ margin: 0 }}>{profile.name || profile.username}</h2>
              <div className="hint" style={{ margin: 0 }}>@{profile.username}</div>
              {profile.bio ? <p style={{ marginTop: 10 }}>{profile.bio}</p> : null}
            </div>
          </div>

          {isMe ? (
            <label className="btn btn--primary" style={{ padding: '10px 14px' }}>
              Change avatar
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => upload('avatar', e.target.files && e.target.files[0])} />
            </label>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <span className="badge">{stats?.posts ?? 0} posts</span>
          <span className="badge">{stats?.followers ?? 0} followers</span>
          <span className="badge">{stats?.following ?? 0} following</span>
        </div>
      </div>
    </div>
  );
};

