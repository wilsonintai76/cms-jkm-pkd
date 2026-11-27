import React from "react";
import { Download, Printer } from "lucide-react";
import CoEditor from "./CoEditor";
import CoPrintSheet from "./CoPrintSheet";
import SltReview from "./SltReview";
import type { Course } from "../lib/calc";

type CourseOutlineModuleProps = {
  course: Course;
  subView: string;
  onSubViewChange: (view: string) => void;
  sltTotals: Record<string, number>;
  targetSlt: number;
  busy: boolean;
  logoUri: string | null;
  uniquePlos: string[];
  onChange: (next: Course) => void;
  onRegenerate: (mode: "fast" | "ai") => void;
  onAutoBalance: () => void;
  onExportWord: (elementId: string, filename: string, landscape?: boolean) => void;
  onPrint: () => void;
};

const TABS = [
  { id: "edit", label: "1. Jadual Mingguan & Matriks SLT" },
  { id: "preview", label: "2. Pratonton Rasmi Lampiran 4 (PLSP-04)" },
  { id: "slt", label: "3. Semak SLT" },
];

export default function CourseOutlineModule({
  course,
  subView,
  onSubViewChange,
  sltTotals,
  targetSlt,
  busy,
  logoUri,
  uniquePlos,
  onChange,
  onRegenerate,
  onAutoBalance,
  onExportWord,
  onPrint,
}: CourseOutlineModuleProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-4">
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
            onClick={() => onExportWord("printable-co-doc", `COURSE_OUTLINE_${course.course_code || "PLSP04"}.doc`, false)}
            className="px-3 py-2 rounded-xl border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Word (.doc)
          </button>
          <button
            onClick={onPrint}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak PDF (A4 Potret)
          </button>
        </div>
      </div>

      {subView === "edit" ? (
        <CoEditor
          course={course}
          sltTotals={sltTotals}
          targetSlt={targetSlt}
          busy={busy}
          onChange={onChange}
          onRegenerate={onRegenerate}
          onAutoBalance={onAutoBalance}
        />
      ) : subView === "slt" ? (
        <SltReview course={course} onChange={onChange} onEdit={() => onSubViewChange("edit")} />
      ) : (
        <CoPrintSheet course={course} logoUri={logoUri} uniquePlos={uniquePlos} sltTotals={sltTotals} />
      )}
    </div>
  );
}
