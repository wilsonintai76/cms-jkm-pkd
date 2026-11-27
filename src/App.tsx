import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "./constants";
import { createEmptyCourse } from "./lib/course";
import { buildChecklist, computeJsu, computeSltTotals, targetSltOf, uniquePlos } from "./lib/calc";
import type { Course } from "./lib/calc";
import AppHeader from "./components/AppHeader";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";
import PrintStyles from "./components/PrintStyles";
import ImportPanel from "./components/ImportPanel";
import CourseInfoPanel from "./components/CourseInfoPanel";
import CourseOutlineModule from "./components/CourseOutlineModule";
import JsuModule from "./components/JsuModule";
import CqiModule from "./components/CqiModule";
import SettingsPanel from "./components/SettingsPanel";
import { bundleFromExtract, createEmptyCqi } from "./lib/cqi";
import type { CqiBundle } from "./lib/cqi";

const INITIAL_DRAFT = {
  q_no: "S1",
  rowIdx: 0,
  topic: "1.0",
  domain: "C3",
  items: 1,
  marks: 5,
  item_type: "S",
};

export default function App() {
  const [activeNav, setActiveNav] = useState("import");
  const [coSubView, setCoSubView] = useState("edit");
  const [jsuSubView, setJsuSubView] = useState("edit");
  const [cqiSubView, setCqiSubView] = useState("import");
  const [cqiProg, setCqiProg] = useState("");
  const [cqi, setCqi] = useState<CqiBundle>(createEmptyCqi);
  const [cqiList, setCqiList] = useState<any[]>([]);

  const [course, setCourse] = useState<Course>(createEmptyCourse);
  const [savedList, setSavedList] = useState<any[]>([]);
  const [apiOnline, setApiOnline] = useState(false);
  const [dbPath, setDbPath] = useState("");
  const [apiPortable, setApiPortable] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [qDraft, setQDraft] = useState(INITIAL_DRAFT);
  const probeApi = useRef<null | (() => Promise<boolean>)>(null);

  const notify = (msg: string, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Semak sambungan FastAPI sidecar pada startup.
  // The bundled sidecar is a one-file exe that needs a few seconds to unpack,
  // so keep retrying instead of falling back to demo mode on the first miss.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (!res.ok) return false;
        const info = await res.json();
        if (cancelled) return true;
        setApiOnline(true);
        if (info.db_path) setDbPath(info.db_path);
        setApiPortable(Boolean(info.portable));
        if (info.logo_data_uri) setLogoUri(info.logo_data_uri);
        const listRes = await fetch(`${API_BASE}/courses`);
        if (listRes.ok) {
          const items = await listRes.json();
          if (!cancelled) setSavedList(items);
        }
        const setRes = await fetch(`${API_BASE}/settings`);
        if (setRes.ok) {
          const s = await setRes.json();
          if (s.gemini_api_key && !cancelled) setGeminiKey(s.gemini_api_key);
        }
        const cqiRes = await fetch(`${API_BASE}/cqi`);
        if (cqiRes.ok) {
          const items = await cqiRes.json();
          if (!cancelled) setCqiList(items);
        }
        return true;
      } catch {
        return false;
      }
    };

    probeApi.current = load;

    (async () => {
      for (let attempt = 0; attempt < 30 && !cancelled; attempt++) {
        if (await load()) return;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!cancelled) setApiOnline(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Dipanggil oleh butang "Cuba sambung semula" apabila sidecar lambat bermula.
  const retryApi = async () => {
    setApiOnline(false);
    const probe = probeApi.current;
    if (!probe) return;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await probe()) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    notify("Pelayan FastAPI masih tidak dapat dihubungi.", "warning");
  };

  const sltTotals = useMemo(() => computeSltTotals(course.topics), [course.topics]);
  const targetSlt = targetSltOf(course);
  const plos = useMemo(() => uniquePlos(course.clos), [course.clos]);
  const checklist = useMemo(() => buildChecklist(course), [course]);
  const jsuComputed = useMemo(() => computeJsu(course), [course]);

  const saveToSQLite = async (silent = false) => {
    if (!apiOnline) {
      if (!silent) notify("Mod Luar Talian: backend tidak dapat dihubungi.", "warning");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course),
      });
      if (res.ok) {
        const listRes = await fetch(`${API_BASE}/courses`);
        if (listRes.ok) setSavedList(await listRes.json());
        if (!silent) notify(`Rekod '${course.course_code}' disimpan ke SQLite!`, "success");
      }
    } catch (e: any) {
      notify(`Ralat simpanan: ${e.message}`, "error");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!apiOnline) {
      if (file.name.toLowerCase().endsWith(".json")) {
        const txt = await file.text();
        setCourse(JSON.parse(txt));
        notify(`Fail JSON '${file.name}' dimuatkan!`, "success");
      } else {
        notify("Pelayan backend tidak aktif — PDF tidak dapat diekstrak.", "warning");
      }
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/upload-syllabus`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const parsed = await res.json();
      setCourse(parsed);
      const listRes = await fetch(`${API_BASE}/courses`);
      if (listRes.ok) setSavedList(await listRes.json());
      notify(`Silibus '${file.name}' (${parsed.course_code}) berjaya diekstrak & disimpan!`, "success");
      setActiveNav("course_info");
    } catch (err: any) {
      notify(`Gagal ekstrak PDF: ${err.message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const openSavedCourse = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/courses/${encodeURIComponent(code)}`);
      if (res.ok) {
        setCourse(await res.json());
        notify(`Rekod '${code}' dimuatkan.`, "success");
      }
    } catch (err: any) {
      notify(`Ralat muat rekod: ${err.message}`, "error");
    }
  };

  const deleteSavedCourse = async (code: string) => {
    await fetch(`${API_BASE}/courses/${encodeURIComponent(code)}`, { method: "DELETE" });
    setSavedList((prev) => prev.filter((x) => x.course_code !== code));
    notify(`Rekod '${code}' dipadam.`, "info");
  };

  const saveCqi = async (bundle: CqiBundle, silent = false) => {
    if (!apiOnline) {
      if (!silent) notify("Mod Luar Talian: backend tidak dapat dihubungi.", "warning");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/cqi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundle),
      });
      if (res.ok) {
        const listRes = await fetch(`${API_BASE}/cqi`);
        if (listRes.ok) setCqiList(await listRes.json());
        if (!silent) notify(`Laporan CQI '${bundle.meta.code || "TANPA KOD"}' disimpan ke SQLite!`, "success");
      }
    } catch (e: any) {
      notify(`Ralat simpan CQI: ${e.message}`, "error");
    }
  };

  // Ekstrak markah PBCLOGSA + CORR panitia menjadi laporan CQI.
  const handleCqiUpload = async (files: File[]) => {
    if (!apiOnline) {
      notify("Pelayan backend tidak aktif — pengekstrakan PDF CQI memerlukan FastAPI.", "warning");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch(`${API_BASE}/cqi/extract`, { method: "POST", body: fd });
      if (!res.ok) {
        const raw = await res.text();
        let detail = raw;
        try {
          detail = JSON.parse(raw).detail || raw;
        } catch {
          /* teks biasa */
        }
        throw new Error(detail);
      }
      const parsed = await res.json();
      const next = bundleFromExtract(parsed);
      if (!next.meta.coordinator) next.meta.coordinator = course.prepared_by || "";
      if (!next.meta.jabatan) next.meta.jabatan = course.department || "";
      setCqi(next);
      setCqiProg(next.programmes[0] || "");
      notify(
        `CQI diekstrak: ${next.students.length} pelajar, ${next.programmes.length} program${
          next.corr ? " + CORR panitia" : ""
        }.`,
        "success",
      );
      await saveCqi(next, true);
    } catch (err: any) {
      notify(`Gagal ekstrak PDF CQI: ${err.message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const openSavedCqi = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/cqi/${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const saved = await res.json();
      setCqi(saved);
      setCqiProg(saved.programmes?.[0] || "");
      setCqiSubView(saved.students?.length ? "corr" : "import");
      setActiveNav("cqi_module");
      notify(`Rekod CQI '${code}' dimuatkan.`, "success");
    } catch (err: any) {
      notify(`Ralat muat rekod CQI: ${err.message}`, "error");
    }
  };

  const deleteSavedCqi = async (code: string) => {
    await fetch(`${API_BASE}/cqi/${encodeURIComponent(code)}`, { method: "DELETE" });
    setCqiList((prev) => prev.filter((x) => x.course_code !== code));
    notify(`Rekod CQI '${code}' dipadam.`, "info");
  };

  const regenerateNarratives = async (mode: "fast" | "ai") => {
    if (!apiOnline) {
      notify("Pelayan backend tidak aktif untuk penjanaan ringkasan.", "warning");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/regenerate-narratives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: course.topics, mode, api_key: geminiKey }),
      });
      if (res.ok) {
        const { narratives } = await res.json();
        setCourse((prev) => ({
          ...prev,
          topics: prev.topics.map((t: any, i: number) => ({ ...t, narrative: narratives[i] || t.narrative })),
        }));
        notify(`Ringkasan jadual pengajaran (${mode.toUpperCase()}) dikemas kini!`, "success");
      }
    } finally {
      setBusy(false);
    }
  };

  const autoBalanceSlt = () => {
    if (!course.topics.length) return;
    const diff = Math.round((targetSlt - sltTotals.grand) * 100) / 100;
    setCourse((prev) => {
      const next = [...prev.topics];
      const last = { ...next[next.length - 1] };
      last.nf2f_indep = Math.max(0, Math.round(((Number(last.nf2f_indep) || 0) + diff) * 100) / 100);
      next[next.length - 1] = last;
      return { ...prev, topics: next };
    });
    notify(`SLT diimbangkan kepada ${targetSlt} jam.`, "success");
  };

  // Tambah soalan ke baris JSU PB dan kira semula C1/C2/C3/A3.
  const addQuestionToJsuRow = () => {
    const idx = Number(qDraft.rowIdx) || 0;
    setCourse((prev) => {
      const rows = [...(prev.jsu?.rows || [])];
      if (!rows[idx]) return prev;
      const target = { ...rows[idx] };
      const qs = [...(target.questions || []), { ...qDraft }];
      target.questions = qs;

      let c1i = 0, c1m = 0, c2i = 0, c2m = 0, c3i = 0, c3m = 0, a3i = 0, a3m = 0;
      const tm: Record<string, number> = { ...(target.topic_marks || {}) };
      Object.keys(tm).forEach((k) => (tm[k] = 0));
      const checked = new Set<string>(target.checked_topics || []);

      for (const q of qs) {
        const it = Number(q.items) || 0;
        const mk = Number(q.marks) || 0;
        if (q.domain === "C1") { c1i += it; c1m += mk; }
        else if (q.domain === "C2") { c2i += it; c2m += mk; }
        else if (q.domain === "A3") { a3i += it; a3m += mk; }
        else { c3i += it; c3m += mk; }
        if (q.topic) {
          tm[q.topic] = (Number(tm[q.topic]) || 0) + mk;
          checked.add(q.topic);
        }
      }
      target.c1_items = c1i; target.c1_marks = c1m;
      target.c2_items = c2i; target.c2_marks = c2m;
      target.c3_items = c3i; target.c3_marks = c3m;
      target.a3_items = a3i; target.a3_marks = a3m;
      target.topic_marks = tm;
      target.checked_topics = Array.from(checked);
      rows[idx] = target;
      return { ...prev, jsu: { ...prev.jsu, rows } };
    });
    notify(`Soalan ${qDraft.q_no} dipetakan ke matriks JSU PB!`, "success");
  };

  // Cetakan A4 Potret (CO/CQI) atau A4 Landskap (JSU PB)
  const triggerPrint = (mode: "co" | "jsu" | "cqi") => {
    if (mode === "co") {
      setActiveNav("co_module");
      setCoSubView("preview");
    } else if (mode === "jsu") {
      setActiveNav("jsu_module");
      setJsuSubView("preview");
    } else {
      setActiveNav("cqi_module");
      setCqiSubView("borang");
    }
    const styleId = "dynamic-print-orient";
    let st = document.getElementById(styleId);
    if (!st) {
      st = document.createElement("style");
      st.id = styleId;
      document.head.appendChild(st);
    }
    st.innerHTML =
      mode === "jsu"
        ? "@media print { @page { size: A4 landscape; margin: 0; } }"
        : "@media print { @page { size: A4 portrait; margin: 0; } }";
    setTimeout(() => window.print(), 250);
  };

  // Eksport Microsoft Word (.doc) daripada elemen pratonton
  const exportWord = (elementId: string, filename: string, landscape = false) => {
    const el = document.getElementById(elementId);
    if (!el) {
      notify("Sila buka paparan Pratonton terlebih dahulu.", "warning");
      return;
    }
    const orient = landscape ? "landscape" : "portrait";
    const size = landscape ? "29.7cm 21.0cm" : "21.0cm 29.7cm";
    const docHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /><style>
        @page Section1 { size: ${size}; mso-page-orientation: ${orient}; margin: 1.2cm; }
        div.Section1 { page: Section1; }
        body { font-family: Arial, sans-serif; color: #000; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000; padding: 4px; }
      </style></head>
      <body><div class="Section1">${el.innerHTML}</div></body></html>`;
    const blob = new Blob(["\ufeff", docHtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Fail Word '${filename}' dimuat turun!`, "success");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      <PrintStyles />

      <AppHeader
        courseCode={course.course_code}
        apiOnline={apiOnline}
        onSave={() => saveToSQLite(false)}
        onPrintCo={() => triggerPrint("co")}
        onPrintJsu={() => triggerPrint("jsu")}
      />

      <Toast toast={toast} />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          activeNav={activeNav}
          onNavigate={setActiveNav}
          logoUri={logoUri}
          institution={course.institution}
          department={course.department}
          sltGrand={sltTotals.grand}
          targetSlt={targetSlt}
          caWeight={course.ca_weight}
          feWeight={course.fe_weight}
          savedCount={savedList.length}
        />

        <main className="flex-1 p-5 overflow-y-auto">
          {activeNav === "import" && (
            <ImportPanel
              busy={busy}
              apiOnline={apiOnline}
              dbPath={dbPath}
              savedList={savedList}
              onUpload={handleFileUpload}
              onOpen={openSavedCourse}
              onDelete={deleteSavedCourse}
              onRetryApi={retryApi}
            />
          )}

          {activeNav === "course_info" && (
            <CourseInfoPanel course={course} checklist={checklist} onChange={setCourse} />
          )}

          {activeNav === "co_module" && (
            <CourseOutlineModule
              course={course}
              subView={coSubView}
              onSubViewChange={setCoSubView}
              sltTotals={sltTotals}
              targetSlt={targetSlt}
              busy={busy}
              logoUri={logoUri}
              uniquePlos={plos}
              onChange={setCourse}
              onRegenerate={regenerateNarratives}
              onAutoBalance={autoBalanceSlt}
              onExportWord={exportWord}
              onPrint={() => triggerPrint("co")}
            />
          )}

          {activeNav === "jsu_module" && (
            <JsuModule
              course={course}
              computed={jsuComputed}
              subView={jsuSubView}
              draft={qDraft}
              onSubViewChange={setJsuSubView}
              onDraftChange={setQDraft}
              onAddQuestion={addQuestionToJsuRow}
              onChange={setCourse}
              onExportWord={exportWord}
              onPrint={() => triggerPrint("jsu")}
            />
          )}

          {activeNav === "cqi_module" && (
            <CqiModule
              bundle={cqi}
              subView={cqiSubView}
              activeProgramme={cqiProg}
              apiOnline={apiOnline}
              busy={busy}
              logoUri={logoUri}
              savedList={cqiList}
              onSubViewChange={setCqiSubView}
              onProgrammeChange={setCqiProg}
              onChange={setCqi}
              onUpload={handleCqiUpload}
              onSave={() => saveCqi(cqi)}
              onPrint={() => triggerPrint("cqi")}
              onNotify={notify}
              onOpenSaved={openSavedCqi}
              onDeleteSaved={deleteSavedCqi}
            />
          )}

          {activeNav === "settings" && (
            <SettingsPanel
              logoUri={logoUri}
              apiOnline={apiOnline}
              apiPortable={apiPortable}
              dbPath={dbPath}
              geminiKey={geminiKey}
              onGeminiKeyChange={setGeminiKey}
              onLogoChange={setLogoUri}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      <footer className="no-print bg-slate-950 text-slate-400 border-t border-slate-800 px-6 py-2.5 text-[11px] flex flex-wrap items-center justify-between gap-2">
        <div>© 2026 Hak Cipta Terpelihara • Politeknik Malaysia (JPPKK) • Sistem Kurikulum PLSP-04 & JSU PB</div>
        <div className="text-sky-400 font-mono">Tauri 2 + React + FastAPI • SQLite Tempatan</div>
      </footer>
    </div>
  );
}
