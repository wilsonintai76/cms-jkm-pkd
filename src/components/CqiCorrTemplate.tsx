import React from "react";
import { AlertTriangle } from "lucide-react";
import { computeProgStats, GRADE_ORDER, passAllClo, studentsOf, tumpangOf } from "../lib/cqi";
import type { CqiBundle } from "../lib/cqi";

type CqiCorrTemplateProps = {
  bundle: CqiBundle;
  prog: string;
};

export default function CqiCorrTemplate({ bundle, prog }: CqiCorrTemplateProps) {
  const hasClo4 = bundle.meta.hasClo4;
  const students = studentsOf(bundle.students, prog);
  const stats = computeProgStats(bundle.students, prog, hasClo4);
  const tumpang = tumpangOf(bundle.students, prog);
  const corr = bundle.corr;
  const cloIdx = hasClo4 ? [0, 1, 2, 3] : [0, 1, 2];

  if (!students.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Tiada pelajar untuk program {prog}. Muat naik fail PBCLOGSA yang mengandungi program ini.
      </div>
    );
  }

  const indicatorRows: [string, string, string][] = [
    ["a)", "BIL. PELAJAR KESELURUHAN", String(stats.n)],
    ["b)", "BIL. PELAJAR LULUS SEMUA CLO", String(stats.passAll)],
    ["c)", "PERATUS LULUS SEMUA CLO (%)", `${stats.passAllPct.toFixed(1)}%`],
    ["d)", "% pelajar lulus CLO1 >50%", `${stats.passCloPct[0].toFixed(1)}%`],
    ["", "% purata CLO1", `${stats.avgClo[0].toFixed(1)}%`],
    ["e)", "% pelajar lulus CLO2 >50%", `${stats.passCloPct[1].toFixed(1)}%`],
    ["", "% purata CLO2", `${stats.avgClo[1].toFixed(1)}%`],
    ["f)", "% pelajar lulus CLO3 >50%", `${stats.passCloPct[2].toFixed(1)}%`],
    ["", "% purata CLO3", `${stats.avgClo[2].toFixed(1)}%`],
  ];
  if (hasClo4) {
    indicatorRows.push(["g)", "% pelajar lulus CLO4 >50%", `${stats.passCloPct[3].toFixed(1)}%`]);
    indicatorRows.push(["", "% purata CLO4", `${stats.avgClo[3].toFixed(1)}%`]);
  }
  indicatorRows.push([
    "i)",
    "% pelajar CA-FE <30%",
    `${stats.caFeCapaiPct.toFixed(1)}% (${stats.caFeCapaiCount}/${stats.n})`,
  ]);

  const kpiItems = [
    { label: "CLO1 (% Lulus >50%)", pct: stats.passCloPct[0], target: 80 },
    { label: "CLO2 (% Lulus >50%)", pct: stats.passCloPct[1], target: 80 },
    { label: "CLO3 (% Lulus >50%)", pct: stats.passCloPct[2], target: 80 },
    { label: "CA-FE <30%", pct: stats.caFeCapaiPct, target: 25 },
  ];

  return (
    <div className="space-y-4">
      {tumpang.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Pengasingan <strong>tumpang kelas</strong> aktif: {tumpang.length} pelajar program lain (
            {Array.from(new Set(tumpang.map((s) => s.prog))).join(", ")}) dalam kelas yang sama{" "}
            <strong>TIDAK DIKIRA</strong> dalam CQI <strong>{prog}</strong>.
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-slate-900">
              Template Laporan Analisis Pencapaian CORR — Program {prog}
            </div>
            <div className="text-[11px] text-slate-500">
              Sesi: {bundle.meta.currSession || "-"} • {stats.lecturers.join(" / ") || "-"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            {stats.sections.map((sec) => (
              <span key={sec} className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
                Seksyen {sec}
              </span>
            ))}
            {stats.classes.map((c) => (
              <span key={c} className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 font-semibold text-sky-700">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="px-2 py-2 text-left font-bold whitespace-nowrap">Pensyarah (Seksyen)</th>
                <th className="px-2 py-2 font-bold">#</th>
                <th className="px-2 py-2 text-left font-bold">No. Pendaftaran</th>
                <th className="px-2 py-2 text-left font-bold">Nama Pelajar</th>
                <th className="px-2 py-2 font-bold">Kelas</th>
                {cloIdx.map((i) => (
                  <th key={i} className="px-2 py-2 font-bold">
                    CLO{i + 1}
                  </th>
                ))}
                <th className="px-2 py-2 font-bold">Status CLO</th>
                <th className="px-2 py-2 font-bold">CA</th>
                <th className="px-2 py-2 font-bold">FE</th>
                <th className="px-2 py-2 font-bold">CA-FE</th>
                <th className="px-2 py-2 font-bold">Gred</th>
                <th className="px-2 py-2 font-bold">CA-FE &lt;30%</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => {
                const pass = passAllClo(s, hasClo4);
                const diff = (Number(s.ca) || 0) - (Number(s.fe) || 0);
                const caFeOk = Math.abs(diff) < 30;
                const cloVals = [s.clo1, s.clo2, s.clo3, Number(s.clo4) || 0];
                return (
                  <tr key={s.metric} className="border-t border-slate-100 hover:bg-sky-50/40">
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{s.lecturer || "-"}</div>
                      <div className="text-[9.5px] text-slate-400">Seksyen {s.section || "-"}</div>
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-500">{idx + 1}</td>
                    <td className="px-2 py-1.5 font-mono font-semibold text-slate-800">{s.metric}</td>
                    <td className="px-2 py-1.5 font-semibold text-slate-900">{s.name}</td>
                    <td className="px-2 py-1.5 text-center">{s.className}</td>
                    {cloIdx.map((i) => (
                      <td
                        key={i}
                        className={`px-2 py-1.5 text-center font-bold ${
                          cloVals[i] < 50 ? "bg-rose-50 text-rose-700" : "text-slate-800"
                        }`}
                      >
                        {cloVals[i].toFixed(1)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          pass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {pass ? "LULUS" : "TIDAK LULUS"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">{s.ca}</td>
                    <td className="px-2 py-1.5 text-center">{s.fe}</td>
                    <td className="px-2 py-1.5 text-center font-semibold">{diff}</td>
                    <td className="px-2 py-1.5 text-center font-bold">{s.grade || "-"}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          caFeOk
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {caFeOk ? "CAPAI" : "TIDAK CAPAI"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="text-[11px]">
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                <td colSpan={5} className="px-2 py-1.5 text-right uppercase text-slate-600">
                  Jumlah
                </td>
                {cloIdx.map((i) => (
                  <td key={i} className="px-2 py-1.5 text-center">
                    {stats.sumClo[i].toFixed(1)}
                  </td>
                ))}
                <td colSpan={5} />
              </tr>
              <tr className="bg-sky-50/60 font-semibold text-sky-900">
                <td colSpan={5} className="px-2 py-1.5 text-right uppercase">
                  Purata peratus CLO (group attainment %)
                </td>
                {cloIdx.map((i) => (
                  <td key={i} className="px-2 py-1.5 text-center font-extrabold">
                    {stats.avgClo[i].toFixed(1)}%
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center" />
                <td className="px-2 py-1.5 text-center">{stats.avgCa.toFixed(1)}</td>
                <td className="px-2 py-1.5 text-center">{stats.avgFe.toFixed(1)}</td>
                <td className="px-2 py-1.5 text-center">{stats.avgCaFe.toFixed(1)}</td>
                <td colSpan={2} />
              </tr>
              <tr className="font-semibold text-rose-700">
                <td colSpan={5} className="px-2 py-1.5 text-right uppercase">
                  Bil. pelajar gagal CLO &lt; 50% / tidak lulus
                </td>
                {cloIdx.map((i) => (
                  <td key={i} className="px-2 py-1.5 text-center">
                    {stats.failClo[i]}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  {stats.failAll} ({((stats.failAll / stats.n) * 100).toFixed(1)}%)
                </td>
                <td colSpan={3} />
                <td className="px-2 py-1.5 text-center text-amber-800">
                  {stats.n - stats.caFeCapaiCount} (&ge;30%)
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="text-sm font-bold mb-2">Petunjuk Prestasi — Program {prog}</div>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-8 px-2 py-1.5" />
                <th className="px-2 py-1.5 text-left">Petunjuk</th>
                <th className="w-28 px-2 py-1.5">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {indicatorRows.map(([code, label, value], i) => (
                <tr key={i} className={code ? "border-t border-slate-100 font-semibold" : "bg-slate-50/60 text-slate-600"}>
                  <td className="px-2 py-1.5 text-center text-slate-500">{code}</td>
                  <td className="px-2 py-1.5">{label}</td>
                  <td className="px-2 py-1.5 text-center font-bold text-slate-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="text-sm font-bold">Sasaran Kualiti (KPI)</div>
          {kpiItems.map((item) => {
            const met = item.pct >= item.target;
            return (
              <div key={item.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <span className={`font-extrabold ${met ? "text-emerald-700" : "text-rose-600"}`}>
                    {item.pct.toFixed(1)}% ({met ? "CAPAI" : "TIDAK CAPAI"})
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${met ? "bg-emerald-600" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(100, item.pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {corr && (
        <div className="bg-white rounded-2xl border border-violet-200 p-4 shadow-xs space-y-3">
          <div className="text-sm font-bold text-violet-900">
            Semakan Silang CORR Panitia ({corr.source || "corropanitia.pdf"})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
            <div>
              <div className="font-semibold text-slate-700 mb-1">Pencapaian CLO</div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="px-2 py-1 text-left">CLO</th>
                    <th className="px-2 py-1">CORR</th>
                    <th className="px-2 py-1">PBCLOGSA</th>
                    <th className="px-2 py-1">Beza</th>
                  </tr>
                </thead>
                <tbody>
                  {corr.clos.map((c) => {
                    const idx = Number(c.code.slice(-2, -1)) - 1;
                    const mine = stats.avgClo[idx] ?? 0;
                    const gap = mine - c.attainment;
                    return (
                      <tr key={c.code} className="border-t border-slate-100">
                        <td className="px-2 py-1 font-semibold">{c.code}</td>
                        <td className="px-2 py-1 text-center">{c.attainment.toFixed(1)}%</td>
                        <td className="px-2 py-1 text-center">{mine.toFixed(1)}%</td>
                        <td
                          className={`px-2 py-1 text-center font-bold ${
                            Math.abs(gap) < 0.6 ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {gap >= 0 ? "+" : ""}
                          {gap.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <div className="font-semibold text-slate-700 mb-1">Gred (CORR vs dikira)</div>
              <div className="flex flex-wrap gap-1.5">
                {GRADE_ORDER.filter((g) => g in corr.gradeDistribution).map((g) => {
                  const corrPct = corr.gradeDistribution[g] || 0;
                  const minePct = stats.n ? ((stats.gradeCounts[g] || 0) / stats.n) * 100 : 0;
                  return (
                    <span
                      key={g}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 font-semibold text-slate-700"
                    >
                      {g}: {corrPct.toFixed(0)}% <span className="text-slate-400">/</span>{" "}
                      {minePct.toFixed(0)}%
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
