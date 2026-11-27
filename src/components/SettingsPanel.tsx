import React from "react";
import { API_BASE } from "../constants";

type SettingsPanelProps = {
  logoUri: string | null;
  apiOnline: boolean;
  apiPortable: boolean;
  dbPath: string;
  geminiKey: string;
  onGeminiKeyChange: (value: string) => void;
  onLogoChange: (uri: string) => void;
  onNotify: (msg: string, type?: string) => void;
};

export default function SettingsPanel({
  logoUri,
  apiOnline,
  apiPortable,
  dbPath,
  geminiKey,
  onGeminiKeyChange,
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
        body: JSON.stringify({ gemini_api_key: geminiKey }),
      });
    }
    onNotify("Tetapan disimpan!", "success");
  };

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
        <h2 className="text-base font-bold">2. Tetapan Lalai & Gemini API Key</h2>
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
        <h2 className="text-base font-bold">3. Lokasi Storan Data</h2>
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
