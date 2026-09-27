import { useEffect, useState } from 'react';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export const TAHUN_MIN = 2000;
export const TAHUN_MAKS = 2100;

// Pemilih tahun bebas: tombol ‹ › untuk geser setahun, atau ketik tahun langsung.
// Tidak bergantung pada daftar tahun yang punya data, jadi tidak pernah "habis".
export default function YearPicker({ value, onChange, className = '' }) {
  const [draft, setDraft] = useState(String(value));
  const tahunIni = new Date().getFullYear();

  useEffect(() => setDraft(String(value)), [value]);

  const valid = (y) => Number.isInteger(y) && y >= TAHUN_MIN && y <= TAHUN_MAKS;
  const pilih = (y) => valid(y) && onChange(y);

  function commit() {
    const y = Number(draft);
    if (valid(y)) onChange(y);
    else setDraft(String(value)); // ketikan tidak valid → kembalikan
  }

  const btn =
    'grid place-items-center w-8 h-8 rounded-full text-tinta-60 hover:text-tinta hover:bg-permukaan-2 transition-colors disabled:opacity-35 disabled:pointer-events-none';

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <div className="inline-flex items-center border border-border bg-permukaan rounded-full p-[3px]">
        <button type="button" aria-label="Tahun sebelumnya" title="Tahun sebelumnya" onClick={() => pilih(value - 1)} disabled={value <= TAHUN_MIN} className={btn}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" {...svg} strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <input
          aria-label="Tahun"
          inputMode="numeric"
          maxLength={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'ArrowUp') { e.preventDefault(); pilih(value + 1); }
            if (e.key === 'ArrowDown') { e.preventDefault(); pilih(value - 1); }
          }}
          className="w-[58px] text-center bg-transparent text-[13.5px] font-semibold tnum outline-none rounded-sm focus:bg-amber-lembut"
        />
        <button type="button" aria-label="Tahun berikutnya" title="Tahun berikutnya" onClick={() => pilih(value + 1)} disabled={value >= TAHUN_MAKS} className={btn}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" {...svg} strokeWidth="2.2"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      {value !== tahunIni && (
        <button type="button" onClick={() => onChange(tahunIni)} className="text-[12.5px] font-semibold text-amber-teks hover:underline px-1">
          Tahun ini
        </button>
      )}
    </div>
  );
}
