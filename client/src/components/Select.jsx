import { useEffect, useMemo, useRef, useState } from "react";
import { Children } from "react";
import { createPortal } from "react-dom";

const LIST_HEIGHT = 260;

export default function Select({
  className = "",
  children,
  value,
  onChange,
  disabled = false,
  placeholder,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);

  const options = useMemo(() => {
    const out = [];
    Children.forEach(children, (child) => {
      if (child && typeof child === "object" && "props" in child && child.props.children !== undefined) {
        const label = child.props.children;
        const labelText = Array.isArray(label) ? label.join("") : String(label);
        out.push({
          value: child.props.value !== undefined ? child.props.value : labelText,
          label: labelText,
        });
      }
    });
    return out;
  }, [children]);

  const selected = options.find((o) => o.value === value);
  const display =
    selected?.label ?? placeholder ?? (options[0]?.value === "" ? options[0].label : "Select an option");

  const close = () => setOpen(false);

  const openList = () => {
    const rect = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const upward = below < LIST_HEIGHT + 8 && rect.top - 8 > LIST_HEIGHT + 8;
    const top = upward ? Math.max(8, rect.top - 8 - LIST_HEIGHT) : rect.bottom + 6;
    setPos({ top, left: rect.left, width: rect.width, upward });
    setHi(0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (listRef.current && listRef.current.contains(e.target)) return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  const pick = (opt) => {
    close();
    if (opt.value !== value && onChange) onChange({ target: { value: opt.value } });
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[hi];
      if (opt && opt.value !== "") pick(opt);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors select-none cursor-pointer
          hover:border-slate-300 hover:bg-slate-50
          focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25 focus:outline-none
          disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400
          dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200
          dark:hover:border-slate-600 dark:hover:bg-slate-800
          dark:disabled:bg-slate-800 dark:disabled:text-slate-500 ${className}`}
      >
        <span className={`truncate ${display && !selected ? "text-slate-400" : ""}`}>{display}</span>
        <span
          className={`material-symbols-outlined shrink-0 !text-base !leading-none text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 90 }}
            className="rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10"
          >
            <ul className="max-h-[260px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {options.map((opt, i) => {
                const isPlaceholder = opt.value === "";
                const isSel = selected && opt.value === selected.value;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      disabled={isPlaceholder}
                      onMouseEnter={() => setHi(i)}
                      onClick={() => pick(opt)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm truncate transition-colors ${
                        isPlaceholder
                          ? "pointer-events-none cursor-default text-slate-400"
                          : isSel
                            ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                            : hi === i
                              ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                              : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
