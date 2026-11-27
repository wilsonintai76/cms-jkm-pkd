import React from "react";
import { Building2, Database } from "lucide-react";
import { NAV_ITEMS } from "../constants";
import { fmt } from "../lib/format";

type SidebarProps = {
  activeNav: string;
  onNavigate: (id: string) => void;
  logoUri: string | null;
  institution?: string;
  department?: string;
  sltGrand: number;
  targetSlt: number;
  caWeight?: number;
  feWeight?: number;
  savedCount: number;
};

export default function Sidebar({
  activeNav,
  onNavigate,
  logoUri,
  institution,
  department,
  sltGrand,
  targetSlt,
  caWeight,
  feWeight,
  savedCount,
}: SidebarProps) {
  const sltBalanced = Math.abs(sltGrand - targetSlt) < 0.05;

  return (
    <aside className="no-print w-64 bg-slate-950 text-slate-200 flex flex-col justify-between p-4 border-r border-slate-800 shrink-0">
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
          {logoUri ? (
            <img src={logoUri} alt="Logo" className="max-h-14 mx-auto object-contain" />
          ) : (
            <Building2 className="w-8 h-8 mx-auto text-amber-400" />
          )}
          <div className="text-xs font-bold text-white leading-snug">
            {(institution || "POLITEKNIK MALAYSIA").replace("POLITEKNIK MALAYSIA - ", "POLITEKNIK ")}
          </div>
          <div className="text-[10px] text-slate-400">{department}</div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-bold tracking-widest text-slate-500 px-2 pb-1">MENU UTAMA</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active ? "bg-sky-600 text-white shadow" : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
        <div className="text-[10px] font-bold text-slate-400">RINGKASAN KURSUS AKTIF</div>
        <div className={`font-bold ${sltBalanced ? "text-emerald-400" : "text-amber-400"}`}>
          SLT: {fmt(sltGrand)} / {targetSlt} jam
        </div>
        <div className="text-[11px] text-slate-400">
          CA {caWeight}% | FE {feWeight}%
        </div>
        <div className="text-[11px] text-sky-400 flex items-center gap-1">
          <Database className="w-3 h-3" /> SQLite: {savedCount} rekod
        </div>
      </div>
    </aside>
  );
}
