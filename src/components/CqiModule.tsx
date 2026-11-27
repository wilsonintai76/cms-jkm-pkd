import React, { useState } from "react";
import { Printer, Save, Sparkles, Wand2 } from "lucide-react";
import CqiImportPanel from "./CqiImportPanel";
import CqiCorrTemplate from "./CqiCorrTemplate";
import CqiBorangSheet from "./CqiBorangSheet";
import { cloLabels, computeProgStats, defaultProgCqi, studentsOf } from "../lib/cqi";
import type { CqiBundle } from "../lib/cqi";

type CqiModuleProps = {
  bundle: CqiBundle;
  subView: string;
  activeProgramme: string;
  apiOnline: boolean;
  busy: boolean;
  logoUri: string | null;
  savedList: { course_code: string; session?: string; updated_at?: string }[];
  courseLoaded: boolean;
  onSubViewChange: (v: string) => void;
  onProgrammeChange: (p: string) => void;
  onChange: (next: CqiBundle) => void;
  onUpload: (files: File[]) => void;
  onSave: () => void;
  onPrint: () => void;
  onNotify: (msg: string, type?: string) => void;
  onOpenSaved: (code: string) => void;
  onDeleteSaved: (code: string) => void;
};

const TABS = [
  { id: "import", label: "1. Muat Naik & Ekstrak PDF" },
  { id: "corr", label: "2. Template CORR (Ikut Program)" },
  { id: "borang", label: "3. Borang Laporan CQI" },
];

export default function CqiModule({
  bundle,
  subView,
  activeProgramme,
  apiOnline,
  busy,
  logoUri,
  savedList,
  courseLoaded,
  onSubViewChange,
  onProgrammeChange,
  onChange,
  onUpload,
  onSave,
  onPrint,
  onNotify,
  onOpenSaved,
  onDeleteSaved,
}: CqiModuleProps) {
  const [includeLampiran, setIncludeLampiran] = useState(false);
  const hasData = bundle.students.length > 0 || Boolean(bundle.corr);
  const prog = activeProgramme || bundle.programmes[0] || "";
  const stats = computeProgStats(bundle.students, prog, bundle.meta.hasClo4);

  const ensureProgCqi = () => {
    if (bundle.cqiByProg[prog]) return bundle.cqiByProg[prog];
    const created = defaultProgCqi(bundle.meta.currSession);
    onChange({ ...bundle, cqiByProg: { ...bundle.cqiByProg, [prog]: created } });
    return created;
  };

  const fillFromCorr = () => {
    const corr = bundle.corr;
    if (!corr) {
      onNotify("Tiada CORR panitia dimuat naik.", "warning");
      return;
    }
    const current = ensureProgCqi();
    const prevCloPass = [0, 0, 0, 0];
    const prevCloAvg = [0, 0, 0, 0];
    corr.clos.forEach((c) => {
      const idx = Number(c.code.slice(-2, -1)) - 1;
      if (idx >= 0 && idx < 4) {
        prevCloPass[idx] = c.studentAchieve;
        prevCloAvg[idx] = c.attainment;
      }
    });
    const caFe = corr.indicators.find((i) => /CA/i.test(i.label));
    onChange({
      ...bundle,
      cqiByProg: {
        ...bundle.cqiByProg,
        [prog]: {
          ...current,
          prevTotalStudents: corr.studentCount || current.prevTotalStudents,
          prevCloPass,
          prevCloAvg,
          prevCaFePassPct: caFe ? caFe.achievement : current.prevCaFePassPct,
        },
      },
    });
    onNotify(`Angka sesi terdahulu diisi daripada CORR (${corr.source || "corr"}).`, "success");
  };

  const fillSuggestions = () => {
    const current = ensureProgCqi();
    const labels = cloLabels(bundle.meta.hasClo4);
    const punca = [...(current.punca || ["", "", "", ""])];
    const cadangan = [...(current.cadangan || ["", "", "", ""])];
    labels.forEach((label, i) => {
      const passPct = stats.passCloPct[i];
      const avg = stats.avgClo[i];
      if (passPct < 80) {
        punca[i] =
          avg < 50
            ? `Majoriti pelajar gagal menguasai kemahiran asas ${label} (purata ${avg.toFixed(1)}%).`
            : `Sebahagian pelajar belum menguasai topik ${label} yang melibatkan pengiraan/aplikasi (purata ${avg.toFixed(1)}%).`;
        cadangan[i] = `Latih tubi berfokus melalui tutorial, kuiz pengukuhan CIDOS dan sesi klinik sebelum penilaian ${label}.`;
      } else {
        cadangan[i] = `Kekalkan kaedah PdP sedia ada bagi ${label} dan perkukuh melalui pembelajaran aktif.`;
      }
    });
    const ulasan =
      stats.caFeCapaiPct < current.kpiCaFeTarget
        ? `Jurang CA-FE melebihi sasaran ${current.kpiCaFeTarget}% bagi ${stats.n - stats.caFeCapaiCount} pelajar; semak kesepadanan aras kesukaran item pentaksiran berterusan dengan peperiksaan akhir.`
        : `Jurang CA-FE berada dalam sasaran petunjuk prestasi (${stats.caFeCapaiPct.toFixed(1)}%).`;
    onChange({
      ...bundle,
      cqiByProg: {
        ...bundle.cqiByProg,
        [prog]: { ...current, punca, cadangan, ulasanTumpuanCaFe: current.ulasanTumpuanCaFe || ulasan },
      },
    });
    onNotify(`Cadangan CQI program ${prog} dijana.`, "success");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const disabled = tab.id !== "import" && !hasData;
            return (
              <button
                key={tab.id}
                disabled={disabled}
                onClick={() => onSubViewChange(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  subView === tab.id
                    ? "bg-sky-600 text-white"
                    : disabled
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {hasData && subView !== "import" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 mr-1">
              {bundle.programmes.map((p) => (
                <button
                  key={p}
                  onClick={() => onProgrammeChange(p)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                    p === prog
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                  title={`${studentsOf(bundle.students, p).length} pelajar`}
                >
                  {p}
                </button>
              ))}
            </div>
            {subView === "borang" && (
              <>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 mr-1">
                  <input
                    type="checkbox"
                    checked={includeLampiran}
                    onChange={(e) => setIncludeLampiran(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Muka surat 3 (lampiran markah)
                </label>
                <button
                  onClick={fillFromCorr}
                  className="px-2.5 py-2 rounded-xl border border-violet-300 text-violet-700 hover:bg-violet-50 text-[11px] font-semibold flex items-center gap-1.5"
                  title="Isi lajur sesi terdahulu dengan angka CORR panitia"
                >
                  <Save className="w-3.5 h-3.5" /> Isi dari CORR
                </button>
                <button
                  onClick={fillSuggestions}
                  className="px-2.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-semibold flex items-center gap-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Isi Cadangan Pintar
                </button>
              </>
            )}
            <button
              onClick={onSave}
              disabled={!apiOnline}
              className="px-2.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> Simpan
            </button>
            <button
              onClick={onPrint}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak / PDF
            </button>
          </div>
        )}
      </div>

      {subView === "import" && (
        <CqiImportPanel
          bundle={bundle}
          busy={busy}
          apiOnline={apiOnline}
          savedList={savedList}
          courseLoaded={courseLoaded}
          onChange={onChange}
          onUpload={onUpload}
          onSelectProgramme={(p) => {
            onProgrammeChange(p);
            onSubViewChange("corr");
          }}
          onOpenBorang={(p) => {
            onProgrammeChange(p);
            onSubViewChange("borang");
          }}
          onOpenSaved={onOpenSaved}
          onDeleteSaved={onDeleteSaved}
        />
      )}

      {subView === "corr" && hasData && <CqiCorrTemplate bundle={bundle} prog={prog} />}

      {subView === "borang" && hasData && (
        <>
          <div className="no-print flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-[11px] text-sky-900">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Semua medan bergaris titik boleh diklik dan ditaip terus pada borang. Klik <strong>Cetak / PDF</strong> untuk
              keluaran A4 (2 muka surat{includeLampiran ? " + lampiran" : ""}).
            </div>
          </div>
          <CqiBorangSheet
            bundle={bundle}
            prog={prog}
            logoUri={logoUri}
            includeLampiran={includeLampiran}
            onChange={onChange}
          />
        </>
      )}
    </div>
  );
}
