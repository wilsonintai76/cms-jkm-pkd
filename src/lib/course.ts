import type { Course } from "./calc";
import { SLT_FIELDS } from "../constants";

export function emptyTopic(code: string) {
  const slt: Record<string, number> = {};
  for (const f of SLT_FIELDS) slt[f.key] = 0;

  return {
    code,
    title: "",
    raw_subtopics: "",
    narrative: "",
    contact_desc: "",
    assessment_method: "",
    week: "",
    ...slt,
  };
}

/** Kursus kosong — titik mula apabila tiada rekod dimuatkan. */
export function createEmptyCourse(): Course {
  return {
    institution: "POLITEKNIK MALAYSIA",
    department: "",
    doc_code: "",
    course_name: "",
    course_code: "",
    synopsis: "",
    semester_offered: "1",
    session: "",
    credit_value: 3,
    study_weeks: 14,
    week_auto: true,
    prerequisite: "",
    clos: [],
    ca_weight: 50,
    fe_weight: 50,
    assessments: [],
    passing_notes: [],
    special_requirement: "",
    other_additional_info: "",
    topics: [],
    main_references: [],
    additional_references: [],
    prepared_by: "",
    prepared_date: "",
    verified_by: "",
    verified_date: "",
    jsu: {
      programme_name: "",
      head_of_programme: "",
      curriculum_version: "",
      effective_session: "",
      dp_statement: "",
      verified_role: "",
      rows: [],
    },
  };
}
