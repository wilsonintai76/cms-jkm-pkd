import React from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { PLO_CATALOG } from "../constants";
import type { Course } from "../lib/calc";

type CourseInfoPanelProps = {
  course: Course;
  checklist: [string, boolean][];
  onChange: (next: Course) => void;
};

export default function CourseInfoPanel({ course, checklist, onChange }: CourseInfoPanelProps) {
  const setField = (key: string, value: unknown) => onChange({ ...course, [key]: value });

  const updateClo = (idx: number, patch: Record<string, unknown>) => {
    const next = [...course.clos];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...course, clos: next });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2">
        <div className="text-xs font-bold text-sky-950">
          Status Semakan 13 Item Silibus ({checklist.filter((x) => x[1]).length}/13 Lengkap)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {checklist.map(([lbl, ok]) => (
            <span
              key={lbl}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 ${
                ok ? "bg-emerald-600 text-white" : "bg-white text-slate-500 border border-slate-300"
              }`}
            >
              {ok && <CheckCircle2 className="w-3 h-3" />} {lbl}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h2 className="text-base font-bold">Item 1 – 5: Identiti Kursus & Sinopsis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Nama Kursus</span>
            <input
              value={course.course_name}
              onChange={(e) => setField("course_name", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Kod Kursus</span>
            <input
              value={course.course_code}
              onChange={(e) => setField("course_code", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Nilai Kredit</span>
            <input
              type="number"
              min="1"
              max="12"
              value={course.credit_value}
              onChange={(e) => setField("credit_value", Number(e.target.value) || 3)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </label>
        </div>
        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-600">Sinopsis</span>
          <textarea
            rows={3}
            value={course.synopsis}
            onChange={(e) => setField("synopsis", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Item 6 & 7: Course Learning Outcomes (CLO) & PLO</h2>
          <button
            onClick={() =>
              onChange({
                ...course,
                clos: [...course.clos, { code: `CLO${course.clos.length + 1}`, statement: "", taxonomy: "C3", plo: "PLO1" }],
              })
            }
            className="px-3 py-1.5 rounded-lg border border-sky-300 text-sky-700 text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah CLO
          </button>
        </div>
        {course.clos.map((c: Record<string, any>, idx: number) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start text-xs border-b border-slate-100 pb-2">
            <input
              value={c.code}
              onChange={(e) => updateClo(idx, { code: e.target.value })}
              className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
            />
            <input
              value={c.statement}
              onChange={(e) => updateClo(idx, { statement: e.target.value })}
              className="col-span-6 border border-slate-300 rounded-lg px-2 py-1.5"
            />
            <input
              value={c.taxonomy}
              onChange={(e) => updateClo(idx, { taxonomy: e.target.value })}
              className="col-span-1 border border-slate-300 rounded-lg px-2 py-1.5 text-center"
            />
            <select
              value={c.plo}
              onChange={(e) => updateClo(idx, { plo: e.target.value })}
              className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5"
            >
              {Object.keys(PLO_CATALOG).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              onClick={() => onChange({ ...course, clos: course.clos.filter((_: unknown, i: number) => i !== idx) })}
              className="col-span-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg flex justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
