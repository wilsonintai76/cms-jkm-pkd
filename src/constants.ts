import { BookOpen, ClipboardCheck, FileText, Grid, Settings } from "lucide-react";

export const API_BASE = "http://127.0.0.1:8765/api";

export const PLO_CATALOG: Record<string, string> = {
  PLO1: "Apply knowledge of applied mathematics, applied science, computer and engineering fundamentals and an engineering specialisation as specified in DK1 to DK4 respectively to wide practical procedures and practices in area of mechanical engineering.",
  PLO2: "Identify and analyse well-defined engineering problems reaching substantiated conclusions using codified methods of analysis specific to their field of activity (DK1 to DK4).",
  PLO3: "Design solutions for well-defined technical problems and assist with the design of systems, components or processes to meet specified needs with appropriate consideration for public health and safety, cultural, societal, and environmental considerations (DK5).",
  PLO4: "Conduct investigations of well-defined problems; locate and search relevant codes and catalogues, conduct standard tests and measurements (DK8).",
  PLO5: "Apply appropriate techniques, resources, and modern engineering and IT tools to well-defined engineering problems, with an awareness of the limitations (DK6).",
  PLO6: "Demonstrate knowledge of the societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to engineering technician practice and solutions to well-defined engineering problems (DK7).",
  PLO7: "Understand and commit to professional ethics and responsibilities and norms of technician practice and including compliance with national and international laws. Demonstrate an understanding of the need for diversity and inclusion (DK9).",
  PLO8: "Function effectively as an individual, and as a member in diverse technical teams.",
  PLO9: "Communicate effectively on well-defined engineering activities with the engineering community and with society at large, by being able to comprehend the work of others, document their own work, and give and receive clear instructions.",
  PLO10: "Demonstrate awareness and understanding of engineering management principles and economic decision-making and apply these to one's own work, as a member and leader in a technical team and to manage projects in multidisciplinary environments.",
  PLO11: "Recognise the need for and have the ability for i) independent and lifelong learning and ii) critical thinking in the face of specialised technical knowledge (DK8).",
};

export type SltField = { key: string; label: string; short: string };

/**
 * `label` is the long Bahasa name used by the official printed form;
 * `short` is the compact header used in the on-screen editor.
 */
export const SLT_FIELDS: SltField[] = [
  { key: "f2f_lect", label: "KULIAH", short: "Kuliah" },
  { key: "f2f_quiz", label: "QUIZ", short: "Quiz(F)" },
  { key: "f2f_test", label: "TEST", short: "Test(F)" },
  { key: "f2f_pres", label: "PEMBENTANGAN", short: "Pres(F)" },
  { key: "f2f_fe", label: "PEPERIKSAAN AKHIR", short: "FE(F)" },
  { key: "nf2f_indep", label: "KENDIRI", short: "Kendiri" },
  { key: "nf2f_quiz", label: "QUIZ", short: "Quiz(N)" },
  { key: "nf2f_test", label: "TEST", short: "Test(N)" },
  { key: "nf2f_assg", label: "TUGASAN", short: "Assg(N)" },
  { key: "nf2f_case", label: "KAJIAN KES", short: "Case(N)" },
  { key: "nf2f_pres", label: "PEMBENTANGAN", short: "Pres(N)" },
  { key: "nf2f_fe", label: "PEPERIKSAAN AKHIR", short: "FE(N)" },
];

export const F2F_FIELDS = SLT_FIELDS.filter((f) => f.key.startsWith("f2f_"));
export const NF2F_FIELDS = SLT_FIELDS.filter((f) => f.key.startsWith("nf2f_"));

export const NAV_ITEMS = [
  { id: "course_info", label: "1. Maklumat Kursus (13 Item)", icon: BookOpen },
  { id: "co_module", label: "2. Course Outline (Lampiran 4)", icon: FileText },
  { id: "jsu_module", label: "3. Jadual Spesifikasi Ujian", icon: Grid },
  { id: "cqi_module", label: "4. Laporan CQI (PBCLOGSA & CORR)", icon: ClipboardCheck },
  { id: "settings", label: "5. Tetapan & Logo", icon: Settings },
];

export const DEFAULT_DOC_CODE = "PLSP-04 (4) (26-02-26)";
