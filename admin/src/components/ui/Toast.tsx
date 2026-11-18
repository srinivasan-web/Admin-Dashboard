import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  id?: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastItem extends ToastOptions {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  createdAt: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toastsState: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  const snapshot = [...toastsState];
  listeners.forEach((listener) => listener(snapshot));
}

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const toast = {
  success(message: string, options?: ToastOptions): string {
    return addToast("success", message, { duration: 4500, title: "Completed", ...options });
  },
  error(message: string, options?: ToastOptions): string {
    return addToast("error", message, { duration: 6000, title: "Error", ...options });
  },
  warning(message: string, options?: ToastOptions): string {
    return addToast("warning", message, { duration: 5000, title: "Warning", ...options });
  },
  info(message: string, options?: ToastOptions): string {
    return addToast("info", message, { duration: 4000, title: "Information", ...options });
  },
  dismiss(id: string) {
    toastsState = toastsState.filter((t) => t.id !== id);
    notify();
  },
  clear() {
    toastsState = [];
    notify();
  },
};

function addToast(type: ToastType, message: string, options?: ToastOptions): string {
  const id = options?.id ?? generateId();
  const duration = options?.duration ?? 4500;

  // If a toast with the same id exists, replace it
  const existingIndex = toastsState.findIndex((t) => t.id === id);
  const newToast: ToastItem = {
    ...options,
    id,
    type,
    message,
    duration,
    createdAt: Date.now(),
  };

  if (existingIndex >= 0) {
    toastsState[existingIndex] = newToast;
  } else {
    // Keep max 5 toasts visible to avoid cluttering screen
    toastsState = [newToast, ...toastsState.slice(0, 4)];
  }

  notify();
  return id;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>(() => [...toastsState]);

  useEffect(() => {
    const listener: ToastListener = (updated) => setToasts(updated);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { toasts, toast };
}

/* ── Individual Toast Item Component ── */
function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(item.duration);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(item.id);
    }, remainingRef.current);
  }, [item.id, onDismiss]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  // Smooth progress bar update
  useEffect(() => {
    if (paused || item.duration <= 0) return;
    const interval = 40;
    const step = (interval / item.duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        return next <= 0 ? 0 : next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [paused, item.duration]);

  const handleMouseEnter = () => {
    setPaused(true);
    pauseTimer();
  };

  const handleMouseLeave = () => {
    setPaused(false);
    startTimer();
  };

  const visuals = {
    success: {
      border: "border-emerald-200/90 hover:border-emerald-300",
      iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-100",
      progressBar: "bg-emerald-500",
      titleColor: "text-emerald-950",
      icon: <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />,
    },
    error: {
      border: "border-red-200/90 hover:border-red-300",
      iconBg: "bg-red-50 text-red-600 border border-red-100",
      progressBar: "bg-red-500",
      titleColor: "text-red-950",
      icon: <AlertCircle size={18} className="text-red-600" aria-hidden="true" />,
    },
    warning: {
      border: "border-amber-200/90 hover:border-amber-300",
      iconBg: "bg-amber-50 text-amber-600 border border-amber-100",
      progressBar: "bg-amber-500",
      titleColor: "text-amber-950",
      icon: <AlertTriangle size={18} className="text-amber-600" aria-hidden="true" />,
    },
    info: {
      border: "border-blue-200/90 hover:border-blue-300",
      iconBg: "bg-blue-50 text-blue-600 border border-blue-100",
      progressBar: "bg-blue-500",
      titleColor: "text-blue-950",
      icon: <Info size={18} className="text-blue-600" aria-hidden="true" />,
    },
  }[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 450, damping: 32 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={item.type === "error" ? "alert" : "status"}
      aria-live={item.type === "error" ? "assertive" : "polite"}
      className={`toast-card pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-2xl border bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur-md transition-shadow hover:shadow-2xl ${visuals.border}`}
      style={{
        boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div className="flex items-start gap-3.5 p-4">
        {/* Type Icon Badge */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${visuals.iconBg}`}
        >
          {visuals.icon}
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1 pt-0.5">
          {item.title && (
            <p className={`text-xs font-bold uppercase tracking-wider ${visuals.titleColor}`}>
              {item.title}
            </p>
          )}
          <p className="mt-0.5 text-xs font-medium text-slate-700 leading-relaxed break-words">
            {item.message}
          </p>

          {/* Action button if provided */}
          {item.action && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  onDismiss(item.id);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-2xs hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900 cursor-pointer"
                style={{ minHeight: "28px", padding: "4px 10px", transform: "none", boxShadow: "none" }}
              >
                {item.action.label}
              </button>
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(item.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-slate-400 cursor-pointer"
          style={{
            minHeight: "28px",
            maxHeight: "28px",
            minWidth: "28px",
            maxWidth: "28px",
            padding: 0,
            transform: "none",
            boxShadow: "none",
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Auto-dismiss animated progress bar */}
      {item.duration > 0 && (
        <div className="h-1 w-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-75 ease-linear ${visuals.progressBar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}

/* ── Main Toaster Stack Container ── */
export function Toaster({
  position = "top-right",
}: {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";
}) {
  const { toasts, toast: toastManager } = useToast();

  const positionClasses = {
    "top-right": "top-5 right-5 sm:top-6 sm:right-6",
    "top-left": "top-5 left-5 sm:top-6 sm:left-6",
    "top-center": "top-5 left-1/2 -translate-x-1/2 sm:top-6",
    "bottom-right": "bottom-5 right-5 sm:bottom-6 sm:right-6",
    "bottom-left": "bottom-5 left-5 sm:bottom-6 sm:left-6",
  }[position];

  return (
    <div
      id="toaster-portal"
      aria-label="Notifications"
      className={`fixed ${positionClasses} z-[99999] flex w-full max-w-sm sm:max-w-md flex-col gap-2.5 pointer-events-none p-1`}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={toastManager.dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
