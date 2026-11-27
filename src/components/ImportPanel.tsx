import React from "react";
import { Trash2, Upload } from "lucide-react";

type SavedCourse = {
  course_code: string;
  course_name: string;
  credit_value: number | string;
  updated_at?: string;
};

type ImportPanelProps = {
  busy: boolean;
  apiOnline: boolean;
  dbPath: string;
  savedList: SavedCourse[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpen: (code: string) => void;
  onDelete: (code: string) => void;
  onRetryApi: () => void;
};

export default function ImportPanel({
  busy,
  apiOnline,
  dbPath,
  savedList,
  onUpload,
  onOpen,
  onDelete,
  onRetryApi,
}: ImportPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h2 className="text-base font-bold">Import Silibus (PDF / JSON)</h2>
        <p className="text-xs text-slate-600">
          Muat naik dokumen rasmi <strong>Course Information (.pdf)</strong>. Enjin Python FastAPI akan mengekstrak kesemua 13 item silibus, membina Course Outline (Lampiran 4) & JSU PB, serta menyimpannya ke SQLite.
        </p>

        <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-sky-300 rounded-2xl bg-sky-50/50 hover:bg-sky-50 cursor-pointer transition p-6 text-center">
          <Upload className="w-9 h-9 text-sky-600 mb-2" />
          <span className="text-sm font-semibold text-slate-800">
            {busy ? "Sedang mengekstrak PDF silibus..." : "Klik untuk pilih Fail PDF Silibus (.pdf) atau JSON"}
          </span>
          <span className="text-xs text-slate-500 mt-1">PyMuPDF + Koordinat 2D Seksyen 13 + Hybrid RapidOCR</span>
          <input type="file" accept=".pdf,.json" className="hidden" onChange={onUpload} disabled={busy} />
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Rekod Kursus Tersimpan (SQLite)</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            co_jsu_records.db
          </span>
        </div>
        {savedList.length === 0 ? (
          <div className="p-8 border border-dashed rounded-xl bg-slate-50 text-center text-xs text-slate-500 space-y-1">
            {apiOnline ? (
              <>
                <div className="font-semibold text-slate-700">Tiada rekod kursus tersimpan lagi.</div>
                <div>Import fail PDF silibus di sebelah kiri untuk mula menyimpan rekod pertama.</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-amber-700">Pelayan FastAPI tidak dapat dihubungi.</div>
                <div>Mod Demo UI aktif — rekod tidak akan disimpan.</div>
                <button
                  onClick={onRetryApi}
                  className="mt-2 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold"
                >
                  Cuba sambung semula
                </button>
              </>
            )}
            {dbPath && <div className="pt-2 text-[10px] text-slate-400 font-mono break-all">{dbPath}</div>}
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {savedList.map((rec) => (
              <div
                key={rec.course_code}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900">
                    {rec.course_code} <span className="text-sky-600 font-normal">({rec.credit_value} Kredit)</span>
                  </div>
                  <div className="text-xs text-slate-700 truncate">{rec.course_name}</div>
                  <div className="text-[10px] text-slate-400">{rec.updated_at}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onOpen(rec.course_code)}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
                  >
                    Buka
                  </button>
                  <button
                    onClick={() => onDelete(rec.course_code)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
