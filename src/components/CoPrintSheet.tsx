import React from "react";
import { DEFAULT_DOC_CODE, F2F_FIELDS, NF2F_FIELDS, PLO_CATALOG, SLT_FIELDS } from "../constants";
import { fmt, topicTotalSlt } from "../lib/format";
import type { Course } from "../lib/calc";

type CoPrintSheetProps = {
  course: Course;
  logoUri: string | null;
  uniquePlos: string[];
  sltTotals: Record<string, number>;
};

/** Pratonton rasmi Lampiran 4 (PLSP-04) — tiga halaman bercetak. */
export default function CoPrintSheet({ course, logoUri, uniquePlos, sltTotals }: CoPrintSheetProps) {
  const docCode = course.doc_code || DEFAULT_DOC_CODE;

  return (
    <div
      id="printable-co-doc"
      className="print-sheet bg-white max-w-[210mm] mx-auto p-8 border border-slate-300 shadow-sm text-[9.5pt] text-black font-[Arial]"
    >
      <div className="co-page">
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr>
              <td colSpan={3} className="border border-black p-3 text-center">
                {logoUri ? (
                  <img src={logoUri} alt="Logo" className="max-h-16 mx-auto mb-1 object-contain" />
                ) : (
                  <div className="font-bold text-[11pt]">{course.institution}</div>
                )}
                <div className="font-bold text-[10.5pt]">{course.department}</div>
                <div className="font-bold text-[10.5pt]">COURSE OUTLINE</div>
              </td>
            </tr>
            <tr>
              <td rowSpan={2} className="border border-black p-1.5 font-bold w-8 align-top">1.</td>
              <td className="border border-black p-1.5 font-bold bg-slate-100 w-48">NAME OF COURSE</td>
              <td className="border border-black p-1.5 font-bold">{course.course_name}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-bold bg-slate-100">COURSE CODE</td>
              <td className="border border-black p-1.5 font-bold">{course.course_code}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-bold">2.</td>
              <td className="border border-black p-1.5 font-bold bg-slate-100">SYNOPSIS</td>
              <td className="border border-black p-1.5 text-justify">{course.synopsis}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-bold">3.</td>
              <td className="border border-black p-1.5 font-bold bg-slate-100">CREDIT VALUE</td>
              <td className="border border-black p-1.5">{course.credit_value}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-bold">4.</td>
              <td className="border border-black p-1.5 font-bold bg-slate-100">PRE-REQUISITE/ CO-REQUISITE (IF ANY)</td>
              <td className="border border-black p-1.5">{course.prerequisite}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-bold align-top">5.</td>
              <td colSpan={2} className="border border-black p-2 space-y-2">
                <div className="font-bold">COURSE LEARNING OUTCOMES(CLO):</div>
                <div>Upon completion of this course, students should be able to:</div>
                {course.clos.map((c: Record<string, any>, i: number) => (
                  <div key={i} className="flex gap-3">
                    <span className="font-bold w-12 shrink-0">{c.code}</span>
                    <span>
                      {c.statement} ({c.taxonomy}, {c.plo})
                    </span>
                  </div>
                ))}
                <div className="font-bold pt-2">PROGRAMME LEARNING OUTCOMES (PLO):</div>
                {uniquePlos.map((p) => (
                  <div key={p} className="flex gap-2">
                    <span className="font-bold w-14 shrink-0">{p} :</span>
                    <span className="text-justify">{PLO_CATALOG[p]}</span>
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="co-footnote mt-1">{docCode}</div>
      </div>

      <div className="co-page">
        <div className="co-frame">
          <div className="font-bold mb-1">6. ASSESSMENT METHOD:</div>
          <div className="ml-4 mb-2">
            <div>Continuous Assessment (CA) – {course.ca_weight}%</div>
            <div>Final Examination (FE) – {course.fe_weight > 0 ? `${course.fe_weight}%` : "None"}</div>
          </div>
          <table className="w-3/4 mx-auto border-collapse border border-black mb-3">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-1 text-left">Assessment</th>
                <th className="border border-black p-1">Quantity</th>
                <th className="border border-black p-1">Percentage (%)</th>
              </tr>
            </thead>
            <tbody>
              {course.assessments.map((a: Record<string, any>, i: number) => (
                <tr key={i}>
                  <td className="border border-black p-1">{a.name}</td>
                  <td className="border border-black p-1 text-center">{a.quantity}</td>
                  <td className="border border-black p-1 text-center">{a.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="font-bold mt-4 mb-1">7. DISTRIBUTION OF STUDENT LEARNING TIME</div>
          <table className="slt-table w-full border-collapse border border-black text-center">
            <colgroup>
              <col style={{ width: "11mm" }} />
              {SLT_FIELDS.map((f) => (
                <col key={f.key} />
              ))}
              <col style={{ width: "12mm" }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-black vert">TOPIC</th>
                <th colSpan={F2F_FIELDS.length} className="border border-black p-1 grp">
                  GUIDED LEARNING (F2F) HOURS
                </th>
                <th colSpan={NF2F_FIELDS.length} className="border border-black p-1 grp">
                  INDEPENDENT LEARNING (NF2F) HOURS
                </th>
                <th rowSpan={2} className="border border-black vert">TOTAL OF SLT (HOURS)</th>
              </tr>
              <tr className="bg-slate-100">
                {[...F2F_FIELDS, ...NF2F_FIELDS].map((f) => (
                  <th key={f.key} className="border border-black vert">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {course.topics.map((t: Record<string, any>, i: number) => (
                <tr key={i}>
                  <td className="border border-black p-1 font-bold">Topik {i + 1}</td>
                  {SLT_FIELDS.map((f) => (
                    <td key={f.key} className="border border-black p-1">{fmt(t[f.key])}</td>
                  ))}
                  <td className="border border-black p-1 font-bold">{fmt(topicTotalSlt(t))}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td className="border border-black p-1">Total</td>
                {SLT_FIELDS.map((f) => (
                  <td key={f.key} className="border border-black p-1">{fmt(sltTotals[f.key])}</td>
                ))}
                <td className="border border-black p-1">{fmt(sltTotals.grand)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="co-footnote mt-1">{docCode}</div>
      </div>

      <div className="co-page">
        <div className="co-frame">
          <div className="font-bold mb-1">8. WEEKLY SCHEDULE</div>
          <table className="w-full border-collapse border border-black text-[8.8pt] mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-1 w-14">TOPIC</th>
                <th className="border border-black p-1">TOPIC/CONTENT</th>
                <th className="border border-black p-1 w-28">RECOMMENDED CONTACT HOURS</th>
                <th className="border border-black p-1 w-28">ASSESSMENT METHOD</th>
                <th className="border border-black p-1 w-16">WEEK</th>
              </tr>
            </thead>
            <tbody>
              {course.topics.map((t: Record<string, any>, i: number) => (
                <tr key={i}>
                  <td className="border border-black p-1.5 text-center font-bold align-top">{t.code}</td>
                  <td className="border border-black p-1.5 text-justify align-top">
                    <div className="font-bold uppercase mb-0.5">{t.title}</div>
                    <div>{t.narrative}</div>
                  </td>
                  <td className="border border-black p-1.5 text-center align-top">{t.contact_desc}</td>
                  <td className="border border-black p-1.5 text-center align-top whitespace-pre-line">{t.assessment_method}</td>
                  <td className="border border-black p-1.5 text-center align-top">{t.week}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="font-bold mb-1">9. REFERENCES</div>
          <div className="border border-black p-2 text-[9pt] mb-6">
            <div className="font-bold">Main references supporting the course :</div>
            {course.main_references.map((r: string, i: number) => (
              <div key={i} className="ml-3">{r}</div>
            ))}
            <div className="font-bold mt-2">Additional references supporting the course :</div>
            {course.additional_references.map((r: string, i: number) => (
              <div key={i} className="ml-3">{r}</div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-8 text-[9pt] mt-6">
            <div>
              <div>Prepared by:</div>
              <div className="h-12" />
              <div className="border-t border-dotted border-black pt-1">
                {course.prepared_by || "(Tandatangan dan Nama Penyelaras Kursus)"}
              </div>
              <div>Date: {course.prepared_date}</div>
            </div>
            <div>
              <div>Verified by:</div>
              <div className="h-12" />
              <div className="border-t border-dotted border-black pt-1">
                {course.verified_by || "(Tandatangan dan Nama KJ/KPro/KK)"}
              </div>
              <div>Date: {course.verified_date}</div>
            </div>
          </div>
        </div>
        <div className="co-footnote mt-1">{docCode}</div>
      </div>
    </div>
  );
}
