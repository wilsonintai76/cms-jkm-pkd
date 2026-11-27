import React from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { PLO_CATALOG } from "../constants";
import type { Course } from "../lib/calc";

const INPUT = "w-full border border-slate-300 rounded-lg px-3 py-2";

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

  const updateAssessment = (idx: number, patch: Record<string, unknown>) => {
    const next = [...course.assessments];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...course, assessments: next });
  };

  const listToText = (list: string[] = []) => list.join("\n");
  const textToList = (text: string) =>
    text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

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
        <div>
          <h2 className="text-base font-bold">Kod Dokumen</h2>
          <p className="text-[11px] text-slate-500">
            Dicetak pada penjuru muka surat Course Outline. Institusi dan jabatan pula diambil
            daripada <strong>Tetapan › 2. Identiti Dokumen</strong>.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Kod Dokumen</span>
            <input
              value={course.doc_code || ""}
              onChange={(e) => setField("doc_code", e.target.value)}
              className={INPUT}
              placeholder="PLSP-04 (4) (26-02-26)"
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h2 className="text-base font-bold">Item 1 – 5: Identiti Kursus &amp; Sinopsis</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Nama Kursus</span>
            <input
              value={course.course_name}
              onChange={(e) => setField("course_name", e.target.value)}
              className={`${INPUT} font-semibold`}
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Kod Kursus</span>
            <input
              value={course.course_code}
              onChange={(e) => setField("course_code", e.target.value)}
              className={`${INPUT} font-semibold`}
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Semester &amp; Tahun Ditawarkan</span>
            <input
              value={course.semester_offered || ""}
              onChange={(e) => setField("semester_offered", e.target.value)}
              className={INPUT}
              placeholder="Semester 1/ Year 1"
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
              className={INPUT}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Pra-syarat / Ko-syarat (jika ada)</span>
            <input
              value={course.prerequisite || ""}
              onChange={(e) => setField("prerequisite", e.target.value)}
              className={INPUT}
              placeholder="None"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Pemberat CA (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={course.ca_weight ?? 50}
                onChange={(e) => setField("ca_weight", Number(e.target.value) || 0)}
                className={INPUT}
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Pemberat FE (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={course.fe_weight ?? 50}
                onChange={(e) => setField("fe_weight", Number(e.target.value) || 0)}
                className={INPUT}
              />
            </label>
          </div>
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

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
        <h2 className="text-base font-bold">Item 9 &amp; 11: Keperluan Khas &amp; Maklumat Tambahan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Keperluan Khas / Sumber</span>
            <textarea
              rows={2}
              value={course.special_requirement || ""}
              onChange={(e) => setField("special_requirement", e.target.value)}
              className={INPUT}
              placeholder="None"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Maklumat Tambahan</span>
            <textarea
              rows={2}
              value={course.other_additional_info || ""}
              onChange={(e) => setField("other_additional_info", e.target.value)}
              className={INPUT}
              placeholder="None"
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
        <h2 className="text-base font-bold">Item 10: Rujukan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Rujukan Utama (satu baris satu rujukan)</span>
            <textarea
              rows={4}
              value={listToText(course.main_references)}
              onChange={(e) => setField("main_references", textToList(e.target.value))}
              className={INPUT}
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Rujukan Tambahan (satu baris satu rujukan)</span>
            <textarea
              rows={4}
              value={listToText(course.additional_references)}
              onChange={(e) => setField("additional_references", textToList(e.target.value))}
              className={INPUT}
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Item 13: Kaedah Penilaian</h2>
          <button
            onClick={() =>
              onChange({
                ...course,
                assessments: [...course.assessments, { name: "", quantity: 1, percentage: 0 }],
              })
            }
            className="px-3 py-1.5 rounded-lg border border-sky-300 text-sky-700 text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Penilaian
          </button>
        </div>
        <div className="space-y-2">
          {course.assessments.map((a: Record<string, any>, idx: number) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={a.name || ""}
                onChange={(e) => updateAssessment(idx, { name: e.target.value })}
                className="col-span-6 border border-slate-300 rounded-lg px-2 py-1.5"
                placeholder="Quiz / Test / Final Examination"
              />
              <label className="col-span-2 flex items-center gap-1">
                <span className="text-[10px] text-slate-500">Bil.</span>
                <input
                  type="number"
                  min="1"
                  value={a.quantity ?? 1}
                  onChange={(e) => updateAssessment(idx, { quantity: Number(e.target.value) || 1 })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-center"
                />
              </label>
              <label className="col-span-3 flex items-center gap-1">
                <span className="text-[10px] text-slate-500">%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={a.percentage ?? 0}
                  onChange={(e) => updateAssessment(idx, { percentage: Number(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-center"
                />
              </label>
              <button
                onClick={() =>
                  onChange({
                    ...course,
                    assessments: course.assessments.filter((_: unknown, i: number) => i !== idx),
                  })
                }
                className="col-span-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg flex justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {course.assessments.length === 0 && (
            <div className="text-[11px] text-slate-500">Belum ada kaedah penilaian.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
        <h2 className="text-base font-bold">Pengesahan Dokumen</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Nama Penyelaras Kursus</span>
            <input
              value={course.prepared_by || ""}
              onChange={(e) => setField("prepared_by", e.target.value)}
              className={INPUT}
              placeholder="Nama penuh"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Tarikh Disediakan</span>
            <input
              value={course.prepared_date || ""}
              onChange={(e) => setField("prepared_date", e.target.value)}
              className={INPUT}
              placeholder="01/01/2026"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Disahkan Oleh (KJ/KPro/KK)</span>
            <input
              value={course.verified_by || ""}
              onChange={(e) => setField("verified_by", e.target.value)}
              className={INPUT}
              placeholder="Nama penuh"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-600">Tarikh Pengesahan</span>
            <input
              value={course.verified_date || ""}
              onChange={(e) => setField("verified_date", e.target.value)}
              className={INPUT}
              placeholder="01/01/2026"
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">
          Nama penyelaras di atas juga mengisi kepala Laporan CQI, bersama jabatan daripada
          Tetapan.
        </p>
      </div>
    </div>
  );
}
