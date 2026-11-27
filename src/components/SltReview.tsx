import React from "react";
import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { computeSltReview } from "../lib/calc";
import { fmt } from "../lib/format";
import type { Course } from "../lib/calc";

type SltReviewProps = {
  course: Course;
  onChange: (next: Course) => void;
  onEdit: () => void;
};

const TH = "border border-slate-300 p-1.5 bg-slate-200 font-bold";
const TD = "border border-slate-300 p-1.5";

/** Semakan SLT mengikut bentuk jadual rasmi silibus supaya pengguna boleh banding dengan PDF. */
export default function SltReview({ course, onChange, onEdit }: SltReviewProps) {
  const review = computeSltReview(course);
  const balanced = Math.abs(review.grand.slt - review.target) < 0.01;
  const handled = Math.abs(review.unmapped) < 0.01;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Semak SLT — Pengesahan Taburan Jam</h2>
            <p className="text-xs text-slate-500">
              Bandingkan nilai di bawah dengan jadual <strong>Distribution of Student Learning Time</strong> dalam
              silibus. Ubah jam di tab <strong>1. Jadual Mingguan &amp; Matriks SLT</strong>.
            </p>
          </div>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 rounded-lg border border-sky-300 text-sky-700 hover:bg-sky-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" /> Ubah jam SLT
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Guided Learning (F2F)</div>
            <div className="text-2xl font-bold">{fmt(review.grand.guided)}</div>
            <div className="text-[11px] text-slate-500">jam</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Independent Learning (NF2F)</div>
            <div className="text-2xl font-bold">{fmt(review.grand.indep)}</div>
            <div className="text-[11px] text-slate-500">jam</div>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              balanced ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Jumlah SLT</div>
            <div className={`text-2xl font-bold ${balanced ? "text-emerald-700" : "text-rose-700"}`}>
              {fmt(review.grand.slt)}
            </div>
            <div className="text-[11px] text-slate-500">sasaran {review.target} jam</div>
          </div>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
          {review.checks.map((c) => (
            <li
              key={c.label}
              className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                c.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"
              }`}
            >
              {c.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              )}
              <span>
                <span className="font-semibold">{c.label}</span>
                <span className="text-slate-600">
                  {" "}
                  — {c.actual} <span className="text-slate-400">(jangkaan {c.expected})</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2 overflow-x-auto">
        <h3 className="text-sm font-bold">1. Taburan SLT mengikut topik</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-center">
              <th className={`${TH} text-left`}>Topik</th>
              <th className={TH}>Minggu</th>
              <th className={TH}>Kuliah (L)</th>
              <th className={TH}>Kendiri (IL)</th>
              <th className={TH}>SLT</th>
            </tr>
          </thead>
          <tbody>
            {review.rows.length === 0 && (
              <tr>
                <td className={`${TD} text-center text-slate-500`} colSpan={5}>
                  Tiada topik.
                </td>
              </tr>
            )}
            {review.rows.map((r, i) => {
              const skewed = Math.abs(r.lect - r.indep) > 0.01;
              return (
                <tr key={i}>
                  <td className={TD}>
                    <span className="font-bold">{r.code}</span>{" "}
                    <span className="uppercase text-slate-700">{r.title}</span>
                  </td>
                  <td className={`${TD} text-center font-semibold`}>{r.week}</td>
                  <td className={`${TD} text-center ${skewed ? "text-amber-700 font-semibold" : ""}`}>{fmt(r.lect)}</td>
                  <td className={`${TD} text-center ${skewed ? "text-amber-700 font-semibold" : ""}`}>{fmt(r.indep)}</td>
                  <td className={`${TD} text-center font-bold`}>{fmt(r.slt)}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-100 font-bold">
              <td className={TD} colSpan={2}>
                TOTAL TOPIK
              </td>
              <td className={`${TD} text-center`}>{fmt(review.topic.lect)}</td>
              <td className={`${TD} text-center`}>{fmt(review.topic.indep)}</td>
              <td className={`${TD} text-center`}>{fmt(review.topic.slt)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[11px] text-slate-500">
          Minggu dikira automatik daripada jam kuliah ÷ jam kontak seminggu ({fmt(review.contact.perWeek)} jam). Jam
          berwarna amber bermaksud jam kendiri tidak sama dengan jam kuliah — silibus biasanya menetapkan kedua-duanya
          sama bagi setiap topik.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2 overflow-x-auto">
        <h3 className="text-sm font-bold">2. Penilaian, penilaian akhir &amp; jumlah keseluruhan</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-center">
              <th className={`${TH} text-left`}>Continuous Assessment</th>
              <th className={TH}>Percentage (%)</th>
              <th className={TH}>Assessment Time</th>
              <th className={TH}>Independent Learning</th>
              <th className={TH}>SLT</th>
            </tr>
          </thead>
          <tbody>
            {review.ca.map((r, i) => (
              <tr key={i}>
                <td className={TD}>{r.name}</td>
                <td className={`${TD} text-center`}>{fmt(r.pct)}</td>
                <td className={`${TD} text-center`}>{fmt(r.f2f)}</td>
                <td className={`${TD} text-center`}>{fmt(r.nf2f)}</td>
                <td className={`${TD} text-center`}>{fmt(r.slt)}</td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold">
              <td className={TD}>TOTAL</td>
              <td className={`${TD} text-center`}>{fmt(review.caTotal.pct)}</td>
              <td className={`${TD} text-center`}>{fmt(review.caTotal.f2f)}</td>
              <td className={`${TD} text-center`}>{fmt(review.caTotal.nf2f)}</td>
              <td className={`${TD} text-center`}>{fmt(review.caTotal.slt)}</td>
            </tr>
            <tr>
              <td className={`${TD} font-semibold bg-slate-50`} colSpan={5}>
                FINAL ASSESSMENT
              </td>
            </tr>
            <tr>
              <td className={TD}>{review.fe.name}</td>
              <td className={`${TD} text-center`}>{fmt(review.fe.pct)}</td>
              <td className={`${TD} text-center`}>{fmt(review.fe.f2f)}</td>
              <td className={`${TD} text-center`}>{fmt(review.fe.nf2f)}</td>
              <td className={`${TD} text-center`}>{fmt(review.fe.slt)}</td>
            </tr>
            <tr className="bg-slate-200 font-bold">
              <td className={TD}>GRAND TOTAL</td>
              <td className={`${TD} text-center`}>Guided: {fmt(review.grand.guided)}</td>
              <td className={`${TD} text-center`} colSpan={2}>
                Independent: {fmt(review.grand.indep)}
              </td>
              <td className={`${TD} text-center`}>SLT: {fmt(review.grand.slt)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[11px] text-slate-500">
          Guided = kuliah + masa penilaian CA + peperiksaan akhir. Independent = jam kendiri topik + pembelajaran
          kendiri CA + peperiksaan akhir.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">3. Jam kontak (contact hours)</h3>
          <label className="text-xs font-semibold flex items-center gap-1.5">
            Minggu pengajian
            <input
              type="number"
              min="1"
              step="1"
              value={review.contact.weeks}
              onChange={(e) => onChange({ ...course, study_weeks: parseFloat(e.target.value) || 14 })}
              className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-center"
            />
          </label>
        </div>
        <table className="w-full border-collapse text-xs text-center">
          <thead>
            <tr>
              <th className={`${TH} text-left`}>Contact Hours</th>
              <th className={TH}>L</th>
              <th className={TH}>P</th>
              <th className={TH}>T</th>
              <th className={TH}>O</th>
              <th className={TH}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${TD} text-left font-semibold`}>Persemester ({review.contact.weeks} minggu)</td>
              <td className={TD}>{fmt(review.contact.total)}</td>
              <td className={TD}>0</td>
              <td className={TD}>0</td>
              <td className={TD}>0</td>
              <td className={`${TD} font-bold`}>{fmt(review.contact.total)}</td>
            </tr>
            <tr className="bg-slate-100">
              <td className={`${TD} text-left font-semibold`}>Perweek</td>
              <td className={TD}>{fmt(review.contact.perWeek)}</td>
              <td className={TD}>0</td>
              <td className={TD}>0</td>
              <td className={TD}>0</td>
              <td className={`${TD} font-bold`}>{fmt(review.contact.perWeek)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[11px] text-slate-500">
          L = jam kuliah topik + masa penilaian CA. Aplikasi ini hanya merekod jam kuliah, jadi P/T/O sentiasa 0.
          {handled ? "" : ` Terdapat ${fmt(review.unmapped)} jam penilaian yang belum dipetakan.`}
        </p>
      </div>
    </div>
  );
}
