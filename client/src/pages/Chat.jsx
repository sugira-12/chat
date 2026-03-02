import { useEffect, useMemo, useRef, useState } from 'react';
import { http } from '../lib/http.js';
import { useToast } from '../state/ToastProvider.jsx';
import { useAuth } from '../state/AuthProvider.jsx';

const formatTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch (e) {
    return '';
  }
};

export const ChatPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);

  const active = useMemo(
    () => conversations.find((c) => Number(c.id) === Number(activeId)) || null,
    [conversations, activeId]
  );

  const loadConversations = async () => {
    const resp = await http.get('/chat/conversations');
    setConversations(resp.data.items || []);
    if (!activeId && (resp.data.items || []).length) {
      setActiveId(resp.data.items[0].id);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) return;
    const resp = await http.get(`/chat/conversations/${conversationId}/messages?limit=40`);
    const items = resp.data.items || [];
    // API returns newest first
    const normalized = items.map((m) => {
      let attachments = m.attachments;
      if (typeof attachments === 'string') {
        try {
          attachments = JSON.parse(attachments);
        } catch (e) {
          attachments = null;
        }
      }
      return { ...m, attachments: Array.isArray(attachments) ? attachments : [] };
    });
    setMessages(normalized.slice().reverse());
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadConversations();
      } catch (e) {
        toast('Unable to load conversations', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId).catch(() => {});

    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      loadMessages(activeId).catch(() => {});
      loadConversations().catch(() => {});
    }, 4000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || !activeId) return;
    setSending(true);
    try {
      await http.post(`/chat/conversations/${activeId}/messages`, { body: text });
      setMessageText('');
      await loadMessages(activeId);
    } catch (err) {
      toast(err?.response?.data?.error || 'Send failed', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-shell">
      <section className="chat-list card">
        <div className="chat-list__head">
          <h2 style={{ margin: 0 }}>Chat</h2>
          <button className="btn btn--ghost" type="button" style={{ padding: '6px 10px' }} onClick={() => loadConversations().catch(() => {})}>
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="hint">Loading...</div>
        ) : (
          <div className="chat-list__items">
            {(conversations || []).map((c) => {
              const peer = c.peer || {};
              const isActive = Number(activeId) === Number(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`chat-item ${isActive ? 'chat-item--active' : ''}`}
                  onClick={() => setActiveId(c.id)}
                >
                  <div className="card__row" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <div className="card__row" style={{ minWidth: 0 }}>
                      {peer.avatar_url ? (
                        <img className="avatar avatar--sm avatar--photo" src={peer.avatar_url} alt={peer.username || 'User'} />
                      ) : (
                        <div className="avatar avatar--sm" />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {peer.name || peer.username || c.title || 'Conversation'}
                          </strong>
                          {c.unread_count ? <span className="badge">{c.unread_count}</span> : null}
                        </div>
                        <div className="hint" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.last_message?.body || (c.last_message?.type ? `[${c.last_message.type}]` : 'No messages yet')}
                        </div>
                      </div>
                    </div>
                    <div className="hint" style={{ margin: 0, flex: '0 0 auto' }}>
                      {formatTime(c.last_message?.created_at || c.created_at)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="chat-panel card">
        <div className="chat-panel__head">
          <div className="card__row">
            {active?.peer?.avatar_url ? (
              <img className="avatar avatar--sm avatar--photo" src={active.peer.avatar_url} alt={active.peer.username} />
            ) : (
              <div className="avatar avatar--sm" />
            )}
            <div>
              <strong>{active?.peer?.name || active?.peer?.username || active?.title || 'Chat'}</strong>
              <div className="hint" style={{ margin: 0 }}>
                {active?.peer?.is_online ? 'Active now' : (active?.peer?.last_seen_at ? `Active ${formatTime(active.peer.last_seen_at)}` : 'Offline')}
              </div>
            </div>
          </div>
        </div>

        <div className="chat-panel__messages">
          {(messages || []).map((m) => {
            const mine = Number(m.sender_id) === Number(user?.id);
            return (
              <div key={m.id} className={`chat-message ${mine ? 'chat-message--own' : ''}`}>
                {mine ? null : (
                  m.avatar_url ? (
                    <img className="chat-message__avatar" src={m.avatar_url} alt={m.username || 'User'} />
                  ) : (
                    <div className="chat-message__avatar" />
                  )
                )}
                <div className="chat-message__body">
                  {m.body ? <div className="chat-message__text">{m.body}</div> : null}
                  {(m.attachments || []).map((a) => {
                    if (!a || !a.url) return null;
                    if (a.media_type === 'video') {
                      return (
                        <video key={a.url} className="post__media-video" controls preload="metadata" src={a.url} style={{ marginTop: 10 }} />
                      );
                    }
                    return (
                      <img key={a.url} className="post__media-img" src={a.url} alt="Attachment" loading="lazy" style={{ marginTop: 10 }} />
                    );
                  })}
                  <div className="chat-message__meta">{formatTime(m.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>

        <form className="chat-panel__input" onSubmit={sendMessage}>
          <input
            className="input"
            placeholder={activeId ? 'Type a message...' : 'Select a conversation'}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            disabled={!activeId || sending}
          />
          <button className="btn btn--primary" type="submit" disabled={!activeId || sending}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  );
};
