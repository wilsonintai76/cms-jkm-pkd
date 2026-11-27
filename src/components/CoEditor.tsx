import React from "react";
import { Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { SLT_FIELDS } from "../constants";
import { fmt, topicTotalSlt } from "../lib/format";
import { emptyTopic } from "../lib/course";
import type { Course } from "../lib/calc";

type CoEditorProps = {
  course: Course;
  sltTotals: Record<string, number>;
  targetSlt: number;
  busy: boolean;
  onChange: (next: Course) => void;
  onRegenerate: (mode: "fast" | "ai") => void;
  onAutoBalance: () => void;
};

/** Pandangan suntingan untuk Lampiran 4: jadual mingguan + matriks SLT. */
export default function CoEditor({
  course,
  sltTotals,
  targetSlt,
  busy,
  onChange,
  onRegenerate,
  onAutoBalance,
}: CoEditorProps) {
  const updateTopic = (idx: number, patch: Record<string, unknown>) => {
    const next = [...course.topics];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...course, topics: next });
  };

  const addTopic = () => {
    onChange({ ...course, topics: [...course.topics, emptyTopic(`${course.topics.length + 1}.0`)] });
  };

  const removeTopic = (idx: number) => {
    onChange({ ...course, topics: course.topics.filter((_: unknown, i: number) => i !== idx) });
  };

  const autoWeeks = course.week_auto !== false;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">Item 12: Jadual Mingguan & Ringkasan Topik</h2>
          <div className="flex gap-2">
            <label
              title="Julat minggu dikira daripada jam kuliah ÷ jam kontak seminggu"
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={autoWeeks}
                onChange={(e) => onChange({ ...course, week_auto: e.target.checked })}
                className="accent-sky-600"
              />
              Minggu auto
            </label>
            <button
              onClick={addTopic}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Topik
            </button>
            <button
              onClick={() => onRegenerate("fast")}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Jana Ringkasan (Pantas)
            </button>
            <button
              onClick={() => onRegenerate("ai")}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Jana Ringkasan (Gemini AI)
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {course.topics.length === 0 && (
            <div className="p-6 border border-dashed rounded-xl bg-slate-50 text-center text-xs text-slate-500">
              Belum ada topik. Import PDF silibus, atau tekan <strong>Tambah Topik</strong> untuk isi secara manual.
            </div>
          )}
          {course.topics.map((t: Record<string, any>, idx: number) => (
            <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <div className="grid grid-cols-12 gap-2">
                <input
                  value={t.code}
                  onChange={(e) => updateTopic(idx, { code: e.target.value })}
                  className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 bg-white font-bold text-center"
                />
                <input
                  value={t.title}
                  onChange={(e) => updateTopic(idx, { title: e.target.value })}
                  className="col-span-4 border border-slate-300 rounded-lg px-2 py-1.5 bg-white font-bold uppercase"
                />
                <input
                  value={t.contact_desc}
                  onChange={(e) => updateTopic(idx, { contact_desc: e.target.value })}
                  className="col-span-3 border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                />
                <input
                  value={t.week}
                  onChange={(e) => updateTopic(idx, { week: e.target.value })}
                  disabled={autoWeeks}
                  title={autoWeeks ? "Minggu dikira automatik daripada jam kuliah" : "Taip julat minggu"}
                  className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-center font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                />
                <button
                  onClick={() => removeTopic(idx)}
                  title="Padam topik"
                  className="col-span-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg flex justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={2}
                value={t.narrative}
                onChange={(e) => updateTopic(idx, { narrative: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 overflow-x-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Item 8: Distribution of Student Learning Time (SLT)</h2>
            <p className="text-xs text-slate-500">
              Sasaran: <strong>{targetSlt} jam</strong> | Semasa: <strong>{fmt(sltTotals.grand)} jam</strong>
            </p>
          </div>
          <button
            onClick={onAutoBalance}
            className="px-3 py-1.5 rounded-lg border border-sky-300 text-sky-700 hover:bg-sky-50 text-xs font-semibold"
          >
            Auto-Imbang SLT
          </button>
        </div>
        <table className="w-full border-collapse text-xs text-center">
          <thead>
            <tr className="bg-slate-200 font-bold">
              <th className="border border-slate-300 p-1.5">Topik</th>
              {SLT_FIELDS.map((f) => (
                <th key={f.key} className="border border-slate-300 p-1.5">{f.short}</th>
              ))}
              <th className="border border-slate-300 p-1.5 bg-sky-100">Total</th>
            </tr>
          </thead>
          <tbody>
            {course.topics.map((t: Record<string, any>, idx: number) => (
              <tr key={idx}>
                <td className="border border-slate-300 p-1 font-bold bg-slate-50">{t.code}</td>
                {SLT_FIELDS.map((f) => (
                  <td key={f.key} className="border border-slate-300 p-0.5">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={t[f.key] ?? 0}
                      onChange={(e) => updateTopic(idx, { [f.key]: parseFloat(e.target.value) || 0 })}
                      className="w-12 text-center py-0.5 focus:bg-sky-50 outline-none"
                    />
                  </td>
                ))}
                <td className="border border-slate-300 p-1 font-bold bg-sky-50">{fmt(topicTotalSlt(t))}</td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold">
              <td className="border border-slate-300 p-1.5">Total</td>
              {SLT_FIELDS.map((f) => (
                <td key={f.key} className="border border-slate-300 p-1.5">{fmt(sltTotals[f.key])}</td>
              ))}
              <td className="border border-slate-300 p-1.5 bg-sky-200">{fmt(sltTotals.grand)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
