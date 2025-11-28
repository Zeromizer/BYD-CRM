import { createContext, useContext, useState, useCallback } from 'react';
import './Toast.css';

// Toast Context
const ToastContext = createContext(null);

// Toast types with icons
const TOAST_TYPES = {
  success: { icon: '✓', className: 'toast-success' },
  error: { icon: '✕', className: 'toast-error' },
  info: { icon: 'ℹ', className: 'toast-info' },
  warning: { icon: '⚠', className: 'toast-warning' },
  loading: { icon: '↻', className: 'toast-loading' },
};

// Individual Toast component
function ToastItem({ toast, onDismiss }) {
  const { icon, className } = TOAST_TYPES[toast.type] || TOAST_TYPES.info;

  return (
    <div className={`toast-item ${className} ${toast.dismissing ? 'toast-dismissing' : ''}`}>
      <span className={`toast-icon ${toast.type === 'loading' ? 'toast-icon-spin' : ''}`}>
        {icon}
      </span>
      <span className="toast-message">{toast.message}</span>
      {toast.type !== 'loading' && (
        <button className="toast-dismiss" onClick={() => onDismiss(toast.id)}>
          ✕
        </button>
      )}
      {toast.type !== 'loading' && (
        <div className="toast-progress">
          <div
            className="toast-progress-bar"
            style={{ animationDuration: `${toast.duration || 3000}ms` }}
          />
        </div>
      )}
    </div>
  );
}

// Toast Container component
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Toast Provider component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    if (type !== 'loading') {
      // Start dismissing animation before removal
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
        );
      }, duration - 300);

      // Remove after animation
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const updateToast = useCallback((id, message, type = 'success', duration = 3000) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, message, type, duration } : t))
    );

    if (type !== 'loading') {
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
        );
      }, duration - 300);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  // Convenience methods
  const toast = useCallback((message, duration) => addToast(message, 'info', duration), [addToast]);
  toast.success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast]);
  toast.error = useCallback((message, duration = 5000) => addToast(message, 'error', duration), [addToast]);
  toast.warning = useCallback((message, duration = 4000) => addToast(message, 'warning', duration), [addToast]);
  toast.loading = useCallback((message) => addToast(message, 'loading'), [addToast]);
  toast.dismiss = dismissToast;
  toast.update = updateToast;

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastProvider;
