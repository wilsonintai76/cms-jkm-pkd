import React, { useEffect, useRef } from "react";
import {
  computeProgStats,
  defaultProgCqi,
  studentsOf,
  trendOf,
  tumpangOf,
} from "../lib/cqi";
import { cloStatements } from "../lib/cqi";
import type { CqiBundle, ProgCqi } from "../lib/cqi";

type CqiBorangSheetProps = {
  bundle: CqiBundle;
  prog: string;
  clos?: { code?: string; statement?: string }[];
  logoUri: string | null;
  includeLampiran: boolean;
  onChange: (next: CqiBundle) => void;
};

/** Editable text cell that also prints its value (inputs clip long text). */
function Editable({
  value,
  onChange,
  className = "",
  placeholder = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value ?? "";
  }, [value]);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-ph={placeholder}
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
      className={`cqi-field outline-none ${className}`}
    />
  );
}

function NumInput({
  value,
  onChange,
  step = "1",
  width = "w-12",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
  width?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={`${width} text-right font-bold bg-transparent border-b border-dotted border-slate-500 focus:outline-none focus:bg-amber-50`}
    />
  );
}

type NumRowProps = {
  code?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  indent?: boolean;
  wrap?: boolean;
};

function NumRow({ code, label, value, strong, indent, wrap }: NumRowProps) {
  return (
    <tr>
      <td className="w-4 align-top font-semibold">{code}</td>
      <td className={`align-top ${indent ? "pl-2" : ""}`}>{label}</td>
      <td className="w-2 align-top">:</td>
      <td className={`text-right align-top ${wrap ? "" : "whitespace-nowrap"} ${strong ? "font-bold" : ""}`}>
        {value}
      </td>
    </tr>
  );
}

export default function CqiBorangSheet({
  bundle,
  prog,
  clos,
  logoUri,
  includeLampiran,
  onChange,
}: CqiBorangSheetProps) {
  const meta = bundle.meta;
  const hasClo4 = meta.hasClo4;
  const cqi: ProgCqi = bundle.cqiByProg[prog] ?? defaultProgCqi(meta.currSession);
  const stats = computeProgStats(bundle.students, prog, hasClo4);
  const students = studentsOf(bundle.students, prog);
  const tumpang = tumpangOf(bundle.students, prog);
  const cloIdx = hasClo4 ? [0, 1, 2, 3] : [0, 1, 2];
  const cloText = cloStatements(clos, hasClo4);
  // Pernyataan CLO daripada Maklumat Kursus dipaparkan di bawah label baris CLO.
  const cloPrompt = (i: number, text: string) =>
    cloText[i] ? (
      <>
        {text}
        <div className="text-[7.5pt] italic font-normal leading-tight">{cloText[i]}</div>
      </>
    ) : (
      text
    );

  const patch = (p: Partial<ProgCqi>) =>
    onChange({ ...bundle, cqiByProg: { ...bundle.cqiByProg, [prog]: { ...cqi, ...p } } });

  const prevN = Number(cqi.prevTotalStudents) || 0;
  const prevPassAllPct = prevN > 0 ? ((Number(cqi.prevPassAllCount) || 0) / prevN) * 100 : 0;
  const prevCaFeBil = prevN > 0 ? Math.round(((Number(cqi.prevCaFePassPct) || 0) / 100) * prevN) : 0;

  const tAll =
    Number(cqi.prevPassAllCount) > 0
      ? trendOf(stats.passAllPct, prevPassAllPct, prevN)
      : { status: "N/A", diff: "N/A" };
  const tClo = cloIdx.map((i) => trendOf(stats.passCloPct[i], Number(cqi.prevCloPass?.[i]) || 0, prevN));
  const tCaFe = trendOf(stats.caFeCapaiPct, Number(cqi.prevCaFePassPct) || 0, prevN);

  const capai = (pct: number, enabled = true) => (!enabled || stats.n === 0 ? "N/A" : pct >= 80 ? "CAPAI" : "TIDAK CAPAI");
  const prevCapai = (pct: number, enabled = true) =>
    !enabled || prevN === 0 ? "N/A" : pct >= 80 ? "CAPAI" : "TIDAK CAPAI";

  const failedClos = cloIdx.filter((i) => stats.passCloPct[i] < 80);
  const lowestAvg = [0, 1, 2].reduce((a, b) => (stats.avgClo[b] < stats.avgClo[a] ? b : a), 0);
  const autoTumpuan = failedClos.length
    ? failedClos.map((i) => `CLO${i + 1}`).join(", ")
    : stats.n > 0
      ? `CLO ${lowestAvg + 1}`
      : "";
  const tumpuan = cqi.tumpuanOverride || autoTumpuan;

  const kelas = cqi.classesOverride || stats.classes.join("/") || `${prog}1A`;
  const seksyen = cqi.seksyenOverride || stats.sections.join("/");

  const pencapaianHeadline = failedClos.length
    ? `Pencapaian: ${failedClos.map((i) => `CLO${i + 1}`).join(", ")} tidak mencapai objektif kualiti yang ditetapkan.`
    : "Pencapaian: Semua CLO mencapai objektif kualiti yang ditetapkan.";

  const setPunca = (i: number, v: string) => {
    const next = [...(cqi.punca || ["", "", "", ""])];
    next[i] = v;
    patch({ punca: next });
  };
  const setCadangan = (i: number, v: string) => {
    const next = [...(cqi.cadangan || ["", "", "", ""])];
    next[i] = v;
    patch({ cadangan: next });
  };

  return (
    <div id="printable-cqi-doc" className="cqi-sheet print-sheet mx-auto text-black font-[Arial] text-[9pt]">
      {/* ==================== MUKA SURAT 1 ==================== */}
      <div className="cqi-page">
        <div className="flex items-center gap-3 pb-2 border-b-2 border-black mb-2">
          {logoUri ? (
            <img src={logoUri} alt="Logo" className="h-12 w-auto object-contain" />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-full border-2 border-slate-800 flex items-center justify-center text-[7pt] font-bold text-center leading-tight">
              PKS
            </div>
          )}
          <div className="flex-1 text-center">
            <div className="text-[11pt] font-bold uppercase leading-snug">
              {meta.jabatan || "JABATAN KEJURUTERAAN MEKANIKAL"}
            </div>
            <div className="text-[11pt] font-bold uppercase leading-snug">
              PELAPORAN PENAMBAHBAIKAN KUALITI BERTERUSAN (CQI)
            </div>
            <div className="text-[11pt] font-bold uppercase leading-snug">
              TERHADAP CLO BAGI SESI {meta.currSession || "-"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 text-[9.5pt] mb-2">
          <div className="col-span-7 space-y-0.5">
            <div className="flex gap-2">
              <span className="w-40 font-semibold">Kod Kursus</span>
              <span>:</span>
              <span className="font-bold">{meta.code || "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-40 font-semibold">Nama Kursus</span>
              <span>:</span>
              <span className="font-bold uppercase">{meta.name || "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-40 font-semibold">Nama Penyelaras Kursus</span>
              <span>:</span>
              <span className="font-bold uppercase">{meta.coordinator || "-"}</span>
            </div>
          </div>
          <div className="col-span-5 space-y-0.5">
            <div className="flex gap-2">
              <span className="w-20 font-semibold">Program</span>
              <span>:</span>
              <span className="font-bold">{prog}</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="w-20 font-semibold">Seksyen /</span>
              <span>:</span>
              <Editable
                value={seksyen}
                onChange={(v) => patch({ seksyenOverride: v })}
                placeholder="S1 / S2"
                className="flex-1 font-semibold"
              />
            </div>
            <div className="flex gap-2 items-start">
              <span className="w-20 font-semibold shrink-0">Kelas</span>
              <span>:</span>
              <Editable
                value={kelas}
                onChange={(v) => patch({ classesOverride: v })}
                placeholder={stats.classes.join("/")}
                className="flex-1 font-bold"
              />
            </div>
          </div>
        </div>

        <div className="text-[9.5pt] font-bold mb-1">
          A. Laporan Analisis Pencapaian CORR bagi &nbsp;<span className="underline">Sesi {meta.prevSession || "-"}</span>
          &nbsp; dan &nbsp;<span className="underline">Sesi {meta.currSession || "-"}</span>
        </div>

        <table className="cqi-table mb-2">
          <thead>
            <tr>
              <th colSpan={4}>Pencapaian CORR</th>
              <th rowSpan={2} className="w-[30%] align-middle">Analisis Perbandingan</th>
            </tr>
            <tr>
              <th colSpan={2} className="text-left">SESI: Sesi {meta.prevSession || "-"}</th>
              <th colSpan={2} className="text-left">SESI: Sesi {meta.currSession || "-"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={2} className="align-top w-[35%]">
                <div className="font-bold underline mb-0.5">Pencapaian:</div>
                <table className="w-full cqi-nb">
                  <colgroup>
                    <col style={{ width: "14px" }} />
                    <col />
                    <col style={{ width: "7px" }} />
                    <col style={{ width: "64px" }} />
                  </colgroup>
                  <tbody>
                    <NumRow
                      code="a)"
                      label="Bil. Pelajar"
                      value={
                        <NumInput value={cqi.prevTotalStudents} onChange={(v) => patch({ prevTotalStudents: v })} />
                      }
                      strong
                    />
                    <NumRow
                      code="b)"
                      label="Bil. pelajar lulus semua CLO"
                      value={<NumInput value={cqi.prevPassAllCount} onChange={(v) => patch({ prevPassAllCount: v })} />}
                      strong
                    />
                    <NumRow code="c)" label="% lulus semua CLO" value={`${prevPassAllPct.toFixed(1)}%`} strong />
                    <tr>
                      <td colSpan={4} className="h-1" />
                    </tr>
                    <NumRow
                      code="d)"
                      label={cloPrompt(0, "% pelajar lulus CLO1 >50%")}
                      value={
                        <span>
                          <NumInput
                            step="0.1"
                            value={cqi.prevCloPass?.[0] ?? 0}
                            onChange={(v) => {
                              const arr = [...(cqi.prevCloPass || [0, 0, 0, 0])];
                              arr[0] = v;
                              patch({ prevCloPass: arr });
                            }}
                          />
                          %
                        </span>
                      }
                    />
                    <NumRow
                      label="% purata CLO1"
                      indent
                      value={
                        <span>
                          <NumInput
                            step="0.1"
                            value={cqi.prevCloAvg?.[0] ?? 0}
                            onChange={(v) => {
                              const arr = [...(cqi.prevCloAvg || [0, 0, 0, 0])];
                              arr[0] = v;
                              patch({ prevCloAvg: arr });
                            }}
                          />
                          %
                        </span>
                      }
                    />
                    <NumRow
                      code="e)"
                      label={cloPrompt(1, "% pelajar lulus CLO2 >50%")}
                      value={
                        <span>
                          <NumInput
                            step="0.1"
                            value={cqi.prevCloPass?.[1] ?? 0}
                            onChange={(v) => {
                              const arr = [...(cqi.prevCloPass || [0, 0, 0, 0])];
                              arr[1] = v;
                              patch({ prevCloPass: arr });
                            }}
                          />
                          %
                        </span>
                      }
                    />
                    <NumRow
                      label="% purata CLO2"
                      indent
                      value={
                        <span>
                          <NumInput
                            step="0.1"
                            value={cqi.prevCloAvg?.[1] ?? 0}
                            onChange={(v) => {
                              const arr = [...(cqi.prevCloAvg || [0, 0, 0, 0])];
                              arr[1] = v;
                              patch({ prevCloAvg: arr });
                            }}
                          />
                          %
                        </span>
                      }
                    />
                    <NumRow
                      code="f)"
                      label={cloPrompt(2, "% pelajar lulus CLO3 >50%")}
                      value={
                        <span>
                          <NumInput
                            step="0.1"
                            value={cqi.prevCloPass?.[2] ?? 0}
                            onChange={(v) => {
                              const arr = [...(cqi.prevCloPass || [0, 0, 0, 0])];
                              arr[2] = v;
                              patch({ prevCloPass: arr });
                            }}
                          />
                          %
                        </span>
                      }
                    />
                    <NumRow
                      label="% purata CLO3"
                      indent
                      value={
                        <span>
                          <NumInput
                            step="0.1"
                            value={cqi.prevCloAvg?.[2] ?? 0}
                            onChange={(v) => {
                              const arr = [...(cqi.prevCloAvg || [0, 0, 0, 0])];
                              arr[2] = v;
                              patch({ prevCloAvg: arr });
                            }}
                          />
                          %
                        </span>
                      }
                    />
                    <NumRow
                      code="g)"
                      label={cloPrompt(3, "% pelajar lulus CLO4 >50%")}
                      value={
                        hasClo4 ? (
                          <span>
                            <NumInput
                              step="0.1"
                              value={cqi.prevCloPass?.[3] ?? 0}
                              onChange={(v) => {
                                const arr = [...(cqi.prevCloPass || [0, 0, 0, 0])];
                                arr[3] = v;
                                patch({ prevCloPass: arr });
                              }}
                            />
                            %
                          </span>
                        ) : (
                          "N/A"
                        )
                      }
                    />
                    <NumRow label="% purata CLO4" indent value={hasClo4 ? `${cqi.prevCloAvg?.[3] ?? 0}%` : "N/A"} />
                    <tr>
                      <td colSpan={4} className="h-1" />
                    </tr>
                    <tr>
                      <td className="align-top font-semibold">h)</td>
                      <td colSpan={3} className="font-semibold">
                        CLO pelajar lulus &lt;80%
                      </td>
                    </tr>
                    {cloIdx.map((i) => (
                      <NumRow
                        key={i}
                        label={`CLO${i + 1}`}
                        indent
                        wrap
                        value={prevCapai(Number(cqi.prevCloPass?.[i]) || 0)}
                      />
                    ))}
                    <tr>
                      <td colSpan={4} className="h-1" />
                    </tr>
                    <NumRow
                      code="i)"
                      label="% pelajar CA-FE <30%"
                      value={
                        <span>
                          <NumInput
                            step="0.1"
                            value={cqi.prevCaFePassPct}
                            onChange={(v) => patch({ prevCaFePassPct: v })}
                          />
                          %
                        </span>
                      }
                    />
                    <NumRow label="Bil. pelajar capai" indent value={prevCaFeBil} />
                    <NumRow
                      label="Sasaran Petunjuk Prestasi"
                      indent
                      value={<NumInput value={cqi.kpiCaFeTarget} onChange={(v) => patch({ kpiCaFeTarget: v })} />}
                    />
                  </tbody>
                </table>
              </td>

              <td colSpan={2} className="align-top bg-slate-50/60">
                <div className="font-bold underline mb-0.5">Pencapaian:</div>
                <table className="w-full cqi-nb">
                  <colgroup>
                    <col style={{ width: "14px" }} />
                    <col />
                    <col style={{ width: "7px" }} />
                    <col style={{ width: "64px" }} />
                  </colgroup>
                  <tbody>
                    <NumRow code="a)" label="Bil. Pelajar" value={stats.n} strong />
                    <NumRow code="b)" label="Bil. pelajar lulus semua CLO" value={stats.passAll} strong />
                    <NumRow code="c)" label="% lulus semua CLO" value={`${stats.passAllPct.toFixed(1)}%`} strong />
                    <tr>
                      <td colSpan={4} className="h-1" />
                    </tr>
                    <NumRow code="d)" label={cloPrompt(0, "% pelajar lulus CLO1 >50%")} value={`${stats.passCloPct[0].toFixed(1)}%`} strong />
                    <NumRow label="% purata CLO1" indent value={`${stats.avgClo[0].toFixed(1)}%`} />
                    <NumRow code="e)" label={cloPrompt(1, "% pelajar lulus CLO2 >50%")} value={`${stats.passCloPct[1].toFixed(1)}%`} strong />
                    <NumRow label="% purata CLO2" indent value={`${stats.avgClo[1].toFixed(1)}%`} />
                    <NumRow code="f)" label={cloPrompt(2, "% pelajar lulus CLO3 >50%")} value={`${stats.passCloPct[2].toFixed(1)}%`} strong />
                    <NumRow label="% purata CLO3" indent value={`${stats.avgClo[2].toFixed(1)}%`} />
                    <NumRow
                      code="g)"
                      label={cloPrompt(3, "% pelajar lulus CLO4 >50%")}
                      value={hasClo4 ? `${stats.passCloPct[3].toFixed(1)}%` : "N/A"}
                      strong
                    />
                    <NumRow label="% purata CLO4" indent value={hasClo4 ? `${stats.avgClo[3].toFixed(1)}%` : "N/A"} />
                    <tr>
                      <td colSpan={4} className="h-1" />
                    </tr>
                    <tr>
                      <td className="align-top font-semibold">h)</td>
                      <td colSpan={3} className="font-semibold">
                        CLO pelajar lulus &lt;80%
                      </td>
                    </tr>
                    {cloIdx.map((i) => (
                      <NumRow key={i} label={`CLO${i + 1}`} indent wrap value={capai(stats.passCloPct[i])} strong />
                    ))}
                    <tr>
                      <td colSpan={4} className="h-1" />
                    </tr>
                    <NumRow code="i)" label="% pelajar CA-FE <30%" value={`${stats.caFeCapaiPct.toFixed(1)}%`} strong />
                    <NumRow label="Bil. pelajar capai" indent value={stats.caFeCapaiCount} strong />
                    <NumRow label="Sasaran Petunjuk Prestasi" indent value={cqi.kpiCaFeTarget} />
                  </tbody>
                </table>
              </td>

              <td className="align-top">
                <div className="font-bold underline mb-0.5">Analisa:</div>
                <table className="w-full cqi-nb mb-1.5">
                  <colgroup>
                    <col style={{ width: "14px" }} />
                    <col />
                    <col style={{ width: "7px" }} />
                    <col style={{ width: "62px" }} />
                    <col style={{ width: "44px" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="w-4">a)</td>
                      <td>Semua CLO</td>
                      <td className="w-2">:</td>
                      <td className="font-bold">{tAll.status}</td>
                      <td className="text-right font-semibold">{tAll.diff}</td>
                    </tr>
                    {cloIdx.map((i) => (
                      <tr key={i}>
                        <td>{String.fromCharCode(97 + i + 1)})</td>
                        <td>CLO{i + 1}</td>
                        <td>:</td>
                        <td className="font-bold">{tClo[i].status}</td>
                        <td className="text-right font-semibold">{tClo[i].diff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="font-bold underline border-t border-black pt-1">Punca:</div>
                {cloIdx.map((i) => (
                  <div key={i} className="mt-0.5">
                    <div className="flex justify-between font-bold text-[8.5pt]">
                      <span>
                        {String.fromCharCode(97 + i)}) CLO{i + 1} = {capai(stats.passCloPct[i])}
                      </span>
                      <span>{stats.passCloPct[i].toFixed(1)}%</span>
                    </div>
                    <Editable
                      value={cqi.punca?.[i] ?? ""}
                      onChange={(v) => setPunca(i, v)}
                      placeholder="-"
                      className="text-[8.5pt] leading-snug"
                    />
                  </div>
                ))}
                {!hasClo4 && (
                  <div className="flex justify-between font-bold text-[8.5pt] mt-0.5">
                    <span>d) CLO4 = N/A</span>
                    <span>N/A</span>
                  </div>
                )}

                <div className="pt-1 mt-1 border-t border-slate-400">
                  <div className="flex justify-between font-bold text-[8.5pt]">
                    <span>
                      e) CA-FE = {tCaFe.status}
                    </span>
                    <span>{tCaFe.diff}</span>
                  </div>
                  <div className="text-[7.5pt] italic leading-tight">
                    (nyatakan punca sekiranya tidak tercapai sasaran petunjuk prestasi) *semester semasa sahaja.
                  </div>
                  <Editable
                    value={cqi.ulasanTumpuanCaFe}
                    onChange={(v) => patch({ ulasanTumpuanCaFe: v })}
                    placeholder="Huraian punca CA-FE..."
                    className="text-[8.5pt] leading-snug mt-0.5"
                  />
                </div>

                <div className="pt-1 mt-1 border-t border-black flex items-center gap-2">
                  <span className="font-bold">Tumpuan CQI :</span>
                  <input
                    value={cqi.tumpuanOverride}
                    placeholder={autoTumpuan}
                    onChange={(e) => patch({ tumpuanOverride: e.target.value })}
                    className="w-24 text-center font-extrabold border border-slate-400 rounded px-1 bg-transparent focus:outline-none"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-[9.5pt] font-bold mb-1">
          B. Laporan Pelaksanaan CQI Semester Semasa bagi Sesi : {meta.prevSession || "-"}
        </div>
        <table className="cqi-table">
          <thead>
            <tr>
              <th className="w-8">Bil.</th>
              <th className="text-left w-[42%]">
                Tindakan / Aktiviti
                <div className="font-normal italic text-[8pt]">(berdasarkan pada sesi {cqi.bBaseSession || meta.prevSession || "-"})</div>
              </th>
              <th className="w-[32%]">Impak</th>
              <th className="w-[20%]">Dokumen / Bukti Pelaksanaan</th>
            </tr>
          </thead>
          <tbody>
            {cqi.bRows.map((row, idx) => (
              <tr key={idx}>
                <td className="text-center font-semibold">{idx + 1}</td>
                <td>
                  <Editable
                    value={row.aktiviti}
                    onChange={(v) => {
                      const rows = [...cqi.bRows];
                      rows[idx] = { ...rows[idx], aktiviti: v };
                      patch({ bRows: rows });
                    }}
                    placeholder="Tindakan / aktiviti CQI"
                  />
                </td>
                <td className="text-center">
                  <Editable
                    value={row.impak}
                    onChange={(v) => {
                      const rows = [...cqi.bRows];
                      rows[idx] = { ...rows[idx], impak: v };
                      patch({ bRows: rows });
                    }}
                    className="text-center"
                    placeholder="Impak"
                  />
                </td>
                <td className="text-center">
                  <Editable
                    value={row.bukti}
                    onChange={(v) => {
                      const rows = [...cqi.bRows];
                      rows[idx] = { ...rows[idx], bukti: v };
                      patch({ bRows: rows });
                    }}
                    className="text-center"
                    placeholder="Bukti"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ==================== MUKA SURAT 2 ==================== */}
      <div className="cqi-page">
        <div className="text-[9.5pt] font-bold mb-1">
          C. Cadangan CQI bagi Sesi Hadapan Sesi : {meta.nextSession || "-"}
        </div>
        <table className="cqi-table">
          <thead>
            <tr>
              <th className="w-8">Bil.</th>
              <th className="text-left w-[48%]">
                Punca (capai/ tidak capai 80% Pelajar Lulus CLO 50%) pada sesi {meta.currSession || "-"}
              </th>
              <th className="text-left w-[45%]">Cadangan CQI untuk Sesi {meta.nextSession || "-"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-center font-semibold align-middle">1</td>
              <td>
                <div className="font-semibold">{pencapaianHeadline}</div>
                <div>Punca: -</div>
                {cloIdx.map((i) => (
                  <div key={i} className="pl-1">
                    {String.fromCharCode(97 + i)}) {cqi.punca?.[i] || "-"}
                  </div>
                ))}
                {!hasClo4 && <div className="pl-1">d) -</div>}
              </td>
              <td>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-1 items-start">
                    <span className="shrink-0">{String.fromCharCode(97 + i)})</span>
                    <Editable
                      value={cqi.cadangan?.[i] ?? ""}
                      onChange={(v) => setCadangan(i, v)}
                      placeholder={i > 2 && !hasClo4 ? "-" : "Cadangan CQI"}
                      className="flex-1 text-[8.5pt] leading-snug"
                    />
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-[7.5pt] italic mt-1 mb-3">
          * Catatan: Punca mengambil kira faktor kandungan kurikulum, kaedah PdP, alat bantuan mengajar/ fasiliti, kompetensi
          pensyarah, latar belakang demografik pelajar &amp; kandungan silibus
        </p>

        <div className="text-[9.5pt] font-bold mb-1">
          D. Maklumbalas Kurikulum bagi Sesi : {meta.currSession || "-"}
        </div>
        <table className="cqi-table">
          <thead>
            <tr>
              <th className="w-8">Bil.</th>
              <th className="w-[38%]">Perkara</th>
              <th>Maklumbalas/ Cadangan</th>
            </tr>
          </thead>
          <tbody>
            {cqi.dRows.map((row, idx) => (
              <tr key={idx}>
                <td className="text-center font-semibold">{idx + 1}</td>
                <td>
                  <Editable
                    value={row.perkara}
                    onChange={(v) => {
                      const rows = [...cqi.dRows];
                      rows[idx] = { ...rows[idx], perkara: v };
                      patch({ dRows: rows });
                    }}
                    placeholder="cth: SILIBUS"
                  />
                </td>
                <td>
                  <Editable
                    value={row.maklumbalas}
                    onChange={(v) => {
                      const rows = [...cqi.dRows];
                      rows[idx] = { ...rows[idx], maklumbalas: v };
                      patch({ dRows: rows });
                    }}
                    placeholder="TIADA MAKLUMBALAS"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[7.5pt] italic mt-1 mb-4">
          *Catatan: Maklumbalas termasuklah CLO, Mapping CLO, PLO, Teaching Method &amp; Assessment Method, Distribution of SLT,
          References, Course Syllabus dan AST.
        </p>

        <div className="text-[9.5pt] font-bold mb-1">E. Pengesahan</div>
        <table className="cqi-table">
          <tbody>
            <tr>
              <td className="w-[30%] h-36 align-top">
                <div className="font-semibold mb-10">Disediakan oleh:</div>
                <div className="text-center">
                  <div>..................................................</div>
                  <div className="font-bold uppercase">({meta.coordinator || "NAMA PENYELARAS"})</div>
                </div>
              </td>
              <td className="w-[30%] h-36 align-top">
                <div className="font-semibold mb-10">Disahkan oleh KK/ KP/ KJ:</div>
                <div className="text-center">
                  <div>..................................................</div>
                  <div className="mt-0.5">
                    (
                    <input
                      value={cqi.verifierName}
                      onChange={(e) => patch({ verifierName: e.target.value })}
                      placeholder="Nama KK / KP / KJ"
                      className="w-36 text-center font-bold uppercase bg-transparent border-b border-dotted border-slate-500 focus:outline-none"
                    />
                    )
                  </div>
                </div>
              </td>
              <td className="w-[40%] h-36 align-top">
                <div className="font-semibold mb-1">Ulasan KK/ KP/ KJ:</div>
                <Editable
                  value={cqi.verifierRemarks}
                  onChange={(v) => patch({ verifierRemarks: v })}
                  placeholder="Masukkan ulasan (jika ada)..."
                  className="min-h-16 leading-snug"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ==================== MUKA SURAT 3 (LAMPIRAN) ==================== */}
      {includeLampiran && (
        <div className="cqi-page">
          <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2">
            <div>
              <div className="text-[10.5pt] font-bold uppercase">
                LAMPIRAN: ANALISIS PENCAPAIAN CORR PELAJAR MENGIKUT PROGRAM ({prog})
              </div>
              <div className="text-[9.5pt]">
                Kursus: <span className="font-bold">{meta.code} - {meta.name}</span> | Sesi:{" "}
                <span className="font-bold">{meta.currSession || "-"}</span>
              </div>
            </div>
            <span className="text-[8pt] font-bold border border-black px-2 py-0.5">Ekstrak PBCLOGSA</span>
          </div>
          <table className="cqi-table cqi-fixed">
            <colgroup>
              <col style={{ width: "24px" }} />
              <col style={{ width: "96px" }} />
              <col />
              <col style={{ width: "50px" }} />
              <col style={{ width: "88px" }} />
              <col style={{ width: "36px" }} />
              <col style={{ width: "36px" }} />
              <col style={{ width: "36px" }} />
              {hasClo4 && <col style={{ width: "36px" }} />}
              <col style={{ width: "52px" }} />
              <col style={{ width: "24px" }} />
              <col style={{ width: "24px" }} />
              <col style={{ width: "34px" }} />
              <col style={{ width: "36px" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="w-7">Bil</th>
                <th className="text-left">No. Pendaftaran</th>
                <th className="text-left">Nama Pelajar</th>
                <th>Kelas</th>
                <th className="text-left">Pensyarah</th>
                <th>CLO1</th>
                <th>CLO2</th>
                <th>CLO3</th>
                {hasClo4 && <th>CLO4</th>}
                <th>Status CLO</th>
                <th>CA</th>
                <th>FE</th>
                <th>CA-FE</th>
                <th>Gred</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => {
                const pass = s.clo1 >= 50 && s.clo2 >= 50 && s.clo3 >= 50 && (!hasClo4 || (Number(s.clo4) || 0) >= 50);
                return (
                  <tr key={s.metric}>
                    <td className="text-center">{idx + 1}</td>
                    <td className="font-mono">{s.metric}</td>
                    <td>{s.name}</td>
                    <td className="text-center">{s.className}</td>
                    <td>{s.lecturer}</td>
                    <td className="text-center">{s.clo1.toFixed(1)}</td>
                    <td className="text-center">{s.clo2.toFixed(1)}</td>
                    <td className="text-center">{s.clo3.toFixed(1)}</td>
                    {hasClo4 && <td className="text-center">{(Number(s.clo4) || 0).toFixed(1)}</td>}
                    <td className="text-center font-semibold">{pass ? "LULUS" : "TIDAK LULUS"}</td>
                    <td className="text-center">{s.ca}</td>
                    <td className="text-center">{s.fe}</td>
                    <td className="text-center">{s.caFeDiff}</td>
                    <td className="text-center font-bold">{s.grade || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[8pt] italic mt-1.5">
            {tumpang.length > 0
              ? `* Nota: ${tumpang.length} pelajar tumpang kelas daripada program lain (${Array.from(
                  new Set(tumpang.map((x) => x.prog)),
                ).join(", ")}) telah diasingkan ke laporan CQI program masing-masing.`
              : `* Nota: Semua ${students.length} pelajar program ${prog} dikira dalam laporan CQI ini.`}
          </p>
        </div>
      )}
    </div>
  );
}
