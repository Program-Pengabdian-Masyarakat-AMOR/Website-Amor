import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import Reveal from '../../components/Reveal';
import { useToast } from '../../hooks/useToast';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const FILTERS = ['Semua', 'Ketua', 'Anggota', 'Operator'];
const JABATAN = ['Ketua', 'Anggota', 'Operator'];

function inisial(nama) {
  return String(nama || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
function monoCls(j) {
  if (j === 'Ketua') return 'bg-amber-lembut text-amber-teks border-[#EAC9AE]';
  if (j === 'Operator') return 'bg-olive-lembut text-olive border-[#D2DCCC]';
  return 'bg-permukaan-2 text-tinta-60 border-border';
}
function badgeCls(j) {
  if (j === 'Ketua') return 'bg-amber-lembut text-amber-teks border-[#EAC9AE]';
  if (j === 'Operator') return 'bg-olive-lembut text-olive border-[#D2DCCC]';
  return 'bg-permukaan-2 text-tinta-60 border-border';
}
function pipCls(j) {
  if (j === 'Ketua') return 'bg-amber';
  if (j === 'Operator') return 'bg-olive';
  return 'bg-tinta-40';
}
const isEmail = (s) => /@/.test(s || '');

const KOSONG_FORM = { id: null, nama: '', nim_nip: '', jabatan: 'Anggota', kontak: '' };

export default function Members() {
  const { data, loading, error, reload } = useApi(() => api.get('/members'), []);
  const { toast, toastProps } = useToast();

  const [filter, setFilter] = useState('Semua');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(KOSONG_FORM);
  const [invalid, setInvalid] = useState({});
  const [saving, setSaving] = useState(false);
  const [hapus, setHapus] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const members = useMemo(() => data || [], [data]);
  const list = useMemo(
    () => (filter === 'Semua' ? members : members.filter((m) => m.jabatan === filter)),
    [members, filter]
  );

  function openTambah() {
    setForm(KOSONG_FORM);
    setInvalid({});
    setFormOpen(true);
  }
  function openUbah(m) {
    setForm({ id: m.id, nama: m.nama, nim_nip: m.nim_nip, jabatan: m.jabatan, kontak: m.kontak });
    setInvalid({});
    setFormOpen(true);
  }

  async function simpan() {
    const inv = {
      nama: !form.nama.trim(),
      nim_nip: !form.nim_nip.trim(),
      kontak: !form.kontak.trim(),
    };
    setInvalid(inv);
    if (inv.nama || inv.nim_nip || inv.kontak) return;

    setSaving(true);
    const payload = {
      nama: form.nama.trim(),
      nim_nip: form.nim_nip.trim(),
      jabatan: form.jabatan,
      kontak: form.kontak.trim(),
    };
    try {
      if (form.id) {
        await api.put(`/members/${form.id}`, payload);
        toast('Perubahan tersimpan.');
      } else {
        await api.post('/members', payload);
        toast('Anggota baru ditambahkan.');
      }
      setFormOpen(false);
      await reload();
    } catch {
      toast('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function konfirmasiHapus() {
    if (!hapus) return;
    setDeleting(true);
    try {
      await api.delete(`/members/${hapus.id}`);
      toast('Anggota dihapus.');
      setHapus(null);
      await reload();
    } catch {
      toast('Gagal menghapus.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-end justify-between gap-[18px] flex-wrap mb-6">
        <div>
          <div className="text-[13px] text-tinta-40 mb-[5px]">Beranda · Anggota</div>
          <h1 className="text-[28px] font-semibold max-md:text-[21px]">Manajemen Anggota</h1>
          <div className="text-[14px] text-tinta-60 mt-[6px]">Tim pelaksana & operator program AMOR.</div>
        </div>
        <button onClick={openTambah} className="btn btn-primary px-[18px] py-[11px] text-[14.5px]">
          <svg viewBox="0 0 24 24" className="w-[17px] h-[17px]" {...svg} strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tambah Anggota
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-[22px] flex-wrap">
        <div className="inline-flex gap-[2px] border border-border bg-permukaan rounded-full p-[3px]">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[13px] font-semibold px-[14px] py-[7px] rounded-full transition-colors ${
                filter === f ? 'bg-olive text-white' : 'text-tinta-60 hover:text-tinta'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-tinta-40 ml-auto">
          {list.length} dari {members.length} anggota
        </span>
      </div>

      {/* Roster */}
      {loading ? (
        <div className="card p-10 text-center text-tinta-40">Memuat anggota…</div>
      ) : error ? (
        <div className="card p-10 text-center text-critical-teks">Gagal memuat data anggota.</div>
      ) : list.length === 0 ? (
        <div className="card p-14 text-center text-tinta-40">
          <svg viewBox="0 0 24 24" className="w-[42px] h-[42px] mx-auto mb-[14px] text-border-kuat" {...svg} strokeWidth="1.4">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          </svg>
          <p>Belum ada anggota pada kategori ini.</p>
        </div>
      ) : (
        <div className="grid gap-[18px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))] max-[420px]:grid-cols-1">
          {list.map((m, i) => (
            <Reveal
              key={m.id}
              delay={Math.min(i, 8) * 45}
              as="article"
              className="bg-permukaan border border-border rounded-lg shadow-1 p-[22px] flex flex-col hover:shadow-2 hover:border-border-kuat transition-all"
            >
              <div className="flex gap-[15px] items-center">
                <div className={`w-[54px] h-[54px] flex-none rounded-full grid place-items-center font-heading text-[19px] font-semibold border ${monoCls(m.jabatan)}`}>
                  {inisial(m.nama)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-[18px] font-semibold leading-tight">{m.nama}</div>
                  <div className="text-[12.5px] text-tinta-40 mt-[3px] tnum">{m.nim_nip}</div>
                  <span className={`inline-flex items-center gap-[6px] px-[10px] py-1 rounded-full text-[12px] font-semibold border mt-[10px] ${badgeCls(m.jabatan)}`}>
                    <span className={`w-[6px] h-[6px] rounded-full ${pipCls(m.jabatan)}`} />
                    {m.jabatan}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-[9px] text-[13.5px] text-tinta-60 mt-4 pt-4 border-t border-border">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-tinta-40 flex-none" {...svg} strokeWidth="1.7">
                  {isEmail(m.kontak) ? (
                    <>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </>
                  ) : (
                    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" />
                  )}
                </svg>
                <span className="truncate">{m.kontak}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => openUbah(m)} className="btn btn-outline btn-sm flex-1 justify-center bg-permukaan">
                  <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" {...svg} strokeWidth="1.8">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                  Ubah
                </button>
                <button onClick={() => setHapus(m)} className="btn btn-ghost btn-sm flex-1 justify-center">
                  <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" {...svg} strokeWidth="1.8">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                  Hapus
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Ubah Anggota' : 'Tambah Anggota'}
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn btn-ghost px-[18px] py-[11px] text-[14.5px]">Batal</button>
            <button onClick={simpan} disabled={saving} className="btn btn-primary px-[18px] py-[11px] text-[14.5px] disabled:opacity-70">
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); simpan(); }} noValidate className="flex flex-col gap-4">
          <Field label="Nama lengkap" required invalid={invalid.nama} errMsg="Nama belum diisi.">
            <input className={`form-input ${invalid.nama ? 'invalid' : ''}`} placeholder="mis. Putri Anggraini" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
            <Field label="NIM / NIP" required invalid={invalid.nim_nip} errMsg="NIM/NIP belum diisi.">
              <input className={`form-input ${invalid.nim_nip ? 'invalid' : ''}`} placeholder="mis. 2021110045" value={form.nim_nip} onChange={(e) => setForm({ ...form, nim_nip: e.target.value })} />
            </Field>
            <Field label="Jabatan">
              <select className="form-select" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })}>
                {JABATAN.map((j) => <option key={j}>{j}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Kontak" required invalid={invalid.kontak} errMsg="Kontak belum diisi.">
            <input className={`form-input ${invalid.kontak ? 'invalid' : ''}`} placeholder="No. WhatsApp atau email" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} />
          </Field>
        </form>
      </Modal>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={Boolean(hapus)}
        onCancel={() => setHapus(null)}
        onConfirm={konfirmasiHapus}
        title="Hapus anggota?"
        loading={deleting}
      >
        Anggota <b className="text-tinta font-semibold">{hapus?.nama}</b> ({hapus?.jabatan}) akan dihapus dari daftar. Tindakan ini tidak bisa dibatalkan.
      </ConfirmDialog>

      <Toast {...toastProps} />
    </>
  );
}

function Field({ label, required, invalid, errMsg, children }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label className="text-[13px] font-semibold">
        {label} {required && <span className="text-amber-teks">*</span>}
      </label>
      {children}
      {invalid && <span className="text-[12px] text-critical-teks">{errMsg}</span>}
    </div>
  );
}
