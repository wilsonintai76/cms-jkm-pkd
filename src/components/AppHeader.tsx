import React from "react";
import { Building2, Printer, Save } from "lucide-react";

type AppHeaderProps = {
  courseCode?: string;
  session?: string;
  apiOnline: boolean;
  onSave: () => void;
  onPrintCo: () => void;
  onPrintJsu: () => void;
};

export default function AppHeader({ courseCode, session, apiOnline, onSave, onPrintCo, onPrintJsu }: AppHeaderProps) {
  return (
    <header className="no-print sticky top-0 z-30 h-14 bg-slate-900 text-white px-5 flex items-center justify-between border-b border-slate-800 shadow">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide">PORTAL KURIKULUM POLITEKNIK (CO & JSU PB)</div>
          <div className="text-[11px] text-slate-400">
            Tauri 2 + React + FastAPI Sidecar • Format Rasmi Lampiran 4 &amp; JSU PB
            <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300 font-mono">
              v{__APP_VERSION__}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 font-bold text-xs">
          {courseCode || "TIADA KURSUS"}
        </span>
        <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-sky-300 text-[11px] font-semibold">
          Sesi: {session || "-"}
        </span>
        <span
          className={`px-2 py-1 rounded-md text-[11px] font-semibold ${
            apiOnline ? "bg-emerald-900/70 text-emerald-300 border border-emerald-700" : "bg-slate-800 text-slate-400"
          }`}
        >
          {apiOnline ? "FastAPI Aktif" : "Mod Demo UI"}
        </span>
        <button
          onClick={onSave}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" /> Simpan SQLite
        </button>
        <button
          onClick={onPrintCo}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5 text-amber-400" /> Cetak CO
        </button>
        <button
          onClick={onPrintJsu}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5 text-sky-400" /> Cetak JSU
        </button>
      </div>
    </header>
  );
}
