import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const UIContext = createContext(null);

const TOAST_ICONS = { success: "check_circle", error: "error", info: "info" };
const TOAST_COLORS = {
  success: "border-emerald-600/20 bg-white text-emerald-800 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300",
  error: "border-red-600/20 bg-white text-red-700 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300",
  info: "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200",
};
const TOAST_ICON_COLORS = { success: "text-emerald-600", error: "text-red-600", info: "text-slate-500" };

function Dialog({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-white p-7 shadow-xl sm:p-8 dark:bg-slate-950 dark:border dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [current, setCurrent] = useState(null);
  const queueRef = useRef([]);

  const advance = useCallback(() => {
    queueRef.current.shift();
    setCurrent(queueRef.current[0] ?? null);
  }, []);

  const dismissAlert = useCallback(() => {
    if (current?.kind === "alert" && current.onClose) current.onClose();
    advance();
  }, [current, advance]);

  useEffect(() => {
    if (current?.kind === "alert" && current.autoDismiss) {
      const t = setTimeout(dismissAlert, current.autoDismiss);
      return () => clearTimeout(t);
    }
  }, [current, dismissAlert]);

  const show = useCallback((message, type = "success") => {
    if (type === "success") {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
      return;
    }
    queueRef.current.push({
      kind: "alert",
      title: type === "info" ? "Notice" : "Something went wrong",
      message,
      type,
      okLabel: "OK",
    });
    setCurrent((c) => c ?? queueRef.current[0]);
  }, []);

  const showDialog = useCallback(({ title, message, type = "info", okLabel = "OK", autoDismiss, onClose }) => {
    queueRef.current.push({ kind: "alert", title, message, type, okLabel, autoDismiss, onClose });
    setCurrent((c) => c ?? queueRef.current[0]);
  }, []);

  const confirm = useCallback(({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "primary" }) => {
    return new Promise((resolve) => {
      queueRef.current.push({ kind: "confirm", title, message, confirmLabel, cancelLabel, tone, resolve });
      setCurrent((c) => c ?? queueRef.current[0]);
    });
  }, []);

  const resolveConfirm = useCallback(
    (value) => {
      if (current?.kind === "confirm") current.resolve(value);
      advance();
    },
    [current, advance]
  );

  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <UIContext.Provider value={{ show, showDialog, confirm }}>
      {children}

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg max-w-sm ${TOAST_COLORS[t.type]}`}>
            <span className={`material-symbols-outlined text-lg leading-none mt-0.5 ${TOAST_ICON_COLORS[t.type]}`} aria-hidden="true">
              {TOAST_ICONS[t.type]}
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-lg leading-none" aria-hidden="true">close</span>
            </button>
          </div>
        ))}
      </div>

      {current?.kind === "alert" && (
        <Dialog onClose={dismissAlert}>
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">{current.title}</h3>
          <p className="mt-2 text-base leading-snug text-slate-600 dark:text-slate-300">{current.message}</p>
          <div className="mt-6 flex justify-end">
            <button className="btn-primary px-8 !py-2.5" onClick={dismissAlert}>{current.okLabel}</button>
          </div>
        </Dialog>
      )}

      {current?.kind === "confirm" && (
        <Dialog onClose={() => resolveConfirm(false)}>
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">{current.title}</h3>
          {current.message && <p className="mt-2 text-base leading-snug text-slate-600 dark:text-slate-300">{current.message}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn-outline !py-2.5 !px-6" onClick={() => resolveConfirm(false)}>{current.cancelLabel}</button>
            <button className={current.tone === "danger" ? "btn-danger !py-2.5 !px-6" : "btn-primary !py-2.5 !px-6"} onClick={() => resolveConfirm(true)}>
              {current.confirmLabel}
            </button>
          </div>
        </Dialog>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
