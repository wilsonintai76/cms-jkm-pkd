import React, { useRef, useState } from "react";
import { FileText, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  computeProgStats,
  nextSessionOf,
  prevSessionOf,
  tumpangOf,
} from "../lib/cqi";
import type { CqiBundle } from "../lib/cqi";

type CqiImportPanelProps = {
  bundle: CqiBundle;
  busy: boolean;
  apiOnline: boolean;
  savedList: { course_code: string; session?: string; updated_at?: string }[];
  onChange: (next: CqiBundle) => void;
  onUpload: (files: File[]) => void;
  onSelectProgramme: (prog: string) => void;
  onOpenBorang: (prog: string) => void;
  onOpenSaved: (code: string) => void;
  onDeleteSaved: (code: string) => void;
};

const FIELD =
  "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-200";

export default function CqiImportPanel({
  bundle,
  busy,
  apiOnline,
  savedList,
  onChange,
  onUpload,
  onSelectProgramme,
  onOpenBorang,
  onOpenSaved,
  onDeleteSaved,
}: CqiImportPanelProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const meta = bundle.meta;

  const patchMeta = (patch: Partial<typeof meta>) => onChange({ ...bundle, meta: { ...meta, ...patch } });

  const changeSession = (value: string) => {
    const autoPrev = prevSessionOf(meta.currSession);
    const autoNext = nextSessionOf(meta.currSession);
    patchMeta({
      currSession: value,
      prevSession: !meta.prevSession || meta.prevSession === autoPrev ? prevSessionOf(value) : meta.prevSession,
      nextSession: !meta.nextSession || meta.nextSession === autoNext ? nextSessionOf(value) : meta.nextSession,
    });
  };

  const accept = (list: FileList | null) => {
    const files = Array.from(list || []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (files.length) onUpload(files);
  };

  const hasData = bundle.students.length > 0 || Boolean(bundle.corr);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600" /> 1. Muat Naik PBCLOGSA &amp; CORR Panitia
            </h2>
            {bundle.sources.length > 0 && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy || !apiOnline}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Tambah fail
              </button>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              accept(e.dataTransfer.files);
            }}
            onClick={() => !busy && inputRef.current?.click()}
            className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-2xl cursor-pointer transition text-center p-4 ${
              dragging ? "border-sky-500 bg-sky-50" : "border-sky-300 bg-sky-50/50 hover:bg-sky-50"
            }`}
          >
            <Upload className="w-8 h-8 text-sky-600 mb-1.5" />
            <span className="text-sm font-semibold text-slate-800">
              {busy ? "Sedang mengekstrak PDF..." : "Klik atau lepas fail PDF markah & CORR di sini"}
            </span>
            <span className="text-[11px] text-slate-500 mt-1">
              PBCLOGSA (.pdf) + CORR panitia (.pdf) — boleh pilih berbilang fail serentak
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                accept(e.target.files);
                e.target.value = "";
              }}
              disabled={busy}
            />
          </div>

          {!apiOnline && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Pelayan FastAPI tidak aktif — pengekstrakan PDF CQI memerlukan backend.
            </div>
          )}

          {bundle.sources.length > 0 && (
            <div className="space-y-1.5">
              {bundle.sources.map((src) => (
                <div
                  key={src.name}
                  className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                >
                  <span className="font-semibold text-slate-800 truncate">{src.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        src.kind === "corr"
                          ? "bg-violet-50 text-violet-700 border-violet-200"
                          : src.kind === "pbclogsa"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {src.kind === "corr" ? "CORR" : src.kind === "pbclogsa" ? "PBCLOGSA" : "TIDAK DIKENALI"}
                    </span>
                    <span className="text-slate-500">{src.count} pelajar</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2.5">
          <h2 className="text-base font-bold">Maklumat Kepala Laporan</h2>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Kod Kursus</span>
            <input className={FIELD} value={meta.code} onChange={(e) => patchMeta({ code: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Nama Kursus</span>
            <input className={FIELD} value={meta.name} onChange={(e) => patchMeta({ name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Jabatan</span>
            <input className={FIELD} value={meta.jabatan} onChange={(e) => patchMeta({ jabatan: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Nama Penyelaras Kursus</span>
            <input
              className={FIELD}
              value={meta.coordinator}
              onChange={(e) => patchMeta({ coordinator: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-1 gap-2 pt-1">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Sesi Semasa</span>
              <input
                className={FIELD}
                placeholder="II : 2025/2026"
                value={meta.currSession}
                onChange={(e) => changeSession(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">Sesi Terdahulu</span>
                <input
                  className={FIELD}
                  value={meta.prevSession}
                  onChange={(e) => patchMeta({ prevSession: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">Sesi Hadapan</span>
                <input
                  className={FIELD}
                  value={meta.nextSession}
                  onChange={(e) => patchMeta({ nextSession: e.target.value })}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pt-1">
              <input
                type="checkbox"
                checked={meta.hasClo4}
                onChange={(e) => patchMeta({ hasClo4: e.target.checked })}
                className="rounded border-slate-300"
              />
              Kursus ini mempunyai CLO4
            </label>
          </div>
        </div>
      </div>

      {hasData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Ringkasan Mengikut Program</h2>
            <span className="text-[11px] text-slate-500">
              {bundle.students.length} pelajar • {bundle.programmes.length} program
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {bundle.programmes.map((prog) => {
              const st = computeProgStats(bundle.students, prog, meta.hasClo4);
              const tumpang = tumpangOf(bundle.students, prog).length;
              return (
                <div key={prog} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-extrabold text-slate-900">{prog}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {st.n} pelajar
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">Kelas: {st.classes.join(", ") || "-"}</div>
                  <div className="text-[11px] text-slate-600">
                    Lulus semua CLO: <strong>{st.passAllPct.toFixed(1)}%</strong> ({st.passAll}/{st.n})
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`rounded-md py-1 font-bold ${
                          st.passCloPct[i] >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        CLO{i + 1}
                        <div className="text-[10px] font-semibold">{st.passCloPct[i].toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                  {tumpang > 0 && (
                    <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1">
                      {tumpang} pelajar program lain diasingkan (tumpang kelas)
                    </div>
                  )}
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      onClick={() => onSelectProgramme(prog)}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700"
                    >
                      Template CORR
                    </button>
                    <button
                      onClick={() => onOpenBorang(prog)}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-[11px] font-semibold text-white"
                    >
                      Borang CQI
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {bundle.corr && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 space-y-1.5">
              <div className="text-xs font-bold text-violet-900">
                CORR Panitia dikesan — Program {bundle.corr.programme || "-"} • {bundle.corr.studentCount} pelajar •{" "}
                {bundle.corr.date || "tarikh tiada"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {bundle.corr.indicators.map((ind, i) => {
                  const ok = ind.achievement >= ind.target;
                  return (
                    <div key={i} className="bg-white rounded-lg border border-violet-100 px-2 py-1.5">
                      <div className="text-[10px] text-slate-600 line-clamp-2 h-7">{ind.label}</div>
                      <div className={`text-xs font-extrabold ${ok ? "text-emerald-700" : "text-rose-700"}`}>
                        {ind.achievement}% <span className="font-normal text-slate-400">/ {ind.target}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {savedList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Rekod CQI Tersimpan (SQLite)</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              cqi_reports
            </span>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {savedList.map((rec) => (
              <div
                key={rec.course_code}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900">{rec.course_code}</div>
                  <div className="text-[10px] text-slate-500">
                    {rec.session || "sesi tiada"} • {rec.updated_at || ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onOpenSaved(rec.course_code)}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
                  >
                    Buka
                  </button>
                  <button
                    onClick={() => onDeleteSaved(rec.course_code)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
