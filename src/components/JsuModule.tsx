import React from "react";
import { Download, Printer } from "lucide-react";
import JsuPrintSheet from "./JsuPrintSheet";
import type { Course, JsuComputed } from "../lib/calc";

type JsuDraft = {
  q_no: string;
  rowIdx: number;
  topic: string;
  domain: string;
  items: number;
  marks: number;
  item_type: string;
};

type JsuModuleProps = {
  course: Course;
  computed: JsuComputed;
  subView: string;
  draft: JsuDraft;
  onSubViewChange: (view: string) => void;
  onDraftChange: (next: JsuDraft) => void;
  onAddQuestion: () => void;
  onChange: (next: Course) => void;
  onExportWord: (elementId: string, filename: string, landscape?: boolean) => void;
  onPrint: () => void;
};

const TABS = [
  { id: "edit", label: "1. Matriks Taksonomi & Pengurusan Soalan" },
  { id: "preview", label: "2. Pratonton Rasmi JSU PB (A4 Landskap)" },
];

const EDITABLE_KEYS = ["vbe", "sc", "dp", "dk", "clo_dp", "item_type"];

export default function JsuModule({
  course,
  computed,
  subView,
  draft,
  onSubViewChange,
  onDraftChange,
  onAddQuestion,
  onChange,
  onExportWord,
  onPrint,
}: JsuModuleProps) {
  const rows: Record<string, any>[] = course.jsu?.rows || [];

  const updateRow = (idx: number, key: string, value: unknown) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [key]: value };
    onChange({ ...course, jsu: { ...course.jsu, rows: next } });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSubViewChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${
                subView === tab.id ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onExportWord("printable-jsu-doc", `JSU_PB_${course.course_code || "KURSUS"}.doc`, true)}
            className="px-3 py-2 rounded-xl border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Word JSU (.doc)
          </button>
          <button
            onClick={onPrint}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak PDF (A4 Landskap)
          </button>
        </div>
      </div>

      {subView === "edit" ? (
        <div className="space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="font-bold text-sky-950">Tambah Soalan & Pemetaan kepada CLO / Penilaian</div>
            <div className="grid grid-cols-2 md:grid-cols-8 gap-2 items-end">
              <label>
                <span className="font-semibold">No. Soalan</span>
                <input
                  value={draft.q_no}
                  onChange={(e) => onDraftChange({ ...draft, q_no: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                />
              </label>
              <label className="col-span-2">
                <span className="font-semibold">Penilaian & CLO</span>
                <select
                  value={draft.rowIdx}
                  onChange={(e) => onDraftChange({ ...draft, rowIdx: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                >
                  {rows.map((r, i) => (
                    <option key={i} value={i}>
                      {r.clo} • {r.kaedah} ({r.weight_pct}%)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="font-semibold">Topik</span>
                <select
                  value={draft.topic}
                  onChange={(e) => onDraftChange({ ...draft, topic: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                >
                  {course.topics.map((t: Record<string, any>, i: number) => (
                    <option key={t.code} value={t.code}>
                      T{i + 1} ({t.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="font-semibold">Domain</span>
                <select
                  value={draft.domain}
                  onChange={(e) => onDraftChange({ ...draft, domain: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                >
                  {["C1", "C2", "C3", "A3"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="font-semibold">Item</span>
                <input
                  type="number"
                  min="1"
                  value={draft.items}
                  onChange={(e) => onDraftChange({ ...draft, items: Number(e.target.value) || 1 })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                />
              </label>
              <label>
                <span className="font-semibold">Markah</span>
                <input
                  type="number"
                  step="0.5"
                  value={draft.marks}
                  onChange={(e) => onDraftChange({ ...draft, marks: Number(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                />
              </label>
              <button
                onClick={onAddQuestion}
                className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold"
              >
                + Tambah
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((r, rIdx) => (
              <div key={rIdx} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-sky-600 text-white font-bold">
                      {r.clo} • PLO {r.plo} • DT {r.dt}
                    </span>
                    <span className="font-bold text-slate-800">
                      {r.kaedah} ({r.instrumen}) — Pemberat: {r.weight_pct}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  {EDITABLE_KEYS.map((k) => (
                    <label key={k}>
                      <span className="text-[10px] font-bold uppercase text-amber-800">{k}</span>
                      <input
                        value={r[k] || ""}
                        placeholder={`Isi ${k.toUpperCase()}`}
                        onChange={(e) => updateRow(rIdx, k, e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <JsuPrintSheet course={course} computed={computed} />
      )}
    </div>
  );
}
