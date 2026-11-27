import { SLT_FIELDS } from "../constants";

export type Course = Record<string, any>;
export type Topic = Record<string, any>;
export type JsuRow = Record<string, any>;

/** Jumlah SLT mengikut lajur + grand total. */
export function computeSltTotals(topics: Topic[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  let grand = 0;
  for (const f of SLT_FIELDS) {
    const sum = topics.reduce((acc, t) => acc + (Number(t[f.key]) || 0), 0);
    out[f.key] = Math.round(sum * 100) / 100;
    grand += out[f.key];
  }
  out.grand = Math.round(grand * 100) / 100;
  return out;
}

/** Jam SLT yang disasarkan: 40 jam bagi setiap kredit. */
export function targetSltOf(course: Course): number {
  return (Number(course.credit_value) || 3) * 40;
}

export type SltReviewRow = { code: string; title: string; lect: number; indep: number; slt: number };

export type SltAssessmentRow = { name: string; pct: number; f2f: number; nf2f: number; slt: number };

export type SltCheck = { label: string; expected: string; actual: string; ok: boolean };

export type SltReview = {
  rows: SltReviewRow[];
  topic: { lect: number; indep: number; slt: number };
  ca: SltAssessmentRow[];
  caTotal: SltAssessmentRow;
  fe: SltAssessmentRow;
  contact: { total: number; weeks: number; perWeek: number };
  grand: { guided: number; indep: number; slt: number };
  target: number;
  unmapped: number;
  checks: SltCheck[];
};

/** Kumpulan lajur SLT bagi setiap jenis penilaian berterusan. */
const CA_GROUPS: { name: string; match: RegExp; f2f: string[]; nf2f: string[] }[] = [
  { name: "Quiz", match: /quiz/i, f2f: ["f2f_quiz"], nf2f: ["nf2f_quiz"] },
  { name: "Test", match: /test|ujian/i, f2f: ["f2f_test"], nf2f: ["nf2f_test"] },
  { name: "Presentation", match: /present|pembentangan/i, f2f: ["f2f_pres"], nf2f: ["nf2f_pres"] },
  { name: "Assignment", match: /assign|tugasan/i, f2f: [], nf2f: ["nf2f_assg"] },
  { name: "Case Study", match: /case|kajian/i, f2f: [], nf2f: ["nf2f_case"] },
];

const FE_MATCH = /final|exam|peperiksaan|akhir/i;

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Semakan SLT mengikut bentuk jadual rasmi silibus: taburan topik (L + kendiri),
 * penilaian berterusan, penilaian akhir dan jumlah keseluruhan.
 */
export function computeSltReview(course: Course): SltReview {
  const topics: Topic[] = course.topics || [];
  const num = (t: Topic, key: string) => Number(t[key]) || 0;
  const sumKeys = (keys: string[]) =>
    round2(topics.reduce((acc, t) => acc + keys.reduce((a, k) => a + num(t, k), 0), 0));

  const rows: SltReviewRow[] = topics.map((t) => {
    const lect = round2(num(t, "f2f_lect"));
    const indep = round2(num(t, "nf2f_indep"));
    return { code: t.code, title: t.title || "", lect, indep, slt: round2(lect + indep) };
  });

  const topicSlt = round2(rows.reduce((a, r) => a + r.slt, 0));

  const assessments: Record<string, any>[] = course.assessments || [];
  const feAssessment = assessments.find((a) => FE_MATCH.test(a.name || ""));
  const caAssessments = assessments.filter((a) => !FE_MATCH.test(a.name || ""));

  const ca: SltAssessmentRow[] = [];
  for (const g of CA_GROUPS) {
    const matched = caAssessments.filter((a) => g.match.test(a.name || ""));
    const f2f = sumKeys(g.f2f);
    const nf2f = sumKeys(g.nf2f);
    if (!matched.length && !f2f && !nf2f) continue;
    const pct = round2(matched.reduce((a, x) => a + (Number(x.percentage) || 0), 0));
    ca.push({ name: matched[0]?.name || g.name, pct, f2f, nf2f, slt: round2(f2f + nf2f) });
  }
  // Penilaian yang tidak dikenali tetap dipaparkan supaya peratusnya tidak hilang.
  for (const a of caAssessments) {
    if (CA_GROUPS.some((g) => g.match.test(a.name || ""))) continue;
    ca.push({ name: a.name, pct: Number(a.percentage) || 0, f2f: 0, nf2f: 0, slt: 0 });
  }

  const caTotal: SltAssessmentRow = {
    name: "TOTAL",
    pct: round2(ca.reduce((a, r) => a + r.pct, 0)),
    f2f: round2(ca.reduce((a, r) => a + r.f2f, 0)),
    nf2f: round2(ca.reduce((a, r) => a + r.nf2f, 0)),
    slt: round2(ca.reduce((a, r) => a + r.slt, 0)),
  };

  const feF2f = sumKeys(["f2f_fe"]);
  const feNf2f = sumKeys(["nf2f_fe"]);
  const fePct = feAssessment ? Number(feAssessment.percentage) || 0 : Number(course.fe_weight) || 0;
  const fe: SltAssessmentRow = {
    name: feAssessment?.name || "Final Examination",
    pct: fePct,
    f2f: feF2f,
    nf2f: feNf2f,
    slt: round2(feF2f + feNf2f),
  };

  const guided = sumKeys(SLT_FIELDS.filter((f) => f.key.startsWith("f2f_")).map((f) => f.key));
  const indep = sumKeys(SLT_FIELDS.filter((f) => f.key.startsWith("nf2f_")).map((f) => f.key));
  const grand = { guided, indep, slt: round2(guided + indep) };

  const target = targetSltOf(course);
  const weeks = Number(course.study_weeks) || 14;
  const contactLect = round2(rows.reduce((a, r) => a + r.lect, 0) + caTotal.f2f);
  const perWeek = weeks > 0 ? round2(contactLect / weeks) : 0;

  const unmapped = round2(grand.slt - (topicSlt + caTotal.slt + fe.slt));
  const pctTotal = round2(caTotal.pct + fe.pct);

  const checks: SltCheck[] = [
    {
      label: "Jumlah SLT = kredit × 40",
      expected: `${target} jam`,
      actual: `${grand.slt} jam`,
      ok: Math.abs(grand.slt - target) < 0.01,
    },
    {
      label: "SLT topik + CA + FE = jumlah SLT",
      expected: `${grand.slt} jam`,
      actual: `${round2(topicSlt + caTotal.slt + fe.slt)} jam`,
      ok: Math.abs(unmapped) < 0.01,
    },
    {
      label: "Peratus CA + FE = 100%",
      expected: "100%",
      actual: `${pctTotal}%`,
      ok: Math.abs(pctTotal - 100) < 0.01,
    },
    {
      label: "Semua topik ada jam kuliah",
      expected: `${rows.length} topik`,
      actual: `${rows.filter((r) => r.lect > 0).length} topik`,
      ok: rows.length > 0 && rows.every((r) => r.lect > 0),
    },
  ];

  return {
    rows,
    topic: { lect: round2(rows.reduce((a, r) => a + r.lect, 0)), indep: round2(rows.reduce((a, r) => a + r.indep, 0)), slt: topicSlt },
    ca,
    caTotal,
    fe,
    contact: { total: contactLect, weeks, perWeek },
    grand,
    target,
    unmapped,
    checks,
  };
}

/** PLO unik yang dirujuk oleh CLO, mengikut susunan kemunculan. */
export function uniquePlos(clos: any[] = []): string[] {
  const seen: string[] = [];
  for (const c of clos) {
    const p = (c.plo || "").trim().toUpperCase();
    if (p && !seen.includes(p)) seen.push(p);
  }
  return seen;
}

/** Semakan 13 item silibus untuk paparan status. */
export function buildChecklist(course: Course): [string, boolean][] {
  return [
    ["1. Nama", !!course.course_name],
    ["2. Kod", !!course.course_code],
    ["3. Sinopsis", !!course.synopsis],
    ["4. Kredit", !!course.credit_value],
    ["5. Pra-Syarat", !!course.prerequisite],
    ["6. CLO", course.clos?.length > 0],
    ["7. CLO-PLO", course.clos?.length > 0],
    ["8. SLT", course.topics?.length > 0],
    ["9. Khas", !!course.special_requirement],
    ["10. Rujukan", course.main_references?.length > 0 || course.additional_references?.length > 0],
    ["11. Info Lain", !!course.other_additional_info],
    ["12. Topik", course.topics?.length > 0],
    ["13. Penilaian", course.assessments?.length > 0],
  ];
}

export type JsuComputed = {
  rows: JsuRow[];
  topics: Topic[];
  tSlts: number[];
  tPcts: number[];
  cloTotals: Record<string, number>;
  cloSpans: number[];
  topicMarkSums: number[];
  totals: {
    c1i: number;
    c1m: number;
    c2i: number;
    c2m: number;
    c3i: number;
    c3m: number;
    a3i: number;
    a3m: number;
    marks: number;
    weight: number;
  };
};

/** rowspan CLO, peratus SLT dan jumlah markah untuk Pratonton JSU PB. */
export function computeJsu(course: Course): JsuComputed {
  const rows: JsuRow[] = course.jsu?.rows || [];
  const topics: Topic[] = course.topics || [];

  const tSlts = topics.map(
    (t) => Math.round(((Number(t.f2f_lect) || 0) + (Number(t.nf2f_indep) || 0)) * 10) / 10
  );
  const totalTeachSlt = tSlts.reduce((a, b) => a + b, 0) || 1;
  const tPcts = tSlts.map((s) => Math.round((s / totalTeachSlt) * 1000) / 10);

  const cloTotals: Record<string, number> = {};
  rows.forEach((r) => {
    const rm =
      (Number(r.c1_marks) || 0) +
      (Number(r.c2_marks) || 0) +
      (Number(r.c3_marks) || 0) +
      (Number(r.a3_marks) || 0);
    cloTotals[r.clo] = (cloTotals[r.clo] || 0) + rm;
  });

  const cloSpans = new Array(rows.length).fill(0);
  for (let i = 0; i < rows.length; ) {
    let span = 1;
    while (i + span < rows.length && rows[i + span].clo === rows[i].clo) span++;
    cloSpans[i] = span;
    i += span;
  }

  const topicMarkSums = topics.map((t) =>
    rows.reduce((acc, r) => acc + (Number(r.topic_marks?.[t.code]) || 0), 0)
  );

  const totals = rows.reduce<JsuComputed["totals"]>(
    (acc, r) => {
      const rm =
        (Number(r.c1_marks) || 0) +
        (Number(r.c2_marks) || 0) +
        (Number(r.c3_marks) || 0) +
        (Number(r.a3_marks) || 0);
      return {
        c1i: acc.c1i + (Number(r.c1_items) || 0),
        c1m: acc.c1m + (Number(r.c1_marks) || 0),
        c2i: acc.c2i + (Number(r.c2_items) || 0),
        c2m: acc.c2m + (Number(r.c2_marks) || 0),
        c3i: acc.c3i + (Number(r.c3_items) || 0),
        c3m: acc.c3m + (Number(r.c3_marks) || 0),
        a3i: acc.a3i + (Number(r.a3_items) || 0),
        a3m: acc.a3m + (Number(r.a3_marks) || 0),
        marks: acc.marks + rm,
        weight: acc.weight + (Number(r.weight_pct) || 0),
      };
    },
    { c1i: 0, c1m: 0, c2i: 0, c2m: 0, c3i: 0, c3m: 0, a3i: 0, a3m: 0, marks: 0, weight: 0 }
  );

  return { rows, topics, tSlts, tPcts, cloTotals, cloSpans, topicMarkSums, totals };
}
