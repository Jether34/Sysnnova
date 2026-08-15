import { useEffect, useState } from "react";
import * as engine from "../offline/engine.js";

export function useSyncStatus() {
  const [status, setStatus] = useState(() => ({
    online: engine.isOnline(),
    syncing: false,
    pending: 0,
    needsAuth: false,
    lastError: "",
  }));

  useEffect(() => {
    return engine.subscribe(setStatus);
  }, []);

  return status;
}

export default function SyncBanner() {
  const { online, syncing, pending, needsAuth, lastError } = useSyncStatus();

  const offline = !online;
  const dirty = pending > 0;

  if (online && !dirty && !needsAuth && !lastError) {
    return (
      <div className="flex items-center gap-1.5 border-b border-emerald-100 bg-emerald-50 px-4 py-1 text-[11px] font-medium text-emerald-700">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">cloud_done</span>
        All changes synced
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b px-4 py-1 text-[11px] font-medium ${
        offline
          ? "border-amber-100 bg-amber-50 text-amber-800"
          : needsAuth
            ? "border-red-100 bg-red-50 text-red-700"
            : "border-sky-100 bg-sky-50 text-sky-800"
      }`}
    >
      {offline && (
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">cloud_off</span>
          You're offline
        </span>
      )}
      {!offline && needsAuth && (
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">sync_problem</span>
          Sign in again to finish syncing
        </span>
      )}
      {!offline && !needsAuth && dirty && (
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">sync</span>
          {syncing ? "Syncing…" : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`}
        </span>
      )}
      {lastError && <span className="text-amber-700/90">{lastError}</span>}
    </div>
  );
}
