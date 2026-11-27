import React from "react";
import { API_BASE } from "../constants";
import { SESSION_RE, nextSessionOf, prevSessionOf } from "../lib/cqi";

type SettingsPanelProps = {
  logoUri: string | null;
  apiOnline: boolean;
  apiPortable: boolean;
  dbPath: string;
  geminiKey: string;
  session: string;
  institution: string;
  department: string;
  onGeminiKeyChange: (value: string) => void;
  onSessionChange: (value: string) => void;
  onInstitutionChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onLogoChange: (uri: string) => void;
  onNotify: (msg: string, type?: string) => void;
};

export default function SettingsPanel({
  logoUri,
  apiOnline,
  apiPortable,
  dbPath,
  geminiKey,
  session,
  institution,
  department,
  onGeminiKeyChange,
  onSessionChange,
  onInstitutionChange,
  onDepartmentChange,
  onLogoChange,
  onNotify,
}: SettingsPanelProps) {
  const handleLogo = async (file: File) => {
    if (apiOnline) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API_BASE}/logo`, { method: "POST", body: fd });
      if (r.ok) {
        const data = await r.json();
        onLogoChange(data.logo_data_uri);
        onNotify("Logo disimpan ke pelayan!", "success");
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => onLogoChange(String(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const saveSettings = async () => {
    if (apiOnline) {
      await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gemini_api_key: geminiKey,
          current_session: session.trim(),
          institution: institution.trim(),
          department: department.trim(),
        }),
      });
    }
    onNotify("Tetapan disimpan!", "success");
  };

  const sessionValid = SESSION_RE.test(session.trim());

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h2 className="text-base font-bold">1. Logo Rasmi Institusi</h2>
        <div className="h-36 border border-dashed rounded-xl bg-slate-50 flex items-center justify-center">
          {logoUri ? (
            <img src={logoUri} alt="Logo" className="max-h-24 object-contain" />
          ) : (
            <span className="text-xs text-slate-400">Tiada logo dimuat naik</span>
          )}
        </div>
        <label className="block w-full text-center px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer">
          Pilih Fail Logo (.png / .jpg / .svg)
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLogo(f);
            }}
          />
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
        <div>
          <h2 className="text-base font-bold">2. Identiti Dokumen</h2>
          <p className="text-[11px] text-slate-500">
            Digunakan pada kepala Course Outline, JSU dan Laporan CQI untuk semua kursus.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="font-semibold">Institusi</span>
          <input
            value={institution}
            onChange={(e) => onInstitutionChange(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="POLITEKNIK MALAYSIA - KUCHING SARAWAK"
          />
        </label>
        <label className="block space-y-1">
          <span className="font-semibold">Jabatan</span>
          <input
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="DEPARTMENT OF MECHANICAL ENGINEERING"
          />
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs md:col-span-2">
        <h2 className="text-base font-bold">3. Tetapan Lalai &amp; Gemini API Key</h2>
        <label className="block space-y-1">
          <span className="font-semibold">Sesi Akademik Semasa</span>
          <input
            value={session}
            onChange={(e) => onSessionChange(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
            placeholder="II : 2025/2026"
          />
          {session.trim() === "" ? (
            <span className="text-slate-500">
              Digunakan oleh Laporan CQI (sesi semasa, terdahulu dan hadapan).
            </span>
          ) : sessionValid ? (
            <span className="text-emerald-700">
              Terdahulu: <strong>{prevSessionOf(session.trim()) || "-"}</strong> • Hadapan:{" "}
              <strong>{nextSessionOf(session.trim()) || "-"}</strong>
            </span>
          ) : (
            <span className="text-rose-700">Format perlu seperti <strong>II : 2025/2026</strong>.</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="font-semibold">GEMINI_API_KEY (Pilihan untuk Ringkasan AI)</span>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => onGeminiKeyChange(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="AIza..."
          />
        </label>
        <button
          onClick={saveSettings}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          Simpan Tetapan
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2 text-xs md:col-span-2">
        <h2 className="text-base font-bold">4. Lokasi Storan Data</h2>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded border font-semibold ${
              apiPortable ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            {apiPortable ? "Mod Mudah Alih (Portable)" : "Mod Dipasang"}
          </span>
          <span className="text-slate-500">
            {apiPortable
              ? "Rekod disimpan dalam folder aplikasi — ikut bersama jika dipindahkan."
              : "Rekod disimpan dalam profil pengguna Windows."}
          </span>
        </div>
        <div className="font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 break-all text-slate-700">
          {dbPath || (apiOnline ? "(memuatkan...)" : "Pelayan tidak dihubungi")}
        </div>
        <div className="text-slate-500">
          Salin folder <span className="font-semibold">data</span> di atas untuk backup atau pindah ke PC lain.
        </div>
      </div>
    </div>
  );
}
