import { useEffect, useState } from 'react';
import Topbar from '../../components/layout/Topbar';
import Reveal from '../../components/Reveal';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { formatJam, formatTanggal } from '../../lib/format';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const MAX_ITEMS = 4; // sama dengan batas backend (lib/siteContent.js)
const BARU = { value: '', unit: '', caption: '', visible: true };

// Management: edit manual angka "data produksi" yang tampil di landing page.
export default function KontenPublik() {
  const { data, loading, error, reload } = useApi(() => api.get('/site-content/landing-stats'), []);
  const { toast, toastProps } = useToast();
  const [items, setItems] = useState(null);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState({});

  useEffect(() => {
    if (data) setItems(data.items.map((it) => ({ ...BARU, ...it })));
  }, [data]);

  const berubah = data && items && JSON.stringify(items) !== JSON.stringify(data.items.map((it) => ({ ...BARU, ...it })));

  function ubah(i, field, value) {
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
    setInvalid((inv) => ({ ...inv, [`${i}.${field}`]: false }));
  }
  function geser(i, arah) {
    setItems((list) => {
      const j = i + arah;
      if (j < 0 || j >= list.length) return list;
      const next = list.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  const hapus = (i) => setItems((list) => list.filter((_, idx) => idx !== i));
  const tambah = () => setItems((list) => [...list, { ...BARU }]);

  async function simpan() {
    const inv = {};
    items.forEach((it, i) => {
      if (!it.value.trim()) inv[`${i}.value`] = true;
      if (!it.caption.trim()) inv[`${i}.caption`] = true;
    });
    setInvalid(inv);
    if (Object.keys(inv).length) {
      toast('Angka dan keterangan wajib diisi.');
      return;
    }
    if (!items.some((it) => it.visible)) {
      toast('Minimal satu statistik harus ditampilkan.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/site-content/landing-stats', { items });
      toast('Data publik diperbarui. Landing page langsung memakai nilai baru.');
      await reload();
    } catch (e) {
      toast(e.message || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }

  const tampil = (items || []).filter((it) => it.visible);

  return (
    <>
      <Topbar crumb="Management · Data Publik" title="Data Publik Landing Page" />

      <Reveal className="flex gap-3 items-start bg-amber-lembut border border-[#EAC9AE] rounded-md px-4 py-[13px] mb-6">
        <svg viewBox="0 0 24 24" className="w-[19px] h-[19px] flex-none text-amber-teks mt-px" {...svg} strokeWidth="1.9">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01" />
          <path d="M11 12h1v4h1" />
        </svg>
        <p className="text-[13px] leading-[1.55] text-amber-teks">
          Angka di bawah <b>tampil untuk publik</b> di bagian atas landing page. Nilainya diisi manual (tidak dihitung otomatis dari sensor),
          jadi pastikan sudah sesuai data produksi yang disetujui sebelum disimpan.
        </p>
      </Reveal>

      {!items || (loading && !data) ? (
        error ? (
          <div className="card p-10 text-center text-critical-teks">Gagal memuat data publik.</div>
        ) : (
          <div className="card p-10 text-center text-tinta-40">Memuat…</div>
        )
      ) : (
        <div className="grid grid-cols-[1.25fr_1fr] gap-5 items-start max-[1080px]:grid-cols-1">
          <Reveal className="card">
            <div className="card-hd">
              <div>
                <h3 className="text-[16px] font-semibold">Statistik produksi</h3>
                <div className="text-[13px] text-tinta-60">
                  {data.updated_at
                    ? `Terakhir diubah ${formatTanggal(data.updated_at)} · ${formatJam(data.updated_at)} oleh ${data.updated_by}`
                    : 'Masih memakai nilai awal'}
                </div>
              </div>
            </div>
            <div className="p-[22px] flex flex-col gap-4">
              {items.map((it, i) => (
                <div key={i} className={`border rounded-md p-4 flex flex-col gap-3 ${it.visible ? 'border-border bg-permukaan' : 'border-dashed border-border-kuat bg-permukaan-2'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] tracking-[.08em] uppercase text-tinta-40 font-semibold">Statistik {i + 1}</span>
                    <label className="ml-auto flex items-center gap-2 text-[13px] text-tinta-60 cursor-pointer select-none">
                      <input type="checkbox" className="w-4 h-4 accent-olive" checked={it.visible} onChange={(e) => ubah(i, 'visible', e.target.checked)} />
                      Tampilkan
                    </label>
                    <IconBtn label="Naikkan" disabled={i === 0} onClick={() => geser(i, -1)} d="m18 15-6-6-6 6" />
                    <IconBtn label="Turunkan" disabled={i === items.length - 1} onClick={() => geser(i, 1)} d="m6 9 6 6 6-6" />
                    <IconBtn label="Hapus" disabled={items.length <= 1} onClick={() => hapus(i)} d="M18 6 6 18M6 6l12 12" danger />
                  </div>
                  <div className="grid grid-cols-[1fr_110px] gap-3 max-[480px]:grid-cols-1">
                    <Field label="Angka" invalid={invalid[`${i}.value`]}>
                      <input className={`form-input tnum ${invalid[`${i}.value`] ? 'invalid' : ''}`} maxLength={20} placeholder="mis. 1.240" value={it.value} onChange={(e) => ubah(i, 'value', e.target.value)} />
                    </Field>
                    <Field label="Satuan">
                      <input className="form-input" maxLength={12} placeholder="kg / L" value={it.unit} onChange={(e) => ubah(i, 'unit', e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Keterangan" invalid={invalid[`${i}.caption`]}>
                    <input className={`form-input ${invalid[`${i}.caption`] ? 'invalid' : ''}`} maxLength={60} placeholder="mis. Sampah plastik diolah" value={it.caption} onChange={(e) => ubah(i, 'caption', e.target.value)} />
                  </Field>
                </div>
              ))}

              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={tambah} disabled={items.length >= MAX_ITEMS} className="btn btn-outline px-4 py-[10px] text-[14px] disabled:opacity-50">
                  + Tambah statistik
                </button>
                <span className="text-[12.5px] text-tinta-40">Maksimal {MAX_ITEMS} statistik.</span>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setItems(data.items.map((x) => ({ ...BARU, ...x })))} disabled={!berubah || saving} className="btn btn-ghost px-4 py-[10px] text-[14px] disabled:opacity-50">
                    Batalkan
                  </button>
                  <button onClick={simpan} disabled={!berubah || saving} className="btn btn-primary px-5 py-[10px] text-[14px] disabled:opacity-60">
                    {saving ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Pratinjau */}
          <Reveal delay={60} className="card lg:sticky lg:top-6">
            <div className="card-hd">
              <h3 className="text-[16px] font-semibold">Pratinjau di landing page</h3>
            </div>
            <div className="p-[22px] bg-krem rounded-b-lg">
              {tampil.length === 0 && <p className="text-tinta-40 text-[14px]">Tidak ada statistik yang ditampilkan.</p>}
              <div className="flex flex-col">
                {tampil.map((s, i) => (
                  <div key={i} className="py-4 border-b border-border last:border-b-0">
                    <div className="font-heading font-semibold text-[30px] leading-none tnum">
                      <span className="text-amber-teks">{s.value || '—'}</span>
                      {s.unit && ` ${s.unit}`}
                    </div>
                    <div className="text-[13px] text-tinta-40 mt-2">{s.caption || 'Keterangan'}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      )}

      <Toast {...toastProps} />
    </>
  );
}

function Field({ label, invalid, children }) {
  return (
    <label className="flex flex-col gap-[6px] text-[13px] font-semibold">
      {label}
      {children}
      {invalid && <span className="text-[12px] font-normal text-critical-teks">{label} wajib diisi.</span>}
    </label>
  );
}

function IconBtn({ label, onClick, disabled, d, danger }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`p-[6px] rounded-sm text-tinta-40 transition-colors disabled:opacity-35 disabled:pointer-events-none ${danger ? 'hover:text-critical-teks hover:bg-critical-bg' : 'hover:text-tinta hover:bg-permukaan-2'}`}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svg} strokeWidth="2">
        <path d={d} />
      </svg>
    </button>
  );
}
