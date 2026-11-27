import base64
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import urllib.request
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:  # PyMuPDF is bundled with the sidecar build.
    import pymupdf  # type: ignore
except ImportError:  # pragma: no cover - only when the dependency is missing
    pymupdf = None  # type: ignore

# ==============================================================================
# KONFIGURASI DIREKTORI & STORAN DESKTOP
# ==============================================================================
IS_FROZEN = bool(getattr(sys, "frozen", False))

# A PyInstaller one-file exe unpacks to a temp folder that is deleted on exit,
# so writable state has to live in the user profile when bundled.
if IS_FROZEN and (sys.stdout is None or sys.stderr is None):
    _null = open(os.devnull, "w", encoding="utf-8")
    sys.stdout = sys.stdout or _null
    sys.stderr = sys.stderr or _null


def _user_base_dir() -> Path:
    root = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
    return Path(root) / "co-jsu-desktop" if root else Path.home() / ".co-jsu-desktop"


def _portable_base_dir(exe_dir: Path) -> Optional[Path]:
    """Use the folder beside the exe when it looks like a portable copy.

    A portable folder ships an empty `data` directory, so its presence is the
    marker. Writable-ness is verified because the folder may sit on read-only
    media such as a CD or a locked network share.
    """
    data = exe_dir / "data"
    if not data.is_dir():
        return None
    try:
        probe = data / ".write-test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
    except OSError:
        return None
    return exe_dir


def _migrate_user_data(target: Path) -> None:
    """First portable run: carry over records saved by an installed copy."""
    source = _user_base_dir()
    if source.resolve() == target.resolve():
        return
    for name, pattern in (("data", "co_jsu_records.db"), ("logo", "logo.*")):
        dest_dir = target / name
        dest_dir.mkdir(parents=True, exist_ok=True)
        if any(dest_dir.iterdir()):
            continue
        src_dir = source / name
        if not src_dir.is_dir():
            continue
        for item in sorted(src_dir.glob(pattern)):
            if item.is_file():
                shutil.copy2(item, dest_dir / item.name)


# A PyInstaller one-file exe unpacks to a temp folder that is deleted on exit,
# so writable state cannot live next to the code. Prefer the portable folder
# when the app was shipped that way, otherwise use the user profile.
if IS_FROZEN:
    _exe_dir = Path(sys.executable).resolve().parent
    BASE_DIR = _portable_base_dir(_exe_dir) or _user_base_dir()
else:
    BASE_DIR = Path(__file__).resolve().parent

IS_PORTABLE = IS_FROZEN and BASE_DIR == Path(sys.executable).resolve().parent

DATA_DIR = BASE_DIR / "data"
LOGO_DIR = BASE_DIR / "logo"
DB_PATH = DATA_DIR / "co_jsu_records.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGO_DIR.mkdir(parents=True, exist_ok=True)
if IS_PORTABLE:
    _migrate_user_data(BASE_DIR)
ALLOWED_LOGO_EXTS = {".png", ".jpg", ".jpeg", ".svg", ".webp"}

PLO_CATALOG: Dict[str, str] = {
    "PLO1": "Apply knowledge of applied mathematics, applied science, computer and engineering fundamentals and an engineering specialisation as specified in DK1 to DK4 respectively to wide practical procedures and practices in area of mechanical engineering.",
    "PLO2": "Identify and analyse well-defined engineering problems reaching substantiated conclusions using codified methods of analysis specific to their field of activity (DK1 to DK4).",
    "PLO3": "Design solutions for well-defined technical problems and assist with the design of systems, components or processes to meet specified needs with appropriate consideration for public health and safety, cultural, societal, and environmental considerations (DK5).",
    "PLO4": "Conduct investigations of well-defined problems; locate and search relevant codes and catalogues, conduct standard tests and measurements (DK8).",
    "PLO5": "Apply appropriate techniques, resources, and modern engineering and IT tools to well-defined engineering problems, with an awareness of the limitations (DK6).",
    "PLO6": "Demonstrate knowledge of the societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to engineering technician practice and solutions to well-defined engineering problems (DK7).",
    "PLO7": "Understand and commit to professional ethics and responsibilities and norms of technician practice and including compliance with national and international laws. Demonstrate an understanding of the need for diversity and inclusion (DK9).",
    "PLO8": "Function effectively as an individual, and as a member in diverse technical teams.",
    "PLO9": "Communicate effectively on well-defined engineering activities with the engineering community and with society at large, by being able to comprehend the work of others, document their own work, and give and receive clear instructions.",
    "PLO10": "Demonstrate awareness and understanding of engineering management principles and economic decision-making and apply these to one's own work, as a member and leader in a technical team and to manage projects in multidisciplinary environments.",
    "PLO11": "Recognise the need for and have the ability for i) independent and lifelong learning and ii) critical thinking in the face of specialised technical knowledge (DK8).",
}

SLT_FIELDS = [
    "f2f_lect", "f2f_quiz", "f2f_test", "f2f_pres", "f2f_fe",
    "nf2f_indep", "nf2f_quiz", "nf2f_test", "nf2f_assg", "nf2f_case", "nf2f_pres", "nf2f_fe",
]

JSU_ASSESSMENT_DEFAULTS: Dict[str, Tuple[str, str, int, str]] = {
    "quiz": ("KUIZ", "SKEMA PEMARKAHAN", 20, "O"),
    "test": ("UJIAN", "SKEMA PEMARKAHAN", 30, "S"),
    "assignment": ("TUGASAN", "SKEMA PEMARKAHAN", 50, "P"),
    "case study": ("KAJIAN KES", "RUBRIK", 100, "P"),
    "presentation": ("PEMBENTANGAN", "RUBRIK", 100, "P"),
}

CANON_ASSESS = {
    "quiz": "quiz",
    "test": "test",
    "presentation": "presentation",
    "assignment": "assignment",
    "casestudy": "case study",
    "finalexamination": "final examination",
    "finalassessment": "final examination",
}


def fmt_num(val: float) -> str:
    rounded = round(float(val or 0.0), 2)
    return f"{rounded:g}"


def topic_slt_total(topic: Dict[str, Any]) -> float:
    return round(sum(float(topic.get(k, 0.0) or 0.0) for k in SLT_FIELDS), 2)


def compute_slt_totals(topics: List[Dict[str, Any]]) -> Dict[str, float]:
    totals = {k: 0.0 for k in SLT_FIELDS}
    for t in topics:
        for k in SLT_FIELDS:
            totals[k] += float(t.get(k, 0.0) or 0.0)
    for k in SLT_FIELDS:
        totals[k] = round(totals[k], 2)
    totals["grand_total"] = round(sum(totals[k] for k in SLT_FIELDS), 2)
    return totals


# ==============================================================================
# MODUL 1: UTILITI RUNTIME & HYBRID RAPIDOCR (ONNX)
# ==============================================================================
class RuntimeUtils:
    _rapidocr_engine: Any = None

    @classmethod
    def get_rapidocr_engine(cls) -> Any:
        if cls._rapidocr_engine is not None:
            return cls._rapidocr_engine
        for mod_name in ("rapidocr_onnxruntime", "rapidocr"):
            try:
                mod = __import__(mod_name, fromlist=["RapidOCR"])
                cls._rapidocr_engine = mod.RapidOCR()
                return cls._rapidocr_engine
            except ImportError:
                continue
        return None

    @classmethod
    def is_ocr_ready(cls) -> bool:
        try:
            import numpy  # noqa: F401
            import PIL  # noqa: F401
        except ImportError:
            return False
        return cls.get_rapidocr_engine() is not None

    @classmethod
    def run_rapidocr(cls, img_input: Any) -> List[Tuple[float, float, str]]:
        engine = cls.get_rapidocr_engine()
        if engine is None:
            return []
        raw_out = engine(img_input)
        entries = raw_out[0] if isinstance(raw_out, tuple) else raw_out
        if entries is None:
            return []

        words: List[Tuple[float, float, str]] = []
        if hasattr(entries, "boxes") and hasattr(entries, "txts"):
            for box, txt in zip(entries.boxes or [], entries.txts or []):
                t = str(txt or "").strip()
                if t:
                    xs = [float(pt[0]) for pt in box]
                    ys = [float(pt[1]) for pt in box]
                    words.append(((min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0, t))
            return words

        for item in entries:
            if item and len(item) >= 2:
                box, txt = item[0], str(item[1] or "").strip()
                if txt:
                    xs = [float(pt[0]) for pt in box]
                    ys = [float(pt[1]) for pt in box]
                    words.append(((min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0, txt))
        return words

    @staticmethod
    def find_logo_in_folder() -> Optional[Path]:
        for name in ("logo.png", "logo.jpg", "logo.jpeg", "logo.svg", "logo.webp"):
            p = LOGO_DIR / name
            if p.is_file():
                return p
        for p in sorted(LOGO_DIR.iterdir()):
            if p.is_file() and p.suffix.lower() in ALLOWED_LOGO_EXTS:
                return p
        return None

    @staticmethod
    def file_to_data_uri(file_path: Path) -> str:
        mime_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".webp": "image/webp",
        }
        mime = mime_map.get(file_path.suffix.lower(), "image/png")
        encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
        return f"data:{mime};base64,{encoded}"


# ==============================================================================
# MODUL 2: REPOSITORI SQLITE TEMPATAN
# ==============================================================================
class SQLiteRepository:
    @staticmethod
    def init_db() -> None:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS courses (
                    course_code TEXT PRIMARY KEY,
                    course_name TEXT NOT NULL,
                    credit_value INTEGER DEFAULT 3,
                    updated_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cqi_reports (
                    course_code TEXT PRIMARY KEY,
                    session TEXT DEFAULT '',
                    updated_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            conn.commit()

    @classmethod
    def save_course(cls, state: Dict[str, Any]) -> str:
        cls.init_db()
        code = (state.get("course_code") or "").strip().upper()
        if not code:
            code = f"KURSUS_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            state["course_code"] = code
        name = (state.get("course_name") or "TANPA NAMA KURSUS").strip().upper()
        credit = int(state.get("credit_value", 3) or 3)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload = json.dumps(state, ensure_ascii=False)

        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT INTO courses (course_code, course_name, credit_value, updated_at, payload_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(course_code) DO UPDATE SET
                    course_name = excluded.course_name,
                    credit_value = excluded.credit_value,
                    updated_at = excluded.updated_at,
                    payload_json = excluded.payload_json
                """,
                (code, name, credit, now_str, payload),
            )
            conn.commit()
        return code

    @classmethod
    def list_courses(cls) -> List[Dict[str, Any]]:
        cls.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute(
                "SELECT course_code, course_name, credit_value, updated_at FROM courses ORDER BY updated_at DESC"
            )
            return [
                {
                    "course_code": r[0],
                    "course_name": r[1],
                    "credit_value": r[2],
                    "updated_at": r[3],
                }
                for r in cur.fetchall()
            ]

    @classmethod
    def load_course(cls, course_code: str) -> Optional[Dict[str, Any]]:
        cls.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute("SELECT payload_json FROM courses WHERE course_code = ?", (course_code,))
            row = cur.fetchone()
            return json.loads(row[0]) if row and row[0] else None

    @classmethod
    def delete_course(cls, course_code: str) -> None:
        cls.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM courses WHERE course_code = ?", (course_code,))
            conn.commit()

    @classmethod
    def save_cqi(cls, bundle: Dict[str, Any]) -> str:
        cls.init_db()
        meta = bundle.get("meta") or {}
        code = (meta.get("code") or bundle.get("courseCode") or "").strip().upper()
        if not code:
            code = f"CQI_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        session = (meta.get("currSession") or bundle.get("session") or "").strip()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT INTO cqi_reports (course_code, session, updated_at, payload_json)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(course_code) DO UPDATE SET
                    session = excluded.session,
                    updated_at = excluded.updated_at,
                    payload_json = excluded.payload_json
                """,
                (code, session, now_str, json.dumps(bundle, ensure_ascii=False)),
            )
            conn.commit()
        return code

    @classmethod
    def list_cqi(cls) -> List[Dict[str, Any]]:
        cls.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute(
                "SELECT course_code, session, updated_at FROM cqi_reports ORDER BY updated_at DESC"
            )
            return [
                {"course_code": r[0], "session": r[1], "updated_at": r[2]} for r in cur.fetchall()
            ]

    @classmethod
    def load_cqi(cls, course_code: str) -> Optional[Dict[str, Any]]:
        cls.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute(
                "SELECT payload_json FROM cqi_reports WHERE course_code = ?",
                ((course_code or "").strip().upper(),),
            )
            row = cur.fetchone()
            return json.loads(row[0]) if row and row[0] else None

    @classmethod
    def delete_cqi(cls, course_code: str) -> None:
        cls.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "DELETE FROM cqi_reports WHERE course_code = ?",
                ((course_code or "").strip().upper(),),
            )
            conn.commit()

    @classmethod
    def save_settings(cls, settings: Dict[str, str]) -> None:
        cls.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            for k, v in settings.items():
                conn.execute(
                    """
                    INSERT INTO app_settings (key, value) VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                    """,
                    (k, str(v or "")),
                )
            conn.commit()

    @classmethod
    def get_settings(cls) -> Dict[str, str]:
        cls.init_db()
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute("SELECT key, value FROM app_settings")
            return {r[0]: r[1] for r in cur.fetchall()}


# ==============================================================================
# MODUL 3: PENGURUSAN STATE BERSEPADU & MODEL CETAKAN (PURE)
# ==============================================================================
class UnifiedStateStore:
    @staticmethod
    def create_empty_state(saved_defaults: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        defs = saved_defaults or {}
        return {
            "institution": defs.get("institution") or "POLITEKNIK MALAYSIA - KUCHING SARAWAK",
            "department": defs.get("department") or "DEPARTMENT OF MECHANICAL ENGINEERING",
            "doc_code": defs.get("doc_code") or "PLSP-04 (4) (26-02-26)",
            "course_name": "",
            "course_code": "",
            "synopsis": "",
            "semester_offered": "",
            "credit_value": 3,
            "prerequisite": "None",
            "clos": [],
            "clo_plo_mapping": [],
            "special_requirement": "",
            "other_additional_info": "",
            "ca_weight": 50,
            "fe_weight": 50,
            "assessments": [],
            "passing_notes": [
                "Continuous Assessment (CA) >= 40%",
                "Final Examination (FE) >= 20%",
            ],
            "topics": [],
            "main_references": [],
            "additional_references": [],
            "prepared_by": defs.get("prepared_by") or "",
            "prepared_date": "",
            "verified_by": defs.get("verified_by") or "",
            "verified_date": "",
            "extraction_notes": [],
            "jsu": {
                "programme_name": defs.get("programme_name") or "DIPLOMA KEJURUTERAAN MEKANIKAL",
                "head_of_programme": defs.get("head_of_programme") or "",
                "curriculum_version": "",
                "effective_session": defs.get("effective_session") or "SESI I: 2026/2027",
                "dp_statement": "DP1, DP2, DP3. (untuk program di bawah akreditasi ETAC) ** POLITEKNIK SAHAJA",
                "verified_role": "Ketua Program Diploma Kejuruteraan Mekanikal\nJawatankuasa Keselarasan / PRIP/SME",
                "rows": [],
            },
        }

    @classmethod
    def sync_jsu_from_co(cls, state: Dict[str, Any], force_rebuild: bool = False) -> None:
        jsu = state.setdefault("jsu", cls.create_empty_state()["jsu"])
        topics = state.get("topics", [])
        valid_codes = [t["code"] for t in topics]

        if not force_rebuild and jsu.get("rows"):
            for r in jsu["rows"]:
                r.setdefault("questions", [])
                tm = r.setdefault("topic_marks", {})
                for c in valid_codes:
                    tm.setdefault(c, 0.0)
                for ex in list(tm.keys()):
                    if ex not in valid_codes:
                        del tm[ex]
                r["checked_topics"] = [c for c in r.get("checked_topics", []) if c in valid_codes]
            return

        clos_by_code = {c["code"].upper(): c for c in state.get("clos", [])}
        topic_assess_lookup: Dict[str, List[str]] = {}
        for t in topics:
            am_text = (t.get("assessment_method") or "").lower()
            for key in JSU_ASSESSMENT_DEFAULTS:
                if key in am_text:
                    topic_assess_lookup.setdefault(key, []).append(t["code"])

        rows_out: List[Dict[str, Any]] = []
        for idx_a, a in enumerate(state.get("assessments", [])):
            raw_name = (a.get("name") or "").strip()
            key = raw_name.lower()
            if "final" in key:
                continue
            jsu_name, instrumen, _, item_type = JSU_ASSESSMENT_DEFAULTS.get(
                key, (raw_name.upper(), "SKEMA PEMARKAHAN", 50, "S")
            )
            raw_clos = [c.strip().upper() for c in (a.get("clo") or "CLO1").split(",") if c.strip()] or ["CLO1"]
            explicit_topics = [x.strip() for x in (a.get("topics") or "").split(",") if x.strip()]
            base_checked = [x if "." in x else f"{x}.0" for x in explicit_topics]
            if not base_checked:
                base_checked = list(topic_assess_lookup.get(key, []))
            if not base_checked and valid_codes:
                base_checked = [valid_codes[min(idx_a, len(valid_codes) - 1)]]

            per_clo_topics: Dict[str, List[str]] = a.get("clo_topics_map") or {}
            weight_share = round(float(a.get("percentage", 0) or 0) / len(raw_clos), 2)

            for clo_code in raw_clos:
                clo_info = clos_by_code.get(clo_code, {})
                plo_num = re.sub(r"[^0-9]", "", clo_info.get("plo", "PLO1")) or "1"
                dt_val = (clo_info.get("taxonomy") or "C3").upper()
                checked = list(per_clo_topics.get(clo_code) or base_checked)

                rows_out.append({
                    "clo": clo_code,
                    "clo_dp": "",
                    "plo": plo_num,
                    "dt": dt_val,
                    "vbe": "",
                    "sc": "",
                    "dp": "",
                    "dk": "",
                    "kaedah": jsu_name,
                    "instrumen": instrumen,
                    "checked_topics": checked,
                    "topic_marks": {c: 0.0 for c in valid_codes},
                    "questions": [],
                    "c1_items": 0, "c1_marks": 0,
                    "c2_items": 0, "c2_marks": 0,
                    "c3_items": 0, "c3_marks": 0,
                    "a3_items": 0, "a3_marks": 0,
                    "weight_pct": weight_share,
                    "item_type": item_type,
                })

        assess_order = {"KUIZ": 1, "UJIAN": 2, "TUGASAN": 3, "KAJIAN KES": 4, "PEMBENTANGAN": 5}
        rows_out.sort(key=lambda r: (r.get("clo", "CLO9"), assess_order.get(r.get("kaedah", ""), 99)))
        jsu["rows"] = rows_out


class PrintModelBuilder:
    """Membina model cetakan tulen (side-effect free) untuk Course Outline & JSU PB."""

    @staticmethod
    def build_co_print_model(state: Dict[str, Any]) -> Dict[str, Any]:
        topics = state.get("topics", [])
        totals = compute_slt_totals(topics)
        unique_plos: List[str] = []
        for clo in state.get("clos", []):
            p = (clo.get("plo") or "").strip().upper()
            if p and p not in unique_plos:
                unique_plos.append(p)
        return {
            "header": {
                "doc_code": state.get("doc_code", "PLSP-04 (4) (26-02-26)"),
                "institution": state.get("institution", ""),
                "department": state.get("department", ""),
            },
            "identity": {
                "course_name": state.get("course_name", ""),
                "course_code": state.get("course_code", ""),
                "synopsis": state.get("synopsis", ""),
                "credit_value": state.get("credit_value", 3),
                "prerequisite": state.get("prerequisite", "None"),
            },
            "clos": list(state.get("clos", [])),
            "plos": [{"code": p, "text": PLO_CATALOG.get(p, "")} for p in unique_plos],
            "assessments": list(state.get("assessments", [])),
            "weights": {"ca": state.get("ca_weight", 50), "fe": state.get("fe_weight", 50)},
            "passing_notes": list(state.get("passing_notes", [])),
            "weekly": [
                {
                    "code": t.get("code", ""),
                    "title": t.get("title", ""),
                    "narrative": t.get("narrative", ""),
                    "contact_desc": t.get("contact_desc", ""),
                    "assessment_lines": [x.strip() for x in (t.get("assessment_method") or "").splitlines() if x.strip()],
                    "week": t.get("week", ""),
                }
                for t in topics
            ],
            "slt": {
                "fields": SLT_FIELDS,
                "rows": [
                    {
                        "code": t.get("code", ""),
                        "values": [float(t.get(k, 0.0) or 0.0) for k in SLT_FIELDS],
                        "total": topic_slt_total(t),
                    }
                    for t in topics
                ],
                "totals": totals,
            },
            "references": {
                "main": list(state.get("main_references", [])),
                "additional": list(state.get("additional_references", [])),
            },
            "signatures": {
                "prepared_by": state.get("prepared_by", ""),
                "prepared_date": state.get("prepared_date", ""),
                "verified_by": state.get("verified_by", ""),
                "verified_date": state.get("verified_date", ""),
            },
        }

    @classmethod
    def build_jsu_print_model(cls, state: Dict[str, Any]) -> Dict[str, Any]:
        work = deepcopy(state)
        UnifiedStateStore.sync_jsu_from_co(work, force_rebuild=False)
        jsu = work["jsu"]
        topics = work.get("topics", [])
        rows = jsu.get("rows", [])

        visual: List[Dict[str, Any]] = []
        clo_totals: Dict[str, float] = {}
        for r in rows:
            qs = r.get("questions") or []
            rm = sum(float(r.get(k, 0) or 0) for k in ("c1_marks", "c2_marks", "c3_marks", "a3_marks"))
            ck = (r.get("clo") or "CLO1").upper()
            clo_totals[ck] = clo_totals.get(ck, 0.0) + rm

            if len(qs) > 1:
                for i, q in enumerate(qs):
                    dom = (q.get("domain") or "C3").upper()
                    n = int(q.get("items", 1) or 0)
                    m = float(q.get("marks", 0) or 0)
                    visual.append(cls._ve(r, i == 0, len(qs), rm, dom, n, m))
            else:
                visual.append(
                    cls._ve(
                        r, True, 1, rm, None,
                        int(r.get("c1_items", 0) or 0), float(r.get("c1_marks", 0) or 0),
                        int(r.get("c2_items", 0) or 0), float(r.get("c2_marks", 0) or 0),
                        int(r.get("c3_items", 0) or 0), float(r.get("c3_marks", 0) or 0),
                        int(r.get("a3_items", 0) or 0), float(r.get("a3_marks", 0) or 0),
                    )
                )

        clo_spans = cls._group_spans(visual, lambda e: (e["row"].get("clo") or "").upper())
        plo_spans = cls._group_spans(
            visual,
            lambda e: ((e["row"].get("clo") or "").upper(), str(e["row"].get("plo") or "")),
        )

        s_c1i = s_c2i = s_c3i = s_a3i = 0
        s_c1m = s_c2m = s_c3m = s_a3m = 0.0
        g_marks = g_weight = 0.0
        t_sums = [0.0] * len(topics)

        for ve in visual:
            s_c1i += ve["c1i"]; s_c1m += ve["c1m"]
            s_c2i += ve["c2i"]; s_c2m += ve["c2m"]
            s_c3i += ve["c3i"]; s_c3m += ve["c3m"]
            s_a3i += ve["a3i"]; s_a3m += ve["a3m"]
            if ve["is_first_in_assess"]:
                g_marks += ve["row_marks"]
                g_weight += float(ve["row"].get("weight_pct", 0) or 0)
                tm = ve["row"].get("topic_marks", {})
                for ti, t in enumerate(topics):
                    t_sums[ti] += float(tm.get(t["code"], 0.0) or 0.0)

        slts = [round(float(t.get("f2f_lect", 0) or 0) + float(t.get("nf2f_indep", 0) or 0), 1) for t in topics]
        tot_slt = sum(slts) or 1.0
        pcts = [round((s / tot_slt) * 100.0, 1) for s in slts]

        return {
            "meta": {
                "institution": (work.get("institution") or "POLITEKNIK KUCHING SARAWAK").replace("MALAYSIA - ", ""),
                "department": re.sub(r"^DEPARTMENT OF\s+", "", work.get("department") or "KEJURUTERAAN MEKANIKAL", flags=re.IGNORECASE).strip(),
                "programme": jsu.get("programme_name") or "DIPLOMA KEJURUTERAAN MEKANIKAL",
                "curriculum_version": jsu.get("curriculum_version") or "",
                "effective_session": jsu.get("effective_session") or "SESI I: 2026/2027",
                "head_of_programme": jsu.get("head_of_programme") or "",
                "verified_role": jsu.get("verified_role") or "",
                "course_code": work.get("course_code", ""),
                "course_code_name": f"{work.get('course_code', '')}/{work.get('course_name', '')}".strip("/"),
                "lecturer": work.get("prepared_by") or "",
                "ca_pct": work.get("ca_weight", 50),
                "fe_pct": work.get("fe_weight", 50),
                "dp_statement": jsu.get("dp_statement") or "",
            },
            "clos": [{"n": i, **c} for i, c in enumerate(work.get("clos", []), start=1)],
            "topics": [{"code": t["code"], "slt": s} for t, s in zip(topics, slts)],
            "topic_pcts": pcts,
            "entries": visual,
            "clo_spans": clo_spans,
            "plo_spans": plo_spans,
            "clo_totals": clo_totals,
            "topic_mark_totals": t_sums,
            "totals": {
                "c1i": s_c1i, "c1m": s_c1m, "c2i": s_c2i, "c2m": s_c2m,
                "c3i": s_c3i, "c3m": s_c3m, "a3i": s_a3i, "a3m": s_a3m,
                "grand_marks": g_marks, "grand_weight": g_weight,
            },
        }

    @staticmethod
    def _ve(r, first, span, row_marks, dom, n, m, c2i=0, c2m=0.0, c3i=0, c3m=0.0, a3i=0, a3m=0.0):
        if dom is None:
            c1i, c1m = n, m
        else:
            c1i, c1m = (n, m) if dom == "C1" else (0, 0.0)
            c2i, c2m = (n, m) if dom == "C2" else (0, 0.0)
            c3i, c3m = (n, m) if dom == "C3" else (0, 0.0)
            a3i, a3m = (n, m) if (dom == "A3" or dom.startswith("A")) else (0, 0.0)
        return {
            "row": r, "is_first_in_assess": first, "assess_span": span, "row_marks": row_marks,
            "c1i": c1i, "c1m": c1m, "c2i": c2i, "c2m": c2m,
            "c3i": c3i, "c3m": c3m, "a3i": a3i, "a3m": a3m,
        }

    @staticmethod
    def _group_spans(entries: List[Dict[str, Any]], key_fn: Any) -> List[int]:
        spans = [0] * len(entries)
        i = 0
        while i < len(entries):
            k = key_fn(entries[i])
            span = 1
            while i + span < len(entries) and key_fn(entries[i + span]) == k:
                span += 1
            spans[i] = span
            i += span
        return spans


# ==============================================================================
# MODUL 4: ENJIN RINGKASAN JADUAL PENGAJARAN (RULE-BASED & GEMINI API)
# ==============================================================================
class NarrativeGeneratorEngine:
    @staticmethod
    def fix_kerning(text: str) -> str:
        if not text:
            return ""
        fixed = re.sub(
            r"\b([A-Za-z]{3,})\s+(ING|TION|SION|MENT|NESS|ITY|ABLE|IBLE|ER|OR|ED|ES)\b",
            r"\1\2",
            text,
            flags=re.IGNORECASE,
        )
        return re.sub(r"\s+", " ", fixed).strip()

    @classmethod
    def synthesize_fast(cls, title: str, raw_subtopics: str) -> str:
        clean_title = cls.fix_kerning(re.sub(r"^\d+\.\d+\s*", "", (title or "").strip()))
        title_lower = clean_title.lower() if clean_title else "this subject area"
        lines = [ln.strip() for ln in (raw_subtopics or "").splitlines() if ln.strip() and not ln.rstrip().endswith(":")]
        leaf = [ln for ln in lines if re.match(r"^\d+(?:\s*\.\s*\d+){2,}", ln)]
        chosen = leaf if len(leaf) >= 2 else lines

        phrases: List[str] = []
        for ln in chosen:
            item = cls.fix_kerning(re.sub(r"^\d+(?:\s*\.\s*\d+)+\s*", "", ln).strip().rstrip("."))
            if item:
                first_w = item.split()[0]
                if not first_w.isupper():
                    item = item[0].lower() + item[1:]
                if item not in phrases:
                    phrases.append(item)

        if not phrases:
            return (
                f"This topic introduces the fundamental principles, equipment, and workshop practices "
                f"related to {title_lower}. Students learn the essential components, operating procedures, "
                f"and safety requirements involved in performing standard engineering tasks accurately."
            )

        def join_prose(items: List[str]) -> str:
            if len(items) == 1:
                return items[0]
            if len(items) == 2:
                return f"{items[0]} and {items[1]}"
            return ", ".join(items[:-1]) + f", and {items[-1]}"

        s1 = f"This topic introduces the fundamental principles, equipment, and practical applications of {title_lower}."
        s2 = f" Students learn key concepts and procedures covering {join_prose(phrases[:3])}."
        s3 = f" In addition, the topic covers {join_prose(phrases[3:6])}." if phrases[3:6] else ""
        s4 = (
            f" Overall, students develop the technical understanding and practical skills required to "
            f"carry out {title_lower} operations safely according to Standard Operating Procedures (SOP)."
        )
        return f"{s1}{s2}{s3}{s4}"

    @classmethod
    def synthesize_ai_sync(cls, title: str, raw_subtopics: str, api_key: str) -> str:
        if not api_key.strip():
            return cls.synthesize_fast(title, raw_subtopics)
        prompt = (
            "Write one concise, formal academic course outline paragraph (60-85 words) in English "
            "for a Malaysian Polytechnic engineering course outline (PLSP-04).\n"
            f"Topic Title: {title}\nSyllabus Subtopics:\n{raw_subtopics}\n"
            "Start with 'This topic introduces...' and summarize what students learn in smooth prose without bullet points."
        )
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key.strip()}"
        payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.4}}
        try:
            req = urllib.request.Request(
                url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST"
            )
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                cands = data.get("candidates", [])
                if cands and cands[0].get("content", {}).get("parts"):
                    out = cands[0]["content"]["parts"][0].get("text", "").strip()
                    if out:
                        return out
        except Exception:
            pass
        return cls.synthesize_fast(title, raw_subtopics)


# ==============================================================================
# MODUL 5: ENJIN PENGEKSTRAK PDF SILIBUS 13-ITEM (DIPERKUKUH)
# ==============================================================================
class SyllabusExtractorEngine:
    HEADER_FOOTER_RE = re.compile(
        r"^\s*(?:(?:NAMA\s+)+PENSYARAH\b|PKS/KURIKULUM|RESTRICTED\b|Version:\s*\d)",
        re.IGNORECASE,
    )

    @staticmethod
    def clean_pdf_cell(cell: Optional[str]) -> str:
        raw = (cell or "").strip()
        m = re.fullmatch(r"(\d+)\s*\n\s*\.", raw)
        if m:
            d = m.group(1)
            return f"{d[:-1] or '0'}.{d[-1]}"
        norm = re.sub(r"\s+", " ", raw).strip()
        norm = re.sub(r"\b(\d+)\s*\.\s*(\d+)\b", r"\1.\2", norm)
        m2 = re.fullmatch(r"(\d+)\s+\.", norm)
        if m2:
            d = m2.group(1)
            return f"{d[:-1] or '0'}.{d[-1]}"
        return norm

    @staticmethod
    def _normalize_topic_code(raw: str) -> Optional[str]:
        cleaned = (raw or "").strip().replace(",", ".")
        m = re.match(r"^([0-9lI|!]+)\s*\.\s*([0-9OoQDlI|!]+)(?!\d)", cleaned)
        if not m:
            return None
        major = re.sub(r"[lI|!]", "1", m.group(1))
        minor = re.sub(r"[lI|!]", "1", re.sub(r"[OoQD]", "0", m.group(2)))
        return f"{int(major)}.{int(minor)}" if major.isdigit() and minor.isdigit() else None

    @classmethod
    def extract_pdf(cls, pdf_bytes: bytes, defaults: Dict[str, str]) -> Dict[str, Any]:
        import pymupdf  # type: ignore

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        all_tables: List[List[List[str]]] = []
        pages_text: List[str] = []
        extras: Dict[str, Any] = {"notes": [], "sec13_coord_map": {}, "sec13_coord_clos": []}

        for page in doc:
            page_drawings = []
            try:
                page_drawings = page.get_drawings()
            except Exception:
                pass

            flat_up = page.get_text("text").upper().replace("\n", " ")
            if "PROPOSED TOPIC" in flat_up and "ASSESSMENT" in flat_up:
                try:
                    c_map, c_clos = cls._extract_sec13_by_coordinates(page, page_drawings)
                    if c_map:
                        extras["sec13_coord_map"] = c_map
                    if c_clos:
                        extras["sec13_coord_clos"] = c_clos
                except Exception:
                    pass

            try:
                for tab in page.find_tables().tables:
                    cleaned_rows = []
                    for r_idx, r in enumerate(tab.extract()):
                        cells = [cls.clean_pdf_cell(c) for c in r]
                        if any(cells):
                            cleaned_rows.append(cells)
                    if cleaned_rows:
                        all_tables.append(cleaned_rows)
            except Exception:
                pass

            words = page.get_text("words")
            if not words:
                pages_text.append(page.get_text("text"))
                continue
            words.sort(key=lambda w: (round(w[1] / 4.0), w[0]))
            rows: List[List[Tuple[float, str]]] = []
            cur_y: Optional[float] = None
            for w in words:
                x0, y0, _, _, text = w[:5]
                if cur_y is None or abs(y0 - cur_y) > 4.5:
                    rows.append([(x0, text)])
                    cur_y = y0
                else:
                    rows[-1].append((x0, text))
            page_lines = []
            for r in rows:
                ln_str = " ".join(t for _, t in sorted(r, key=lambda item: item[0]))
                ln_str = re.sub(r"\b(\d+)\s*\.\s*(\d+)\b", r"\1.\2", ln_str)
                ln_str = re.sub(r"\b0(\d)\s+\.", r"0.\1", ln_str)
                page_lines.append(ln_str)
            pages_text.append("\n".join(page_lines))

        return cls.parse_to_state(all_tables, "\n".join(pages_text), defaults, extras)

    @staticmethod
    def _extract_sec13_by_coordinates(page: Any, page_drawings: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[Dict[str, str]]]:
        words = page.get_text("words")
        if not words:
            return {}, []
        disp = {
            "quiz": "Quiz", "test": "Test", "presentation": "Presentation",
            "assignment": "Assignment", "case study": "Case Study", "final examination": "Final Examination",
        }
        col_anchors: List[Tuple[float, str]] = []
        y_header: Optional[float] = None
        for w in words:
            txt_up = w[4].strip().upper()
            xc, yc = (w[0] + w[2]) / 2.0, (w[1] + w[3]) / 2.0
            if txt_up in {"PLO", "DT", "SLT"}:
                col_anchors.append((xc, txt_up.lower()))
            elif txt_up in {"QUIZ", "TEST", "PRESENTATION", "ASSIGNMENT"}:
                col_anchors.append((xc, txt_up.lower()))
                y_header = yc
            elif txt_up == "CASE":
                nxt = next((w2 for w2 in words if w2[4].strip().upper() == "STUDY" and abs(((w2[1]+w2[3])/2) - yc) < 8 and w2[0] > w[0]), None)
                if nxt:
                    col_anchors.append(((w[0] + nxt[2]) / 2.0, "case study"))
                    y_header = yc
            elif txt_up == "FINAL":
                nxt = next((w2 for w2 in words if w2[4].strip().upper() == "EXAMINATION" and abs(((w2[1]+w2[3])/2) - yc) < 12 and abs(w2[0] - w[0]) < 45), None)
                if nxt:
                    col_anchors.append(((min(w[0], nxt[0]) + max(w[2], nxt[2])) / 2.0, "final examination"))
                    y_header = yc
            elif txt_up == "PROPOSED":
                nxt = next((w2 for w2 in words if w2[4].strip().upper() == "TOPIC" and abs(((w2[1]+w2[3])/2) - yc) < 8 and w2[0] > w[0]), None)
                if nxt:
                    col_anchors.append(((w[0] + nxt[2]) / 2.0, "topic"))

        if y_header is None:
            return {}, []

        dedup_cols: List[Tuple[float, str]] = []
        for x, name in sorted(col_anchors, key=lambda it: it[0]):
            if not any(n == name for _, n in dedup_cols):
                dedup_cols.append((x, name))
        if sum(1 for _, n in dedup_cols if n in disp) < 3:
            return {}, []

        col_ranges: Dict[str, Tuple[float, float]] = {}
        for i, (xc, name) in enumerate(dedup_cols):
            left_b = (dedup_cols[i - 1][0] + xc) / 2.0 if i > 0 else (xc - 25.0)
            right_b = (xc + dedup_cols[i + 1][0]) / 2.0 if i + 1 < len(dedup_cols) else (xc + 55.0)
            col_ranges[name] = (left_b, right_b)

        header_meta: Dict[str, Tuple[int, int]] = {}
        sub_words = [w for w in words if (y_header + 4.0) <= ((w[1] + w[3]) / 2.0) <= (y_header + 34.0)]
        for cname in disp:
            if cname in col_ranges:
                xa, xb = col_ranges[cname]
                cell_txt = " ".join(w[4] for w in sorted(sub_words, key=lambda it: it[0]) if xa <= ((w[0] + w[2]) / 2.0) <= xb)
                m_q = re.search(r"\((\d+)\)", cell_txt)
                m_p = re.search(r"(\d{1,3})\s*%", cell_txt)
                header_meta[cname] = (int(m_q.group(1)) if m_q else 1, int(m_p.group(1)) if m_p else 0)

        y_start = y_header + 22.0
        tot_w = next((w for w in words if w[4].strip().upper() == "TOTAL" and ((w[1] + w[3]) / 2.0) > y_start), None)
        y_end = tot_w[1] if tot_w else 9999.0

        plo_left = col_ranges["plo"][0] if "plo" in col_ranges else 240.0
        clo_words = sorted(
            [w for w in words if re.fullmatch(r"CLO\d", w[4].strip(), re.IGNORECASE) and y_start <= ((w[1] + w[3]) / 2.0) < y_end and w[0] < plo_left],
            key=lambda w: w[1],
        )
        if not clo_words:
            return {}, []

        clo_bands: List[Tuple[float, float, str]] = []
        sec13_clos: List[Dict[str, str]] = []
        for idx, cw in enumerate(clo_words):
            c_code = cw[4].strip().upper()
            y_top = cw[1] - 14.0
            y_bot = (clo_words[idx + 1][1] - 14.0) if idx + 1 < len(clo_words) else y_end
            clo_bands.append((y_top, y_bot, c_code))

            plo_val = "1"
            if "plo" in col_ranges:
                pa, pb = col_ranges["plo"]
                p_ws = [w[4] for w in words if y_top <= ((w[1] + w[3]) / 2.0) < y_bot and pa <= ((w[0] + w[2]) / 2.0) <= pb and w[4].strip().isdigit()]
                if p_ws:
                    plo_val = p_ws[0].strip()

            dt_val = "C3"
            if "dt" in col_ranges:
                da, db = col_ranges["dt"]
                d_ws = [w[4].strip().upper() for w in words if y_top <= ((w[1] + w[3]) / 2.0) < y_bot and da <= ((w[0] + w[2]) / 2.0) <= db and re.fullmatch(r"[CPA]\d", w[4].strip(), re.IGNORECASE)]
                if d_ws:
                    dt_val = d_ws[0]

            stmt_ws = sorted(
                [w for w in words if y_top <= ((w[1] + w[3]) / 2.0) < y_bot and (cw[2] - 1.0) <= w[0] < (plo_left - 2.0)],
                key=lambda w: (round(w[1] / 4.0), w[0]),
            )
            stmt_txt = re.sub(r"^[:\s]+", "", re.sub(r"\s+", " ", " ".join(w[4] for w in stmt_ws))).strip()
            sec13_clos.append({
                "code": c_code,
                "statement": (stmt_txt[0].upper() + stmt_txt[1:]) if stmt_txt else "",
                "taxonomy": dt_val,
                "plo": f"PLO{plo_val}",
            })

        def clo_for_y(yc: float) -> str:
            for yt, yb, cc in clo_bands:
                if yt <= yc < yb:
                    return cc
            return clo_bands[0][2]

        topic_rows: List[Tuple[float, str, List[str]]] = []
        if "topic" in col_ranges:
            ta, tb = col_ranges["topic"]
            t_words = sorted(
                [w for w in words if y_start <= ((w[1] + w[3]) / 2.0) < y_end and ta <= ((w[0] + w[2]) / 2.0) <= tb],
                key=lambda w: (round(w[1] / 5.0), w[0]),
            )
            grouped: List[List[Any]] = []
            for w in t_words:
                yc = (w[1] + w[3]) / 2.0
                if grouped and abs(yc - grouped[-1][0]) <= 6.0:
                    grouped[-1][1].append(w[4])
                else:
                    grouped.append([yc, [w[4]]])
            for yc, w_list in grouped:
                t_codes: List[str] = []
                for a, b in re.findall(r"T\s*(\d+)(?:\s*[-\u2013]\s*T?\s*(\d+))?", " ".join(w_list), re.IGNORECASE):
                    lo, hi = int(a), int(b) if b else int(a)
                    for n in range(min(lo, hi), max(lo, hi) + 1):
                        if f"{n}.0" not in t_codes:
                            t_codes.append(f"{n}.0")
                if t_codes:
                    topic_rows.append((yc, clo_for_y(yc), t_codes))

        if not topic_rows:
            return {}, sec13_clos

        bullets: List[Tuple[float, float]] = []
        for w in words:
            yc = (w[1] + w[3]) / 2.0
            if y_start <= yc < y_end and re.fullmatch(r"[\u25cf\u2022\u25cb\u25e6\uf0b7\uf0a7▪■●•]", w[4].strip()):
                bullets.append(((w[0] + w[2]) / 2.0, yc))
        for drw in page_drawings:
            rect = drw.get("rect")
            if rect and (2.0 <= rect.width <= 10.5) and (2.0 <= rect.height <= 10.5) and abs(rect.width - rect.height) <= 2.5:
                cy = (rect.y0 + rect.y1) / 2.0
                if y_start <= cy < y_end:
                    bullets.append(((rect.x0 + rect.x1) / 2.0, cy))

        mapping: Dict[str, Any] = {}
        for bx, by in bullets:
            cname = next((cn for cn in disp if cn in col_ranges and col_ranges[cn][0] <= bx <= col_ranges[cn][1]), None)
            if not cname:
                continue
            nearest = min(topic_rows, key=lambda tr: abs(tr[0] - by))
            if abs(nearest[0] - by) > 18.0:
                continue
            _, row_clo, row_topics = nearest
            dname = disp[cname]
            qty_v, pct_v = header_meta.get(cname, (1, 0))
            entry = mapping.setdefault(dname, {
                "category": "FE" if cname == "final examination" else "CA",
                "name": dname, "quantity": qty_v, "percentage": pct_v,
                "clos": [], "topics": [], "clo_topics_map": {},
            })
            if row_clo not in entry["clos"]:
                entry["clos"].append(row_clo)
            c_list = entry["clo_topics_map"].setdefault(row_clo, [])
            for tc in row_topics:
                if tc not in entry["topics"]:
                    entry["topics"].append(tc)
                if tc not in c_list:
                    c_list.append(tc)
        return mapping, sec13_clos

    @classmethod
    def parse_to_state(
        cls,
        tables: List[List[List[str]]],
        raw_text: str,
        defaults: Dict[str, str],
        extras: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        data = UnifiedStateStore.create_empty_state(defaults)
        data["extraction_notes"] = list((extras or {}).get("notes", []))

        m_lec = re.search(r"NAMA PENSYARAH\s*:?\s*([A-Z][A-Z \.'/@\-]+)", raw_text)
        if m_lec:
            data["prepared_by"] = re.sub(r"\s+", " ", m_lec.group(1)).strip()

        m_ver = re.search(r"Version\s*:?\s*([^\n\r]+)", raw_text, re.IGNORECASE)
        if m_ver:
            ver_str = re.sub(r"\s+", " ", m_ver.group(1)).strip()
            data["jsu"]["curriculum_version"] = ver_str
            m_ses = re.search(r"(Session\s+[IVX]+\s*\d{4}/\d{4})", ver_str, re.IGNORECASE)
            if m_ses:
                data["jsu"]["effective_session"] = m_ses.group(1).upper()

        lines = [
            re.sub(r"\s+", " ", ln).strip()
            for ln in (raw_text or "").splitlines()
            if ln.strip() and not cls.HEADER_FOOTER_RE.match(ln)
        ]
        full_text = "\n".join(lines)

        m_name = re.search(r"NAME OF COURSE\s*:?\s*([A-Z][A-Z0-9 &/\-\(\),]+)", full_text)
        if m_name and "COURSE CODE" not in m_name.group(1):
            data["course_name"] = m_name.group(1).splitlines()[0].strip()

        m_code = re.search(r"COURSE CODE\s*:?\s*([A-Z]{2,5}\s*\d{4,6})", full_text)
        if m_code:
            data["course_code"] = m_code.group(1).replace(" ", "")

        m_syn = re.search(r"SYNOPSIS\s*:?\s*(.*?)(?=\n\s*(?:3\b|SEMESTER|CREDIT VALUE|PRE-?REQUISITE))", full_text, re.DOTALL | re.IGNORECASE)
        if m_syn and len(m_syn.group(1).strip()) > 15:
            data["synopsis"] = re.sub(r"\s+", " ", m_syn.group(1)).strip()

        m_cred = re.search(r"CREDIT VALUE\s*:?\s*(\d+)", full_text, re.IGNORECASE)
        if m_cred and int(m_cred.group(1)) <= 20:
            data["credit_value"] = int(m_cred.group(1))

        m_pre = re.search(r"PRE-?REQUISITE[^:\n]*:\s*(\S[^\n]*)", full_text, re.IGNORECASE)
        if m_pre:
            data["prerequisite"] = m_pre.group(1).strip()

        m_spec = re.search(r"9\s+SPECIAL REQUIREMENT\s*:?(.*?)(?=\n\s*(?:10\b|REFERENCES))", full_text, re.DOTALL | re.IGNORECASE)
        if m_spec:
            data["special_requirement"] = re.sub(r"\s+", " ", m_spec.group(1)).strip()

        m_other = re.search(r"11\s+OTHER ADDITIONAL INFORMATION\s*:?(.*?)(?=\n\s*(?:12\b|COURSE SYLLABUS))", full_text, re.DOTALL | re.IGNORECASE)
        if m_other:
            data["other_additional_info"] = re.sub(r"\s+", " ", m_other.group(1)).strip()

        # CLO (Seksyen 6 + Seksyen 13)
        sec13_map = (extras or {}).get("sec13_coord_map") or {}
        sec13_clos = (extras or {}).get("sec13_coord_clos") or []
        clos_found: List[Dict[str, str]] = []
        m_sec6 = re.search(r"COURSE LEARNING OUTCOMES\s*\(CLO\)\s*:?(.*?)(?=MAPPING OF THE COURSE LEARNING OUTCOMES)", full_text, re.DOTALL | re.IGNORECASE)
        if m_sec6:
            tag_re = r"[\(\[]\s*([CPA]\d)\s*,\s*(PLO\s*\d+)[^\)\]]*[\)\]]"
            for chunk in re.split(r"(?=\bCLO\d\b)", m_sec6.group(1)):
                mc = re.match(r"\s*(CLO\d)\b", chunk, re.IGNORECASE)
                if not mc:
                    continue
                c_code = mc.group(1).upper()
                if any(x["code"] == c_code for x in clos_found):
                    continue
                mt = re.search(tag_re, chunk, re.IGNORECASE)
                stmt = re.sub(r"\s+", " ", re.sub(r"^\s*CLO\d\s*:?", "", re.sub(tag_re, " ", chunk, flags=re.IGNORECASE), flags=re.IGNORECASE)).strip()
                if stmt or mt:
                    clos_found.append({
                        "code": c_code,
                        "statement": (stmt[0].upper() + stmt[1:]) if stmt else "",
                        "taxonomy": mt.group(1).upper() if mt else "C3",
                        "plo": re.sub(r"\s+", "", mt.group(2).upper()) if mt else "PLO1",
                    })
        if sec13_clos:
            for sc in sec13_clos:
                ex = next((c for c in clos_found if c["code"] == sc["code"]), None)
                if not ex:
                    clos_found.append(sc)
                else:
                    if sc.get("taxonomy"):
                        ex["taxonomy"] = sc["taxonomy"]
                    if sc.get("plo"):
                        ex["plo"] = sc["plo"]
            clos_found.sort(key=lambda c: c["code"])
        data["clos"] = clos_found

        # Seksyen 8: Penilaian & Jam SLT
        topic_slt_map: Dict[str, Dict[str, Any]] = {}
        assess_slt: Dict[str, Tuple[float, float]] = {}
        extracted_assessments: List[Dict[str, Any]] = []

        for tab in tables:
            all_up = " ".join(" ".join(r) for r in tab).upper()
            tab_ns = re.sub(r"\s+", "", all_up)
            if ("COURSE CONTENT OUTLINE" in all_up or "STUDENT LEARNING TIME" in all_up) and "SLT" in all_up:
                cur_tc: Optional[str] = None
                for row in tab:
                    ne = [c for c in row if c]
                    if not ne:
                        continue
                    nc0 = cls._normalize_topic_code(ne[0])
                    if nc0 and nc0.endswith(".0"):
                        cur_tc = nc0
                        topic_slt_map.setdefault(cur_tc, {"title": "", "lect": 0.0, "indep": 0.0})
                        continue
                    if nc0 and not nc0.endswith(".0"):
                        cur_tc = f"{nc0.split('.')[0]}.0"
                        topic_slt_map.setdefault(cur_tc, {"title": "", "lect": 0.0, "indep": 0.0})
                    if cur_tc and any(re.fullmatch(r"CLO\d", c, re.IGNORECASE) for c in ne):
                        ci = next(i for i, c in enumerate(row) if re.fullmatch(r"CLO\d", c, re.IGNORECASE))
                        nums = [float(c) for c in row[ci + 1:] if re.fullmatch(r"\d+(?:\.\d+)?", c)]
                        if len(nums) >= 5:
                            topic_slt_map[cur_tc]["lect"] += sum(nums[:4])
                            topic_slt_map[cur_tc]["indep"] += nums[4]

            if ("CONTINUOUSASSESSMENT" in tab_ns or "FINALASSESSMENT" in tab_ns) and "ASSESSMENTTIME" in tab_ns:
                disp = {"quiz": "Quiz", "test": "Test", "presentation": "Presentation", "assignment": "Assignment", "case study": "Case Study", "final examination": "Final Examination"}
                for row in tab:
                    ne = [c for c in row if c]
                    if len(ne) >= 2:
                        canon = CANON_ASSESS.get(re.sub(r"[^a-z]", "", ne[0].lower()))
                        if not canon:
                            continue
                        nums = [float(x) for x in ne[1:] if re.fullmatch(r"\d+(?:\.\d+)?", x)]
                        if nums and 0 < int(round(nums[0])) <= 100:
                            pct = int(round(nums[0]))
                            f2f_v = nums[1] if len(nums) >= 2 else 0.0
                            nf2f_v = nums[2] if len(nums) >= 3 else 0.0
                            assess_slt[canon] = (f2f_v, nf2f_v)
                            if canon == "final examination":
                                data["fe_weight"] = pct
                            elif not any(x["name"].lower() == canon for x in extracted_assessments):
                                extracted_assessments.append({"name": disp[canon], "quantity": 1, "percentage": pct, "clo": "CLO1", "topics": ""})

        for a_name in ["Quiz", "Test", "Presentation", "Assignment", "Case Study", "Final Examination"]:
            if a_name.lower() != "final examination" and any(x["name"].lower() == a_name.lower() for x in extracted_assessments):
                continue
            mr = re.search(rf"\b{re.escape(a_name)}\b\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)", full_text, re.IGNORECASE)
            if mr:
                pct, f2f_v, nf2f_v, slt_v = int(round(float(mr.group(1)))), float(mr.group(2)), float(mr.group(3)), float(mr.group(4))
                if abs((f2f_v + nf2f_v) - slt_v) < 0.05 and 0 < pct <= 100:
                    assess_slt[a_name.lower()] = (f2f_v, nf2f_v)
                    if a_name.lower() == "final examination":
                        data["fe_weight"] = pct
                    else:
                        extracted_assessments.append({"name": a_name, "quantity": 1, "percentage": pct, "clo": "CLO1", "topics": ""})

        for s_name, s_info in sec13_map.items():
            if s_info["category"] == "FE":
                if s_info["percentage"] > 0:
                    data["fe_weight"] = s_info["percentage"]
                continue
            ex = next((x for x in extracted_assessments if x["name"].lower() == s_name.lower()), None)
            if not ex:
                extracted_assessments.append({
                    "name": s_name, "quantity": s_info["quantity"], "percentage": s_info["percentage"],
                    "clo": ", ".join(s_info["clos"]) or "CLO1", "topics": ", ".join(s_info["topics"]),
                    "clo_topics_map": s_info.get("clo_topics_map", {}),
                })
            else:
                ex["quantity"] = s_info["quantity"]
                if s_info["percentage"] > 0:
                    ex["percentage"] = s_info["percentage"]
                ex["clo"] = ", ".join(s_info["clos"]) or ex["clo"]
                ex["topics"] = ", ".join(s_info["topics"])
                ex["clo_topics_map"] = s_info.get("clo_topics_map", {})

        ca_order = {"quiz": 1, "test": 2, "presentation": 3, "assignment": 4, "case study": 5}
        extracted_assessments.sort(key=lambda x: ca_order.get(x["name"].lower(), 99))
        if extracted_assessments:
            data["assessments"] = extracted_assessments
            data["ca_weight"] = sum(int(x["percentage"]) for x in extracted_assessments)

        # Seksyen 12: Sumber Rasmi Tajuk & Subtopik
        sec12_m = re.search(r"12\s+COURSE SYLLABUS\s*:?(.*?)(?=\n\s*(?:13\s+ASSESSMENT|Suggested sequence)|\Z)", full_text, re.DOTALL | re.IGNORECASE)
        sub_map: Dict[str, List[str]] = {}
        title_map: Dict[str, str] = {}
        cur_c: Optional[str] = None
        for ln in (sec12_m.group(1) if sec12_m else "").splitlines():
            lc = ln.strip()
            if not lc:
                continue
            nc = cls._normalize_topic_code(lc)
            if nc and nc.endswith(".0"):
                rest = re.sub(r"^[0-9lI|!]+\s*[.,]\s*[0-9OoQDlI|!]+\s*", "", lc).strip()
                sub_map.setdefault(nc, [])
                title_map[nc] = NarrativeGeneratorEngine.fix_kerning(rest.upper())
                cur_c = nc
            elif cur_c:
                sub_map[cur_c].append(NarrativeGeneratorEngine.fix_kerning(lc))

        for c12, t12 in title_map.items():
            topic_slt_map.setdefault(c12, {"title": t12, "lect": 0.0, "indep": 0.0})
            if t12:
                topic_slt_map[c12]["title"] = t12

        # Agih baki SLT pengajaran jika ada topik 0 jam
        zero_codes = [c for c, v in topic_slt_map.items() if (v["lect"] + v["indep"]) <= 0.0]
        if zero_codes:
            target_slt = max(1, int(data.get("credit_value", 3) or 3)) * 40
            total_assess = sum(f2f + nf2f for f2f, nf2f in assess_slt.values())
            already = sum(v["lect"] + v["indep"] for v in topic_slt_map.values())
            rem_half = max(0.0, round((target_slt - total_assess - already) / 2.0, 2))
            sz = sorted(zero_codes, key=lambda x: float(x))
            ws = [max(1, len(sub_map.get(c, []))) for c in sz]
            tw = sum(ws) or 1
            alloc = [max(0.5, round(((w / tw) * rem_half) * 2.0) / 2.0) for w in ws]
            if alloc and rem_half > 0:
                alloc[-1] = max(0.5, round(alloc[-1] + (rem_half - sum(alloc)), 2))
            for iz, c in enumerate(sz):
                topic_slt_map[c]["lect"] = alloc[iz]
                topic_slt_map[c]["indep"] = alloc[iz]

        if topic_slt_map:
            scodes = sorted(topic_slt_map.keys(), key=lambda x: float(x))
            tot_lect = sum(v["lect"] for v in topic_slt_map.values()) or 1.0
            cur_week = 1
            alook = {a["name"].lower(): a for a in data.get("assessments", [])}

            def mapped_for(name: str, fb: List[str]) -> Tuple[str, List[str]]:
                obj = alook.get(name)
                if not obj:
                    return ("CLO1", fb)
                tl = [x.strip() for x in (obj.get("topics") or "").split(",") if x.strip()]
                return (obj.get("clo", "CLO1"), tl or fb)

            q_clo, q_top = mapped_for("quiz", [scodes[0]])
            t_clo, t_top = mapped_for("test", [scodes[min(1, len(scodes) - 1)]])
            a_clo, a_top = mapped_for("assignment", [scodes[min(2, len(scodes) - 1)]])
            c_clo, c_top = mapped_for("case study", [scodes[-1]])
            p_clo, p_top = mapped_for("presentation", [scodes[-1]])
            fe_top = [scodes[len(scodes) // 2]]

            new_topics: List[Dict[str, Any]] = []
            for code in scodes:
                info = topic_slt_map[code]
                lh, ih = round(info["lect"], 2), round(info["indep"], 2)
                raw_sub = "\n".join(sub_map.get(code, []))
                span = max(1, round((lh / tot_lect) * 14))
                end_w = min(14, cur_week + span - 1)
                w_str = f"M{cur_week}" if cur_week == end_w else f"M{cur_week}-M{end_w}"
                cur_week = min(14, end_w + 1)

                methods: List[str] = []
                for nm, clo_l, tops in [
                    ("quiz", q_clo, q_top), ("test", t_clo, t_top), ("assignment", a_clo, a_top),
                    ("case study", c_clo, c_top), ("presentation", p_clo, p_top),
                ]:
                    if nm in assess_slt and code in tops:
                        methods.append(f"{nm.title()} ({clo_l})")

                new_topics.append({
                    "code": code, "title": info["title"], "raw_subtopics": raw_sub,
                    "narrative": NarrativeGeneratorEngine.synthesize_fast(info["title"], raw_sub),
                    "contact_desc": f"{fmt_num(lh)} hours lecture", "assessment_method": "\n".join(methods), "week": w_str,
                    "f2f_lect": lh,
                    "f2f_quiz": round(assess_slt["quiz"][0] / len(q_top), 2) if ("quiz" in assess_slt and code in q_top) else 0.0,
                    "f2f_test": round(assess_slt["test"][0] / len(t_top), 2) if ("test" in assess_slt and code in t_top) else 0.0,
                    "f2f_pres": round(assess_slt["presentation"][0] / len(p_top), 2) if ("presentation" in assess_slt and code in p_top) else 0.0,
                    "f2f_fe": round(assess_slt["final examination"][0] / len(fe_top), 2) if ("final examination" in assess_slt and code in fe_top) else 0.0,
                    "nf2f_indep": ih,
                    "nf2f_quiz": round(assess_slt["quiz"][1] / len(q_top), 2) if ("quiz" in assess_slt and code in q_top) else 0.0,
                    "nf2f_test": round(assess_slt["test"][1] / len(t_top), 2) if ("test" in assess_slt and code in t_top) else 0.0,
                    "nf2f_assg": round(assess_slt["assignment"][1] / len(a_top), 2) if ("assignment" in assess_slt and code in a_top) else 0.0,
                    "nf2f_case": round(assess_slt["case study"][1] / len(c_top), 2) if ("case study" in assess_slt and code in c_top) else 0.0,
                    "nf2f_pres": round(assess_slt["presentation"][1] / len(p_top), 2) if ("presentation" in assess_slt and code in p_top) else 0.0,
                    "nf2f_fe": round(assess_slt["final examination"][1] / len(fe_top), 2) if ("final examination" in assess_slt and code in fe_top) else 0.0,
                })
            data["topics"] = new_topics

        m_ref = re.search(r"10\s+REFERENCES\s*:?(.*?)(?=\n\s*(?:11\b|OTHER ADDITIONAL INFORMATION))", full_text, re.DOTALL | re.IGNORECASE)
        if m_ref:
            parts = re.split(r"Additional References", m_ref.group(1), flags=re.IGNORECASE)
            main_l = [ln.strip() for ln in parts[0].splitlines() if ln.strip() and "main reference" not in ln.lower()]
            if main_l:
                data["main_references"] = [" ".join(main_l)]
            if len(parts) > 1:
                add_l = [ln.strip() for ln in parts[1].splitlines() if ln.strip()]
                if add_l:
                    data["additional_references"] = add_l

        UnifiedStateStore.sync_jsu_from_co(data, force_rebuild=True)
        return data


# ==============================================================================
# MODUL 5B: EKSTRAK PBCLOGSA (MARKAH) & CORR PANITIA -> LAPORAN CQI
# ==============================================================================
class CqiExtractorEngine:
    """Coordinate-aware readers for the two PKS source documents.

    Both PDFs are printed tables, so values are read by column geometry instead
    of text order: a value is assigned to the column whose header sits nearest
    horizontally. That keeps names/CLO/CA/FE correct even when a student row
    wraps onto a second line or a section spills onto the next page.
    """

    METRIC_RE = re.compile(r"^(\d{2})([A-Z]{3})(\d{2})([A-Z])(\d{3,5})$")
    CLO_HDR_RE = re.compile(r"^CLO\d{4}[A-Z]?$")
    PLO_HDR_RE = re.compile(r"^PLO\d{4}$")
    CLASS_RE = re.compile(r"^[A-Z]{3}\d[A-Z]$")
    GRADE_RE = re.compile(r"^(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D|E|F)$")
    NUM_RE = re.compile(r"^-?\d+(?:\.\d+)?$")
    BLOCK_PATTERNS = [
        # "SESSION II : 2025/2026" has no colon after the label.
        ("session", re.compile(r"^SESSION\s*:?\s*(.+)$", re.I)),
        ("jabatan", re.compile(r"^JABATAN\s*:?\s*(.+)$", re.I)),
        # The stacked table header also contains "PROGRAMME LEARNING" and
        # "COURSE ..." fragments, so these three require the colon.
        ("code", re.compile(r"^COURSE\s*CODEs?\s*:\s*(\S+)\s*$", re.I)),
        ("name", re.compile(r"^COURSE\s*NAME\s*:?\s*(.+)$", re.I)),
        ("programme", re.compile(r"^PROGRAMME\s*:\s*(\S+)\s*$", re.I)),
        ("section", re.compile(r"^SECTION\s*:\s*(\S+)\s*$", re.I)),
        ("lecture", re.compile(r"^LECTURE[R]?\s*:?\s*(.+)$", re.I)),
    ]

    # -- small helpers -----------------------------------------------------
    @staticmethod
    def _words(page: Any) -> List[Dict[str, Any]]:
        return [
            {"x0": w[0], "y0": w[1], "x1": w[2], "y1": w[3], "text": w[4], "cx": (w[0] + w[2]) / 2}
            for w in page.get_text("words")
        ]

    @staticmethod
    def _rows(words: List[Dict[str, Any]], tol: float = 1.6) -> List[List[Dict[str, Any]]]:
        rows: List[List[Dict[str, Any]]] = []
        for w in sorted(words, key=lambda w: (w["y0"], w["x0"])):
            if rows and abs(w["y0"] - rows[-1][0]["y0"]) <= tol:
                rows[-1].append(w)
            else:
                rows.append([w])
        for r in rows:
            r.sort(key=lambda w: w["x0"])
        return rows

    @classmethod
    def _num(cls, txt: str) -> Optional[float]:
        t = txt.replace(",", ".").strip()
        return float(t) if cls.NUM_RE.match(t) else None

    @classmethod
    def _parse_block(cls, lines: List[str]) -> Dict[str, str]:
        out: Dict[str, str] = {}
        for line in lines:
            clean = re.sub(r"\s+", " ", line).strip()
            for key, pattern in cls.BLOCK_PATTERNS:
                m = pattern.match(clean)
                if m:
                    out[key] = m.group(1).strip().lstrip(":").strip()
                    break
        return out

    @classmethod
    def classify(cls, pdf_bytes: bytes) -> str:
        if pymupdf is None:
            raise RuntimeError("PyMuPDF tidak tersedia untuk membaca fail PDF.")
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        text = "\n".join(p.get_text() for p in doc).upper()
        doc.close()
        if "COURSE OUTCOME REVIEW REPORT" in text:
            return "corr"
        if "COURSE LEARNING OUTCOME" in text or "PBCLOGSA" in text:
            return "pbclogsa"
        return "unknown"

    # -- PBCLOGSA ----------------------------------------------------------
    @classmethod
    def parse_pbclogsa(cls, pdf_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        if pymupdf is None:
            raise RuntimeError("PyMuPDF tidak tersedia untuk membaca fail PDF.")
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        pages: List[Dict[str, Any]] = []
        flat_events: List[Tuple[int, float, str, int]] = []

        for pi, page in enumerate(doc):
            words = cls._words(page)
            rows = cls._rows(words)
            headers: List[Dict[str, Any]] = []
            prev_y = 0.0
            for r in rows:
                cand = [w for w in r if cls.CLO_HDR_RE.match(w["text"])]
                if len(cand) < 2:
                    continue
                hy = r[0]["y0"]
                block_lines = []
                for other in rows:
                    if other[0]["y0"] >= hy - 2:
                        break
                    if other[0]["y0"] <= prev_y + 1:
                        continue
                    # Letterhead lines are centred, so keep every word in the
                    # band; only lines matching the meta labels are used.
                    line = " ".join(w["text"] for w in other)
                    if line.strip():
                        block_lines.append(line)
                headers.append(
                    {
                        "y": hy,
                        "clo": [(w["text"], w["cx"]) for w in sorted(cand, key=lambda w: w["x0"])],
                        "plo": [
                            (w["text"], w["cx"])
                            for w in sorted(r, key=lambda w: w["x0"])
                            if cls.PLO_HDR_RE.match(w["text"])
                        ],
                        "block": cls._parse_block(block_lines),
                    }
                )
                prev_y = hy

            metrics = [w for w in words if cls.METRIC_RE.match(w["text"])]
            avgs = [w["y0"] for w in words if w["text"] in ("Average", "Total") and w["x0"] < 340]
            pages.append({"words": words, "headers": headers, "metrics": metrics, "avgs": avgs})
            for idx, h in enumerate(headers):
                flat_events.append((pi, h["y"], "hdr", idx))
            for idx, m in enumerate(metrics):
                flat_events.append((pi, m["y0"], "metric", idx))

        flat_events.sort(key=lambda e: (e[0], e[1]))

        students: List[Dict[str, Any]] = []
        sections: List[Dict[str, Any]] = []
        meta: Dict[str, Any] = {}
        has_clo4 = False
        current_hdr: Optional[Dict[str, Any]] = None
        seen_sections = set()

        for pi, _y, kind, idx in flat_events:
            pg = pages[pi]
            if kind == "hdr":
                current_hdr = pg["headers"][idx]
                clo_codes = [c for c, _ in current_hdr["clo"]]
                if len(clo_codes) > 3 or any("04" in c[3:7] for c in clo_codes):
                    has_clo4 = True
                block = current_hdr["block"]
                key = (block.get("section"), block.get("lecture"), block.get("programme"), pi)
                if block and key not in seen_sections:
                    seen_sections.add(key)
                    sections.append({"page": pi + 1, **block})
                for k in ("session", "jabatan", "code", "name"):
                    if block.get(k) and not meta.get(k):
                        meta[k] = block[k]
                continue

            if current_hdr is None:
                continue
            metric_word = pg["metrics"][idx]
            my = metric_word["y0"]

            ys = sorted(
                set([h["y"] for h in pg["headers"]] + [m["y0"] for m in pg["metrics"]] + pg["avgs"] + [my])
            )
            pos = ys.index(my)
            lo = (ys[pos - 1] + my) / 2 if pos > 0 else my - 9
            hi = (my + ys[pos + 1]) / 2 if pos + 1 < len(ys) else 1e9
            band = [w for w in pg["words"] if lo < w["y0"] < hi]

            metric = metric_word["text"]
            prog_match = cls.METRIC_RE.match(metric)
            prog = prog_match.group(2) if prog_match else ""
            cls_word = next((w for w in band if cls.CLASS_RE.match(w["text"])), None)
            cls_x0 = cls_word["x0"] if cls_word else my + 160

            name_words = [
                w
                for w in band
                if w["x0"] >= metric_word["x1"] - 1
                and w["x1"] <= cls_x0 - 2
                and cls._num(w["text"]) is None
                and not cls.CLASS_RE.match(w["text"])
            ]
            name_words.sort(key=lambda w: (round(w["y0"], 1), w["x0"]))

            clo_hdr = current_hdr["clo"]
            plo_hdr = current_hdr["plo"]
            plo_right = plo_hdr[-1][1] if plo_hdr else clo_hdr[-1][1] + 45
            clo_lo = clo_hdr[0][1] - 25
            plo_lo = (plo_hdr[0][1] - 25) if plo_hdr else 1e9

            clo_vals: Dict[str, float] = {}
            plo_vals: Dict[str, float] = {}
            for w in band:
                v = cls._num(w["text"])
                if v is None:
                    continue
                if plo_hdr and plo_lo <= w["cx"] <= plo_right + 22:
                    code, _cx = min(plo_hdr, key=lambda h: abs(h[1] - w["cx"]))
                    plo_vals[code] = v
                elif clo_lo <= w["cx"] < plo_lo:
                    code, _cx = min(clo_hdr, key=lambda h: abs(h[1] - w["cx"]))
                    clo_vals[code] = v

            nums = sorted(
                [w for w in band if w["cx"] > plo_right + 22 and cls._num(w["text"]) is not None],
                key=lambda w: w["x0"],
            )
            vals = [float(w["text"]) for w in nums]
            generic = vals[0] if len(vals) >= 3 else None
            ca = vals[1] if len(vals) >= 3 else (vals[0] if vals else 0.0)
            fe = vals[2] if len(vals) >= 3 else (vals[1] if len(vals) > 1 else 0.0)
            diff = vals[3] if len(vals) >= 5 else round(ca - fe, 1)
            avg = vals[4] if len(vals) >= 5 else round((ca + fe) / 2, 1)
            grade = next((w["text"] for w in band if cls.GRADE_RE.match(w["text"])), "")

            clo_list = [clo_vals[k] for k, _cx in clo_hdr if k in clo_vals]
            students.append(
                {
                    "metric": metric,
                    "name": " ".join(w["text"] for w in name_words).strip(),
                    "prog": prog,
                    "className": cls_word["text"] if cls_word else "",
                    "section": current_hdr["block"].get("section", ""),
                    "lecturer": current_hdr["block"].get("lecture", ""),
                    "clo": clo_list,
                    "clo1": clo_list[0] if len(clo_list) > 0 else 0.0,
                    "clo2": clo_list[1] if len(clo_list) > 1 else 0.0,
                    "clo3": clo_list[2] if len(clo_list) > 2 else 0.0,
                    "clo4": clo_list[3] if len(clo_list) > 3 else None,
                    "plo": [{"code": k, "value": plo_vals[k]} for k, _cx in plo_hdr if k in plo_vals],
                    "generic": generic,
                    "ca": ca,
                    "fe": fe,
                    "caFeDiff": diff,
                    "caFeAvg": avg,
                    "grade": grade,
                    "source": filename,
                }
            )

        doc.close()
        return {"meta": meta, "sections": sections, "students": students, "hasClo4": has_clo4}

    # -- CORR --------------------------------------------------------------
    @classmethod
    def parse_corr(cls, pdf_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        if pymupdf is None:
            raise RuntimeError("PyMuPDF tidak tersedia untuk membaca fail PDF.")
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        words = cls._words(page)
        rows = cls._rows(words)

        info: Dict[str, str] = {}
        keys = {
            "Programme": "programme",
            "Class": "classes",
            "Course Name": "course",
            "Lecturer": "lecturer",
            "Number Of Student": "students",
            "Date": "date",
        }
        headings: List[float] = []
        for r in rows:
            text = " ".join(w["text"] for w in r)
            for label, key in keys.items():
                if text.upper().startswith(label.upper()):
                    info[key] = " ".join(w["text"] for w in r if w["x0"] > 178).lstrip(":").strip()
            if re.match(r"^\d+\.\s+[A-Z]", text) and r[0]["x0"] < 135:
                headings.append(r[0]["y0"])

        prog_code = ""
        if info.get("programme"):
            mm = re.search(r"\[\s*([A-Z]{3})\s*\]", info["programme"])
            prog_code = mm.group(1) if mm else ""

        ind_header = next((r for r in rows if any(w["text"] == "TARGET" for w in r)), None)
        ind_end = next(
            (r for r in rows if len(r) > 1 and r[0]["text"] == "3." and r[1]["text"].startswith("STUDENT")),
            None,
        )
        indicators: List[Dict[str, Any]] = []
        if ind_header:
            y_lo = ind_header[0]["y0"]
            y_hi = ind_end[0]["y0"] if ind_end else y_lo + 220
            for r in rows:
                y = r[0]["y0"]
                if not (y_lo + 2 < y < y_hi - 1):
                    continue
                nums = [w for w in r if 375 < w["x0"] < 490 and cls._num(w["text"]) is not None]
                label = " ".join(w["text"] for w in r if w["x0"] < 375)
                if len(nums) >= 2:
                    indicators.append(
                        {
                            "label": re.sub(r"^\d+\.\s*", "", label).strip(),
                            "target": float(nums[0]["text"]),
                            "achievement": float(nums[1]["text"]),
                        }
                    )

        grades: Dict[str, float] = {}
        grade_row = next((r for r in rows if any(w["text"] == "A+" for w in r)), None)
        if grade_row:
            g_y = grade_row[0]["y0"]
            heads = {w["text"]: w["cx"] for w in grade_row if cls.GRADE_RE.match(w["text"])}
            val_row = next((r for r in rows if 1 < r[0]["y0"] - g_y < 14), None)
            if val_row:
                for w in val_row:
                    v = cls._num(w["text"])
                    if v is not None:
                        grades[min(heads, key=lambda k: abs(heads[k] - w["cx"]))] = v

        def parse_table(prefix: str) -> List[Dict[str, Any]]:
            pattern = re.compile(rf"^{prefix}\d{{4}}[A-Z]?$")
            anchors = sorted(
                [w for w in words if pattern.match(w["text"]) and w["x0"] < 150], key=lambda w: w["y0"]
            )
            out: List[Dict[str, Any]] = []
            for idx, a in enumerate(anchors):
                lower = (anchors[idx - 1]["y0"] + a["y0"]) / 2 if idx else a["y0"] - 18
                if idx + 1 < len(anchors):
                    upper = (a["y0"] + anchors[idx + 1]["y0"]) / 2
                else:
                    nxt = [y for y in headings if y > a["y0"]]
                    upper = (min(nxt) - 1) if nxt else a["y0"] + 30
                desc = [w for w in words if lower <= w["y0"] < upper and 148 <= w["x0"] < 372]
                desc.sort(key=lambda w: (w["y0"], w["x0"]))
                nums = sorted(
                    [
                        w
                        for w in words
                        if abs(w["y0"] - a["y0"]) < 3 and w["x0"] > 380 and cls._num(w["text"]) is not None
                    ],
                    key=lambda w: w["x0"],
                )
                out.append(
                    {
                        "code": a["text"],
                        "description": " ".join(w["text"] for w in desc).strip(),
                        "attainment": float(nums[0]["text"]) if len(nums) > 0 else 0.0,
                        "studentAchieve": float(nums[1]["text"]) if len(nums) > 1 else 0.0,
                    }
                )
            return out

        clos = parse_table("CLO")
        plos = parse_table("PLO")

        reflection = {"pencapaian": "", "cadangan": ""}
        refl_start = next((r[0]["y0"] for r in rows if any(w["text"] == "REFLECTION" for w in r)), None)
        refl_end = next((r[0]["y0"] for r in rows if any(w["text"] == "PREPARED" for w in r)), None)
        if refl_start is not None:
            stop = refl_end if refl_end else refl_start + 60
            block = [w for w in words if refl_start + 4 < w["y0"] < stop - 1]
            ignore = {"PENCAPAIAN", "/", "ACHIEVEMENT", "CADANGAN", "(Cadangan", "untuk", "baiki", "PLO", "<", "50%)"}
            left = sorted(
                [w for w in block if w["x0"] < 330 and w["text"] not in ignore],
                key=lambda w: (w["y0"], w["x0"]),
            )
            right = sorted(
                [w for w in block if w["x0"] >= 330 and w["text"] not in ignore],
                key=lambda w: (w["y0"], w["x0"]),
            )
            reflection["pencapaian"] = " ".join(w["text"] for w in left).strip()
            reflection["cadangan"] = " ".join(w["text"] for w in right).strip()

        doc.close()
        course_code, course_name = "", info.get("course", "")
        if " - " in course_name:
            course_code, course_name = [p.strip() for p in course_name.split(" - ", 1)]
        students_txt = info.get("students", "").strip()
        return {
            "programme": prog_code,
            "programmeName": info.get("programme", ""),
            "classes": [c.strip() for c in info.get("classes", "").split(",") if c.strip()],
            "courseCode": course_code,
            "courseName": course_name,
            "lecturer": info.get("lecturer", ""),
            "studentCount": int(float(students_txt)) if students_txt.replace(".", "").isdigit() else 0,
            "date": info.get("date", ""),
            "indicators": indicators,
            "gradeDistribution": grades,
            "clos": clos,
            "plos": plos,
            "reflection": reflection,
            "source": filename,
        }


# ==============================================================================
# MODUL 6: APLIKASI FASTAPI & ENDPOINT REST
# ==============================================================================
app = FastAPI(title="Politeknik CO & JSU PB Sidecar API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NarrativeRequest(BaseModel):
    topics: List[Dict[str, Any]]
    mode: str = "fast"
    api_key: str = ""


@app.on_event("startup")
def on_startup() -> None:
    SQLiteRepository.init_db()


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    logo_path = RuntimeUtils.find_logo_in_folder()
    return {
        "status": "ok",
        "db_path": str(DB_PATH),
        "portable": IS_PORTABLE,
        "ocr_ready": RuntimeUtils.is_ocr_ready(),
        "logo_data_uri": RuntimeUtils.file_to_data_uri(logo_path) if logo_path else None,
        "logo_filename": logo_path.name if logo_path else "",
    }


@app.get("/api/courses")
def list_courses() -> List[Dict[str, Any]]:
    return SQLiteRepository.list_courses()


@app.get("/api/courses/{course_code}")
def get_course(course_code: str) -> Dict[str, Any]:
    rec = SQLiteRepository.load_course(course_code)
    if not rec:
        raise HTTPException(status_code=404, detail="Rekod kursus tidak ditemui.")
    return rec


@app.post("/api/courses")
def save_course(payload: Dict[str, Any]) -> Dict[str, Any]:
    code = SQLiteRepository.save_course(payload)
    return {"course_code": code, "saved": True}


@app.delete("/api/courses/{course_code}")
def delete_course(course_code: str) -> Dict[str, Any]:
    SQLiteRepository.delete_course(course_code)
    return {"deleted": True, "course_code": course_code}


@app.post("/api/upload-syllabus")
async def upload_syllabus(file: UploadFile = File(...)) -> Dict[str, Any]:
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Fail kosong.")
    defaults = SQLiteRepository.get_settings()

    if (file.filename or "").lower().endswith(".json"):
        loaded = json.loads(raw_bytes.decode("utf-8"))
        merged = UnifiedStateStore.create_empty_state(defaults)
        merged.update(loaded)
        UnifiedStateStore.sync_jsu_from_co(merged, force_rebuild=not bool(merged.get("jsu", {}).get("rows")))
        SQLiteRepository.save_course(merged)
        return merged

    try:
        parsed = SyllabusExtractorEngine.extract_pdf(raw_bytes, defaults)
        SQLiteRepository.save_course(parsed)
        return parsed
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal mengekstrak PDF: {exc}")


@app.post("/api/cqi/extract")
async def extract_cqi(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """Gabungkan markah PBCLOGSA + CORR panitia daripada satu atau lebih PDF."""
    students: Dict[str, Dict[str, Any]] = {}
    sections: List[Dict[str, Any]] = []
    corr: Optional[Dict[str, Any]] = None
    sources: List[Dict[str, Any]] = []
    meta_info: Dict[str, str] = {}
    has_clo4 = False

    for upload in files:
        raw_bytes = await upload.read()
        if not raw_bytes:
            continue
        name = upload.filename or "fail.pdf"
        try:
            kind = CqiExtractorEngine.classify(raw_bytes)
        except Exception as exc:  # pragma: no cover - defensive
            raise HTTPException(status_code=400, detail=f"Fail '{name}' tidak dapat dibaca: {exc}")
        if kind == "pbclogsa":
            parsed = CqiExtractorEngine.parse_pbclogsa(raw_bytes, name)
            for student in parsed["students"]:
                students[student["metric"]] = student
            sections.extend(parsed["sections"])
            has_clo4 = has_clo4 or bool(parsed["hasClo4"])
            for key, value in (parsed["meta"] or {}).items():
                if value and not meta_info.get(key):
                    meta_info[key] = value
            sources.append({"name": name, "kind": kind, "count": len(parsed["students"])})
        elif kind == "corr":
            corr = CqiExtractorEngine.parse_corr(raw_bytes, name)
            sources.append({"name": name, "kind": kind, "count": corr.get("studentCount", 0)})
        else:
            sources.append({"name": name, "kind": "unknown", "count": 0})

    if not students and not corr:
        raise HTTPException(
            status_code=400,
            detail="Tiada data PBCLOGSA atau CORR dikesan. Pastikan fail PDF markah/CORR yang betul.",
        )
    return {
        "courseCode": meta_info.get("code", ""),
        "courseName": meta_info.get("name", ""),
        "jabatan": meta_info.get("jabatan", ""),
        "session": meta_info.get("session", ""),
        "hasClo4": has_clo4,
        "students": list(students.values()),
        "sections": sections,
        "corr": corr,
        "sources": sources,
    }


@app.get("/api/cqi")
def list_cqi_reports() -> List[Dict[str, Any]]:
    return SQLiteRepository.list_cqi()


@app.get("/api/cqi/{course_code}")
def get_cqi_report(course_code: str) -> Dict[str, Any]:
    record = SQLiteRepository.load_cqi(course_code)
    if not record:
        raise HTTPException(status_code=404, detail="Rekod CQI tidak ditemui.")
    return record


@app.post("/api/cqi")
def save_cqi_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    code = SQLiteRepository.save_cqi(payload)
    return {"course_code": code, "saved": True}


@app.delete("/api/cqi/{course_code}")
def delete_cqi_report(course_code: str) -> Dict[str, Any]:
    SQLiteRepository.delete_cqi(course_code)
    return {"deleted": True, "course_code": course_code}


@app.post("/api/print-models")
def get_print_models(state: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "co": PrintModelBuilder.build_co_print_model(state),
        "jsu": PrintModelBuilder.build_jsu_print_model(state),
    }


@app.post("/api/regenerate-narratives")
def regenerate_narratives(req: NarrativeRequest) -> Dict[str, Any]:
    results = []
    for t in req.topics:
        if req.mode == "ai" and req.api_key.strip():
            txt = NarrativeGeneratorEngine.synthesize_ai_sync(t.get("title", ""), t.get("raw_subtopics", ""), req.api_key)
        else:
            txt = NarrativeGeneratorEngine.synthesize_fast(t.get("title", ""), t.get("raw_subtopics", ""))
        results.append(txt)
    return {"narratives": results}


@app.get("/api/settings")
def get_settings() -> Dict[str, str]:
    return SQLiteRepository.get_settings()


@app.post("/api/settings")
def save_settings(settings: Dict[str, str]) -> Dict[str, Any]:
    SQLiteRepository.save_settings(settings)
    return {"saved": True}


@app.post("/api/logo")
async def upload_logo(file: UploadFile = File(...)) -> Dict[str, Any]:
    ext = Path(file.filename or "logo.png").suffix.lower() or ".png"
    if ext not in ALLOWED_LOGO_EXTS:
        raise HTTPException(status_code=400, detail="Format logo tidak disokong.")
    for old in LOGO_DIR.iterdir():
        if old.is_file() and old.stem == "logo":
            old.unlink(missing_ok=True)
    target = LOGO_DIR / f"logo{ext}"
    target.write_bytes(await file.read())
    return {"logo_filename": target.name, "logo_data_uri": RuntimeUtils.file_to_data_uri(target)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("CO_JSU_PORT", "8765")))