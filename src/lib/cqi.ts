/** Model & pengiraan Laporan CQI (PBCLOGSA + CORR panitia). */

export type CqiStudent = {
  metric: string;
  name: string;
  prog: string;
  className: string;
  section: string;
  lecturer: string;
  clo: number[];
  clo1: number;
  clo2: number;
  clo3: number;
  clo4: number | null;
  plo: { code: string; value: number }[];
  generic: number | null;
  ca: number;
  fe: number;
  caFeDiff: number;
  caFeAvg: number;
  grade: string;
  source?: string;
};

export type CorrIndicator = { label: string; target: number; achievement: number };

export type CorrCriterion = {
  code: string;
  description: string;
  attainment: number;
  studentAchieve: number;
};

export type CqiCorr = {
  programme: string;
  programmeName: string;
  classes: string[];
  courseCode: string;
  courseName: string;
  lecturer: string;
  studentCount: number;
  date: string;
  indicators: CorrIndicator[];
  gradeDistribution: Record<string, number>;
  clos: CorrCriterion[];
  plos: CorrCriterion[];
  reflection: { pencapaian: string; cadangan: string };
  source?: string;
};

export type CqiSource = { name: string; kind: string; count: number };

export type CqiMeta = {
  code: string;
  name: string;
  jabatan: string;
  coordinator: string;
  prevSession: string;
  currSession: string;
  nextSession: string;
  hasClo4: boolean;
};

export type TindakanRow = { aktiviti: string; impak: string; bukti: string };
export type MaklumBalasRow = { perkara: string; maklumbalas: string };

export type ProgCqi = {
  seksyenOverride: string;
  classesOverride: string;
  prevTotalStudents: number;
  prevPassAllCount: number;
  /** [CLO1..CLO4] peratus pelajar lulus CLO > 50%. */
  prevCloPass: number[];
  /** [CLO1..CLO4] purata markah CLO. */
  prevCloAvg: number[];
  prevCaFePassPct: number;
  kpiCaFeTarget: number;
  punca: string[];
  cadangan: string[];
  tumpuanOverride: string;
  ulasanTumpuanCaFe: string;
  bBaseSession: string;
  bRows: TindakanRow[];
  dRows: MaklumBalasRow[];
  verifierName: string;
  verifierRemarks: string;
};

export type CqiBundle = {
  meta: CqiMeta;
  students: CqiStudent[];
  sections: Record<string, any>[];
  corr: CqiCorr | null;
  sources: CqiSource[];
  programmes: string[];
  cqiByProg: Record<string, ProgCqi>;
};

export type ProgStats = {
  n: number;
  passAll: number;
  failAll: number;
  passAllPct: number;
  sumClo: number[];
  avgClo: number[];
  failClo: number[];
  passCloPct: number[];
  avgCa: number;
  avgFe: number;
  avgCaFe: number;
  caFeCapaiCount: number;
  caFeCapaiPct: number;
  classes: string[];
  lecturers: string[];
  sections: string[];
  gradeCounts: Record<string, number>;
};

export const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "E", "E-", "F"];

export const SESSION_RE = /^\s*(I{1,2})\s*:\s*(\d{4})\s*\/\s*(\d{4})\s*$/i;

/** "II : 2025/2026" -> previous / next semester label. */
export function splitSession(session: string): { roman: string; start: number; end: number } | null {
  const m = SESSION_RE.exec(session || "");
  if (!m) return null;
  return { roman: m[1].toUpperCase(), start: Number(m[2]), end: Number(m[3]) };
}

export function prevSessionOf(session: string): string {
  const s = splitSession(session);
  if (!s) return "";
  return s.roman === "II" ? `I : ${s.start}/${s.end}` : `II : ${s.start - 1}/${s.start}`;
}

export function nextSessionOf(session: string): string {
  const s = splitSession(session);
  if (!s) return "";
  return s.roman === "II" ? `I : ${s.end}/${s.end + 1}` : `II : ${s.start}/${s.end}`;
}

export function defaultProgCqi(session = ""): ProgCqi {
  return {
    seksyenOverride: "",
    classesOverride: "",
    prevTotalStudents: 0,
    prevPassAllCount: 0,
    prevCloPass: [0, 0, 0, 0],
    prevCloAvg: [0, 0, 0, 0],
    prevCaFePassPct: 0,
    kpiCaFeTarget: 25,
    punca: ["", "", "", ""],
    cadangan: ["", "", "", ""],
    tumpuanOverride: "",
    ulasanTumpuanCaFe: "",
    bBaseSession: prevSessionOf(session),
    bRows: [{ aktiviti: "", impak: "", bukti: "" }],
    dRows: [{ perkara: "SILIBUS", maklumbalas: "TIADA MAKLUMBALAS" }],
    verifierName: "",
    verifierRemarks: "",
  };
}

export function createEmptyCqi(): CqiBundle {
  return {
    meta: {
      code: "",
      name: "",
      jabatan: "",
      coordinator: "",
      prevSession: "",
      currSession: "",
      nextSession: "",
      hasClo4: false,
    },
    students: [],
    sections: [],
    corr: null,
    sources: [],
    programmes: [],
    cqiByProg: {},
  };
}

/** Nilai pemegang tempat dalam rekod kursus yang tidak patut disalin ke laporan. */
const META_PLACEHOLDER = /^(pensyarah|penyelia|nama|tiada|tbc|tba|none|-+)$/i;

/**
 * Isi kepala laporan CQI (kod, nama, jabatan, penyelaras, CLO4) daripada rekod
 * kursus CO/JSU. Tanpa `force` hanya medan kosong diisi supaya suntingan
 * pengguna tidak ditimpa.
 */
export function metaFromCourse(
  course: Record<string, any> | null | undefined,
  meta: CqiMeta,
  force = false,
): CqiMeta {
  if (!course) return meta;
  const clean = (value: unknown) => {
    const text = String(value ?? "").trim();
    return META_PLACEHOLDER.test(text) ? "" : text;
  };
  const pick = (current: string, incoming: unknown) => {
    const value = clean(incoming);
    if (!value) return current;
    return force || !current.trim() ? value : current;
  };

  const next: CqiMeta = {
    ...meta,
    code: pick(meta.code, course.course_code),
    name: pick(meta.name, course.course_name),
    jabatan: pick(meta.jabatan, course.department),
    coordinator: pick(meta.coordinator, course.prepared_by),
    hasClo4: meta.hasClo4 || (course.clos?.length || 0) >= 4,
  };

  const unchanged =
    next.code === meta.code &&
    next.name === meta.name &&
    next.jabatan === meta.jabatan &&
    next.coordinator === meta.coordinator &&
    next.hasClo4 === meta.hasClo4;
  return unchanged ? meta : next;
}

/**
 * Lengkapkan sesi laporan CQI daripada tetapan aplikasi. `previous` ialah nilai
 * tetapan yang dipakai sebelum ini, supaya perubahan tetapan mengemas kini sesi
 * yang dahulunya diisi oleh tetapan (bukan sesi yang datang dari dokumen).
 */
export function withSession(meta: CqiMeta, session: string, previous = ""): CqiMeta {
  const value = (session || "").trim();
  if (!value || !SESSION_RE.test(value)) return meta;
  const current = meta.currSession.trim();
  if (current && current !== previous.trim()) return meta;
  const prev = prevSessionOf(value) || meta.prevSession;
  const next = nextSessionOf(value) || meta.nextSession;
  if (current === value && meta.prevSession === prev && meta.nextSession === next) return meta;
  return { ...meta, currSession: value, prevSession: prev, nextSession: next };
}

export function programmesOf(students: CqiStudent[]): string[] {  return Array.from(new Set(students.map((s) => s.prog).filter(Boolean))).sort();
}

export function studentsOf(students: CqiStudent[], prog: string): CqiStudent[] {
  return students
    .filter((s) => s.prog === prog)
    .sort((a, b) => (a.className || "").localeCompare(b.className || "") || a.name.localeCompare(b.name));
}

export function passAllClo(s: CqiStudent, hasClo4: boolean): boolean {
  const base = s.clo1 >= 50 && s.clo2 >= 50 && s.clo3 >= 50;
  if (!hasClo4) return base;
  return base && (Number(s.clo4) || 0) >= 50;
}

/** Pelajar program lain yang menumpang kelas yang sama (tidak dikira dalam CQI prog ini). */
export function tumpangOf(students: CqiStudent[], prog: string): CqiStudent[] {
  const own = studentsOf(students, prog);
  const classes = new Set(own.map((s) => s.className).filter(Boolean));
  return students.filter((s) => s.prog !== prog && classes.has(s.className));
}

export function emptyStats(): ProgStats {
  return {
    n: 0,
    passAll: 0,
    failAll: 0,
    passAllPct: 0,
    sumClo: [0, 0, 0, 0],
    avgClo: [0, 0, 0, 0],
    failClo: [0, 0, 0, 0],
    passCloPct: [0, 0, 0, 0],
    avgCa: 0,
    avgFe: 0,
    avgCaFe: 0,
    caFeCapaiCount: 0,
    caFeCapaiPct: 0,
    classes: [],
    lecturers: [],
    sections: [],
    gradeCounts: {},
  };
}

export function computeProgStats(students: CqiStudent[], prog: string, hasClo4: boolean): ProgStats {
  const list = studentsOf(students, prog);
  if (!list.length) return emptyStats();

  const n = list.length;
  const sumClo = [0, 0, 0, 0];
  const failClo = [0, 0, 0, 0];
  const gradeCounts: Record<string, number> = {};
  let passAll = 0;
  let sumCa = 0;
  let sumFe = 0;
  let caFeCapai = 0;
  const classes = new Set<string>();
  const lecturers = new Set<string>();
  const sections = new Set<string>();

  for (const s of list) {
    if (passAllClo(s, hasClo4)) passAll++;
    const clo = [s.clo1, s.clo2, s.clo3, Number(s.clo4) || 0];
    for (let i = 0; i < 4; i++) {
      const v = Number(clo[i]) || 0;
      sumClo[i] += v;
      if (v < 50 && (i < 3 || hasClo4)) failClo[i]++;
    }
    const ca = Number(s.ca) || 0;
    const fe = Number(s.fe) || 0;
    sumCa += ca;
    sumFe += fe;
    if (Math.abs(ca - fe) < 30) caFeCapai++;
    if (s.className) classes.add(s.className);
    if (s.lecturer) lecturers.add(s.lecturer);
    if (s.section) sections.add(s.section);
    if (s.grade) gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1;
  }

  const failAll = n - passAll;
  return {
    n,
    passAll,
    failAll,
    passAllPct: (passAll / n) * 100,
    sumClo,
    avgClo: sumClo.map((v) => v / n),
    failClo,
    passCloPct: failClo.map((f) => ((n - f) / n) * 100),
    avgCa: sumCa / n,
    avgFe: sumFe / n,
    avgCaFe: (sumCa - sumFe) / n,
    caFeCapaiCount: caFeCapai,
    caFeCapaiPct: (caFeCapai / n) * 100,
    classes: Array.from(classes),
    lecturers: Array.from(lecturers),
    sections: Array.from(sections),
    gradeCounts,
  };
}

export function trendOf(currPct: number, prevPct: number, prevTotal: number): { status: string; diff: string } {
  if (!prevTotal || prevTotal <= 0) return { status: "N/A", diff: "N/A" };
  const d = currPct - prevPct;
  if (Math.abs(d) < 0.05) return { status: "KEKAL", diff: "0.0%" };
  return { status: d > 0 ? "MENAIK" : "MENURUN", diff: `${d.toFixed(1)}%` };
}

/** Convert the /api/cqi/extract response into the editable bundle. */
export function bundleFromExtract(data: any): CqiBundle {
  const students: CqiStudent[] = (data?.students || []).map((s: any) => ({
    metric: String(s.metric || ""),
    name: String(s.name || ""),
    prog: String(s.prog || ""),
    className: String(s.className || ""),
    section: String(s.section || ""),
    lecturer: String(s.lecturer || ""),
    clo: Array.isArray(s.clo) ? s.clo.map(Number) : [],
    clo1: Number(s.clo1) || 0,
    clo2: Number(s.clo2) || 0,
    clo3: Number(s.clo3) || 0,
    clo4: s.clo4 === null || s.clo4 === undefined ? null : Number(s.clo4),
    plo: Array.isArray(s.plo) ? s.plo : [],
    generic: s.generic === null || s.generic === undefined ? null : Number(s.generic),
    ca: Number(s.ca) || 0,
    fe: Number(s.fe) || 0,
    caFeDiff: Number(s.caFeDiff) || 0,
    caFeAvg: Number(s.caFeAvg) || 0,
    grade: String(s.grade || ""),
    source: s.source,
  }));

  const corr: CqiCorr | null = data?.corr ?? null;
  const session = String(data?.session || "");
  const hasClo4 = Boolean(data?.hasClo4) || students.some((s) => s.clo4 !== null);
  const programmes = programmesOf(students);
  const cqiByProg: Record<string, ProgCqi> = {};
  programmes.forEach((p) => {
    cqiByProg[p] = defaultProgCqi(session);
  });

  return {
    meta: {
      code: String(data?.courseCode || corr?.courseCode || ""),
      name: String(data?.courseName || corr?.courseName || ""),
      jabatan: String(data?.jabatan || ""),
      coordinator: String(corr?.lecturer || ""),
      currSession: session,
      prevSession: prevSessionOf(session),
      nextSession: nextSessionOf(session),
      hasClo4,
    },
    students,
    sections: data?.sections || [],
    corr,
    sources: data?.sources || [],
    programmes,
    cqiByProg,
  };
}

/** Label CLO for display: CLO1..CLO4. */
export function cloLabels(hasClo4: boolean): string[] {
  return hasClo4 ? ["CLO1", "CLO2", "CLO3", "CLO4"] : ["CLO1", "CLO2", "CLO3"];
}
