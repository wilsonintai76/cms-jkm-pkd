import React from "react";
import { fmt } from "../lib/format";
import type { Course, JsuComputed } from "../lib/calc";
import { DEFAULT_DOC_CODE } from "../constants";

type JsuPrintSheetProps = {
  course: Course;
  computed: JsuComputed;
};

/** Pratonton rasmi JSU PB (A4 landskap). */
export default function JsuPrintSheet({ course, computed }: JsuPrintSheetProps) {
  const docCode = course.doc_code || DEFAULT_DOC_CODE;

  return (
    <div
      id="printable-jsu-doc"
      className="jsu-sheet print-sheet bg-white max-w-[297mm] mx-auto p-5 border border-slate-300 shadow-sm text-[7pt] text-black font-[Arial] overflow-x-auto"
    >
      <div className="text-center font-bold tracking-widest text-[8.5pt] mb-1">TERHAD</div>
      <table className="w-full border-collapse border border-black mb-1.5">
        <tbody>
          <tr>
            <td className="border border-black p-1 font-bold bg-slate-100 w-36">INSTITUSI PENYELARAS</td>
            <td className="border border-black p-1">{course.institution.replace("MALAYSIA - ", "")}</td>
            <td rowSpan={5} className="border border-black p-2 text-center font-bold text-[9pt] align-middle">
              JADUAL SPESIFIKASI UJIAN<br />PENTAKSIRAN BERTERUSAN (JSU PB)<br />
              <span className="text-[7.5pt]">BAHAGIAN PEPERIKSAAN DAN PENILAIAN</span>
            </td>
            <td className="border border-black p-1 font-bold bg-slate-100 w-36">VERSI KURIKULUM</td>
            <td className="border border-black p-1">{course.jsu?.curriculum_version}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold bg-slate-100">JABATAN/UNIT AKADEMIK</td>
            <td className="border border-black p-1">{course.department.replace(/^DEPARTMENT OF\s+/i, "")}</td>
            <td className="border border-black p-1 font-bold bg-slate-100">SESI BERKUATKUASA</td>
            <td className="border border-black p-1">{course.jsu?.effective_session}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold bg-slate-100">NAMA PROGRAM</td>
            <td className="border border-black p-1">{course.jsu?.programme_name}</td>
            <td className="border border-black p-1 font-bold bg-slate-100">KOD/NAMA KURSUS</td>
            <td className="border border-black p-1">{course.course_code}/{course.course_name}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold bg-slate-100">NAMA KETUA PROGRAM</td>
            <td className="border border-black p-1">{course.jsu?.head_of_programme}</td>
            <td className="border border-black p-1 font-bold bg-slate-100">NAMA PENSYARAH</td>
            <td className="border border-black p-1">{course.prepared_by}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black p-1" />
            <td className="border border-black p-1 font-bold bg-slate-100">PEMBERAT PENTAKSIRAN</td>
            <td className="border border-black p-1">
              {course.ca_weight}%: PENTAKSIRAN BERTERUSAN<br />
              {course.fe_weight}%: PEPERIKSAAN AKHIR
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border border-black text-[6.4pt] text-center">
        <thead>
          <tr className="bg-slate-100 font-bold">
            <th rowSpan={3} className="border border-black p-1">CLO</th>
            <th rowSpan={3} className="border border-black p-1">PLO</th>
            <th rowSpan={3} className="border border-black p-1">DT</th>
            <th rowSpan={3} className="border border-black p-1">VBE</th>
            <th rowSpan={3} className="border border-black p-1">SC</th>
            <th rowSpan={3} className="border border-black p-1">DP</th>
            <th rowSpan={3} className="border border-black p-1">DK</th>
            <th rowSpan={3} className="border border-black p-1">KAEDAH PENILAIAN</th>
            <th rowSpan={3} className="border border-black p-1">INSTRUMEN</th>
            <th colSpan={Math.max(1, computed.topics.length)} className="border border-black p-1">
              TOPIK / SLT / PERATUS
            </th>
            <th colSpan={8} className="border border-black p-1">DOMAIN TAKSONOMI</th>
            <th rowSpan={3} className="border border-black p-1">JUM. MARKAH</th>
            <th rowSpan={3} className="border border-black p-1">PEMBERAT %</th>
            <th rowSpan={3} className="border border-black p-1">JUM. CLO</th>
            <th colSpan={3} rowSpan={2} className="border border-black p-1">JENIS ITEM</th>
          </tr>
          <tr className="bg-slate-50 font-bold">
            {computed.topics.map((_, i) => (
              <th key={i} className="border border-black p-1">T{i + 1}</th>
            ))}
            <th colSpan={2} className="border border-black p-1">C1</th>
            <th colSpan={2} className="border border-black p-1">C2</th>
            <th colSpan={2} className="border border-black p-1">C3</th>
            <th colSpan={2} className="border border-black p-1">A3</th>
          </tr>
          <tr className="bg-slate-50 text-[5.8pt]">
            {computed.tSlts.map((s, i) => (
              <th key={i} className="border border-black p-0.5">{s.toFixed(1)}</th>
            ))}
            {["ITEM", "MK", "ITEM", "MK", "ITEM", "MK", "ITEM", "MK", "O", "S", "P"].map((h, i) => (
              <th key={i} className="border border-black p-0.5">{h}</th>
            ))}
          </tr>
          <tr className="bg-sky-100 text-[5.8pt]">
            <th colSpan={9} className="border border-black p-0.5 text-right pr-2">PERATUS SLT (%)</th>
            {computed.tPcts.map((p, i) => (
              <th key={i} className="border border-black p-0.5">{p.toFixed(1)}%</th>
            ))}
            <th colSpan={14} className="border border-black p-0.5" />
          </tr>
        </thead>
        <tbody>
          {computed.rows.map((r, idx) => {
            const rm =
              (Number(r.c1_marks) || 0) +
              (Number(r.c2_marks) || 0) +
              (Number(r.c3_marks) || 0) +
              (Number(r.a3_marks) || 0);
            const span = computed.cloSpans[idx];
            const itypes = (r.item_type || "").toUpperCase();
            return (
              <tr key={idx}>
                {span > 0 && (
                  <td rowSpan={span} className="border border-black p-1 font-bold">{r.clo}</td>
                )}
                <td className="border border-black p-1">{r.plo}</td>
                <td className="border border-black p-1">{r.dt}</td>
                <td className="border border-black p-1">{r.vbe}</td>
                <td className="border border-black p-1">{r.sc}</td>
                <td className="border border-black p-1">{r.dp}</td>
                <td className="border border-black p-1">{r.dk}</td>
                <td className="border border-black p-1 font-bold text-left">{r.kaedah}</td>
                <td className="border border-black p-1">{r.instrumen}</td>
                {computed.topics.map((t) => (
                  <td key={t.code} className="border border-black p-1 font-bold">
                    {(r.checked_topics || []).includes(t.code) ? "✔" : ""}
                  </td>
                ))}
                <td className="border border-black p-1">{r.c1_items || ""}</td>
                <td className="border border-black p-1">{r.c1_marks || ""}</td>
                <td className="border border-black p-1">{r.c2_items || ""}</td>
                <td className="border border-black p-1">{r.c2_marks || ""}</td>
                <td className="border border-black p-1">{r.c3_items || ""}</td>
                <td className="border border-black p-1">{r.c3_marks || ""}</td>
                <td className="border border-black p-1">{r.a3_items || ""}</td>
                <td className="border border-black p-1">{r.a3_marks || ""}</td>
                <td className="border border-black p-1 font-bold">{fmt(rm)}</td>
                <td className="border border-black p-1 font-bold">{fmt(r.weight_pct)}</td>
                {span > 0 && (
                  <td rowSpan={span} className="border border-black p-1 font-bold">
                    {fmt(computed.cloTotals[r.clo])}
                  </td>
                )}
                <td className="border border-black p-1 font-bold">{itypes.includes("O") ? "✔" : ""}</td>
                <td className="border border-black p-1 font-bold">{itypes.includes("S") ? "✔" : ""}</td>
                <td className="border border-black p-1 font-bold">{itypes.includes("P") ? "✔" : ""}</td>
              </tr>
            );
          })}
          <tr className="bg-slate-100 font-bold">
            <td colSpan={9} className="border border-black p-1 text-right pr-2">JUMLAH MARKAH MENGIKUT TOPIK</td>
            {computed.topicMarkSums.map((s, i) => (
              <td key={i} className="border border-black p-1">{s.toFixed(1)}</td>
            ))}
            <td className="border border-black p-1">{computed.totals.c1i}</td>
            <td className="border border-black p-1">{fmt(computed.totals.c1m)}</td>
            <td className="border border-black p-1">{computed.totals.c2i}</td>
            <td className="border border-black p-1">{fmt(computed.totals.c2m)}</td>
            <td className="border border-black p-1">{computed.totals.c3i}</td>
            <td className="border border-black p-1">{fmt(computed.totals.c3m)}</td>
            <td className="border border-black p-1">{computed.totals.a3i}</td>
            <td className="border border-black p-1">{fmt(computed.totals.a3m)}</td>
            <td className="border border-black p-1">{fmt(computed.totals.marks)}</td>
            <td className="border border-black p-1">{fmt(computed.totals.weight)}</td>
            <td className="border border-black p-1">{fmt(computed.totals.marks)}</td>
            <td colSpan={3} className="border border-black p-1" />
          </tr>
        </tbody>
      </table>
      <div className="text-center font-bold tracking-widest text-[8.5pt] mt-2">TERHAD</div>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 mt-1 pt-1 text-[7pt]">
        <div>{docCode}</div>
        <div className="text-right">
          Version: {course.jsu?.curriculum_version || "-"}
          <span className="mx-2">|</span>
          Effective: {course.jsu?.effective_session || "-"}
        </div>
      </div>
    </div>
  );
}
