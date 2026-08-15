export default function Modal({ open, title, onClose, children, wide = false, xwide = false, hideScroll = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${xwide ? "max-w-5xl" : wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto${hideScroll ? " [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="inline-flex items-center justify-center h-8 w-8 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
