import React from "react";

/** Cetakan CSS for the printable CO/JSU sheets.
 *
 * Kept in one place because the same rules drive both documents.
 */
export default function PrintStyles() {
  return (
    <style>{`
      .co-frame { border: 1px solid #000; }
      .co-frame > :not(table) { padding: 2mm 2mm 0; }
      .co-frame > :not(table):last-child { padding-bottom: 2mm; }
      /* 14 columns of long Bahasa headers must never push past the page frame. */
      .slt-table { table-layout: fixed; }
      .slt-table th { font-size: 6pt; line-height: 1.1; padding: 1mm 0.4mm; vertical-align: bottom; overflow-wrap: anywhere; }
      .slt-table td { font-size: 7pt; padding: 2px 0.4mm; overflow-wrap: anywhere; }
      /* Official PLSP-04 prints the SLT headers rotated so the full
         Bahasa labels fit without being clipped. */
      .slt-table th.vert { writing-mode: vertical-rl; transform: rotate(180deg); height: 30mm; text-align: left; }
      .slt-table th.grp { font-size: 7pt; line-height: 1.2; }
      .co-footnote { font-size: 8pt; line-height: 1.2; color: #000; margin-top: 3mm; }
      /* ---------- Laporan CQI (A4 potret, 2-3 muka surat) ---------- */
      .cqi-sheet { max-width: 210mm; }
      .cqi-page { box-sizing: border-box; padding: 12mm; font-size: 9.6pt; line-height: 1.25; }
      .cqi-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
      .cqi-table th, .cqi-table td { border: 1px solid #000; padding: 2px 3px; vertical-align: top; }
      .cqi-table thead th { background: #eef2f7; font-weight: 700; text-align: center; }
      .cqi-nb { table-layout: fixed; }
      .cqi-fixed { table-layout: fixed; }
      .cqi-nb, .cqi-nb td { border: none !important; padding: 0 2px !important; }
      .cqi-field { min-height: 1.15em; border-bottom: 1px dotted #64748b; }
      .cqi-field:empty::before { content: attr(data-ph); color: #94a3b8; }
      .cqi-field:focus { background: #fef9c3; }
      @media screen {
        .cqi-page { min-height: 277mm; background: #fff; border: 1px solid #cbd5e1; box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12); }
        .cqi-page + .cqi-page { margin-top: 14px; }
      }
      @media print {
        /* Zero page margin removes the browser's print header/footer band
           (date, document title) for every print path, not just the button. */
        @page { margin: 0; }
        .no-print { display: none !important; }
        body, main { background: #fff !important; padding: 0 !important; margin: 0 !important; }
        .print-sheet {
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          max-width: 100% !important;
          width: 100% !important;
          overflow: visible !important;
        }
        /* Page padding replaces the @page margin so nothing lands in the
           top/bottom band where the browser draws its header and footer. */
        .co-page {
          box-sizing: border-box;
          padding: 12mm;
          page-break-after: always;
          break-after: page;
        }
        .co-page:last-child { page-break-after: auto; break-after: auto; }
        .jsu-sheet { padding: 8mm !important; }
        .cqi-page {
          padding: 12mm;
          page-break-after: always;
          break-after: page;
        }
        .cqi-page:last-child { page-break-after: auto; break-after: auto; }
        .cqi-field:empty::before { content: ""; }
        .cqi-field { border-bottom-color: #000; background: transparent !important; }
        .cqi-table tr { page-break-inside: avoid; }
        .cqi-table thead { display: table-header-group; }
        th, td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  );
}
