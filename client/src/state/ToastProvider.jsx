import { createContext, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(1);

  const api = useMemo(() => {
    const toast = (message, type = 'info', timeoutMs = 2600) => {
      const text = String(message || '').trim();
      if (!text) return;
      const id = seq.current++;
      setToasts((prev) => prev.concat([{ id, text, type }]));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, Math.max(900, Number(timeoutMs) || 2600));
    };
    return { toast };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider missing');
  return ctx;
};

