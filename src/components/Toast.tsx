import React from "react";
import { AlertCircle } from "lucide-react";

const TONE: Record<string, string> = {
  success: "bg-emerald-600",
  error: "bg-rose-600",
  warning: "bg-amber-600",
  info: "bg-sky-600",
};

type ToastProps = { toast: { msg: string; type: string } | null };

export default function Toast({ toast }: ToastProps) {
  if (!toast) return null;
  return (
    <div
      className={`no-print fixed bottom-16 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold text-white flex items-center gap-2 ${
        TONE[toast.type] || TONE.info
      }`}
    >
      <AlertCircle className="w-4 h-4" />
      <span>{toast.msg}</span>
    </div>
  );
}
