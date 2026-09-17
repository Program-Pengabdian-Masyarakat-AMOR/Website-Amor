import { lazy, Suspense, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import SalesSummaryCard from '../../components/SalesSummaryCard';
import DataTable from '../../components/DataTable';
import ChartFallback from '../../components/ChartFallback';
import Reveal from '../../components/Reveal';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { formatAngka, formatRupiah } from '../../lib/format';
import { MONTHS, MONTHS_FULL, rentangPeriode, labelPeriode, tanggalHariIni } from '../../lib/periode';

const SalesBarChart = lazy(() => import('../../components/SalesBarChart'));

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const KOSONG = { id: null, tanggal: '', jumlah_liter: '', harga_per_liter: '', pembeli: '' };
const parseNum = (v) => Number(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;

export default function Sales() {
  const { toast, toastProps } = useToast();
  // Periode dinamis: tahun + bulan (1–12) atau 'all' untuk setahun penuh.
  // Default = bulan berjalan, jadi data bulan baru langsung terlihat tanpa ubah kode.
  const sekarang = new Date();
  const [tahun, setTahun] = useState(sekarang.getFullYear());
  const [bulan, setBulan] = useState(sekarang.getMonth() + 1);
  const { dari, sampai, prefix } = rentangPeriode(tahun, bulan);
  const periodeLabel = labelPeriode(tahun, bulan);

  const allSales = useApi(() => api.get('/sales'), []);
  const ringkasan = useApi(() => api.get(`/sales/summary?dari=${dari}&sampai=${sampai}`), [dari, sampai]);
  const total = useApi(() => api.get('/sales/summary'), []);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(KOSONG);
  const [invalid, setInvalid] = useState({});
  const [saving, setSaving] = useState(false);
  const [hapus, setHapus] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const sales = useMemo(() => allSales.data || [], [allSales.data]);

  // Pilihan tahun = tahun yang punya transaksi + tahun berjalan.
  const daftarTahun = useMemo(() => {
    const set = new Set([sekarang.getFullYear(), tahun]);
    sales.forEach((s) => set.add(Number(s.tanggal.slice(0, 4))));
    return [...set].filter(Number.isFinite).sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, tahun]);

  // Baris untuk periode terpilih (urut tanggal terbaru dulu).
  const rows = useMemo(
    () => sales.filter((s) => s.tanggal.startsWith(prefix)).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)),
    [sales, prefix]
  );

  // Liter per bulan (Jan–Des) untuk tahun terpilih; bulan tanpa transaksi = 0.
  const monthly = useMemo(() => {
    const liter = Array(12).fill(0);
    sales.forEach((s) => {
      if (!s.tanggal.startsWith(`${tahun}-`)) return;
      liter[Number(s.tanggal.slice(5, 7)) - 1] += Number(s.jumlah_liter);
    });
    return liter.map((v, i) => ({ key: i + 1, label: MONTHS[i], liter: Number(v.toFixed(1)) }));
  }, [sales, tahun]);

  const isDipilih = (k) => bulan === 'all' || k === bulan;

  async function reloadAll() {
    await Promise.all([allSales.reload(), ringkasan.reload(), total.reload()]);
  }

  function openTambah() {
    setForm({ ...KOSONG, tanggal: tanggalHariIni() });
    setInvalid({});
    setFormOpen(true);
  }
  function openUbah(s) {
    setForm({
      id: s.id,
      tanggal: s.tanggal,
      jumlah_liter: String(s.jumlah_liter).replace('.', ','),
      harga_per_liter: String(s.harga_per_liter),
      pembeli: s.pembeli,
    });
    setInvalid({});
    setFormOpen(true);
  }

  const literNum = parseNum(form.jumlah_liter);
  const hargaNum = parseNum(form.harga_per_liter);
  const autoTotal = literNum * hargaNum;

  async function simpan() {
    const inv = {
      tanggal: !form.tanggal,
      jumlah_liter: !(literNum > 0),
      harga_per_liter: !(hargaNum > 0),
      pembeli: !form.pembeli.trim(),
    };
    setInvalid(inv);
    if (Object.values(inv).some(Boolean)) return;

    setSaving(true);
    const payload = {
      tanggal: form.tanggal,
      jumlah_liter: literNum,
      harga_per_liter: hargaNum,
      pembeli: form.pembeli.trim(),
    };
    try {
      if (form.id) {
        await api.put(`/sales/${form.id}`, payload);
        toast('Perubahan tersimpan.');
      } else {
        await api.post('/sales', payload);
        toast('Penjualan dicatat.');
      }
      setFormOpen(false);
      await reloadAll();
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
      await api.delete(`/sales/${hapus.id}`);
      toast('Catatan dihapus.');
      setHapus(null);
      await reloadAll();
    } catch {
      toast('Gagal menghapus.');
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    { key: 'tanggal', header: 'Tanggal', headClass: 'w-[130px]', render: (r) => formatTanggalSingkat(r.tanggal) },
    { key: 'liter', header: 'Jumlah', align: 'right', cellClass: 'tnum', render: (r) => `${formatAngka(r.jumlah_liter)} L` },
    { key: 'harga', header: 'Harga / liter', align: 'right', cellClass: 'tnum', render: (r) => formatRupiah(r.harga_per_liter) },
    { key: 'total', header: 'Total', align: 'right', cellClass: 'tnum font-semibold', render: (r) => formatRupiah(r.total_harga) },
    { key: 'pembeli', header: 'Pembeli', render: (r) => r.pembeli },
    {
      key: 'aksi',
      header: 'Aksi',
      align: 'right',
      headClass: 'w-[96px]',
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <button onClick={() => openUbah(r)} aria-label="Ubah" className="p-[7px] rounded-sm text-tinta-40 hover:text-amber-teks hover:bg-permukaan-2 transition-colors">
            <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" {...svg} strokeWidth="1.8">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
          <button onClick={() => setHapus(r)} aria-label="Hapus" className="p-[7px] rounded-sm text-tinta-40 hover:text-critical-teks hover:bg-critical-bg transition-colors">
            <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" {...svg} strokeWidth="1.8">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  const footer = rows.length
    ? [
        { content: <b>Total {periodeLabel}</b> },
        { content: <b>{formatAngka(rows.reduce((a, r) => a + Number(r.jumlah_liter), 0))} L</b>, align: 'right', className: 'tnum' },
        { content: '' },
        { content: <b>{formatRupiah(rows.reduce((a, r) => a + Number(r.total_harga), 0))}</b>, align: 'right', className: 'tnum' },
        { content: `${rows.length} transaksi` },
        { content: '' },
      ]
    : undefined;

  const ringkas = ringkasan.data;
  const hargaRata = ringkas && ringkas.total_liter ? ringkas.total_pendapatan / ringkas.total_liter : 0;

  return (
    <>
      <div className="flex items-end justify-between gap-[18px] flex-wrap mb-6">
        <div>
          <div className="text-[13px] text-tinta-40 mb-[5px]">Beranda · Penjualan</div>
          <h1 className="text-[28px] font-semibold max-md:text-[21px]">Penjualan Minyak</h1>
          <div className="text-[14px] text-tinta-60 mt-[6px]">Catatan penjualan hasil olahan Reaktor AMOR.</div>
        </div>
        <button onClick={openTambah} className="btn btn-primary px-[18px] py-[11px] text-[14.5px]">
          <svg viewBox="0 0 24 24" className="w-[17px] h-[17px]" {...svg} strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Catat Penjualan
        </button>
      </div>

      {/* Summary */}
      <Reveal className="grid grid-cols-3 gap-5 mb-6 max-[1080px]:grid-cols-1">
        <SalesSummaryCard
          label="Liter terjual"
          period={periodeLabel}
          value={formatAngka(ringkas?.total_liter)}
          unit="liter"
          sub={ringkas ? `${ringkas.jumlah_transaksi} transaksi pada periode ini` : '—'}
          icon={<path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z" />}
        />
        <SalesSummaryCard
          label="Pendapatan"
          period={periodeLabel}
          value={formatRupiah(ringkas?.total_pendapatan)}
          sub={hargaRata ? `Harga rata-rata ${formatRupiah(hargaRata)} / liter` : 'Belum ada transaksi'}
          icon={<><circle cx="12" cy="12" r="9" /><path d="M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5" /><path d="M12 6.5v11" /></>}
        />
        <SalesSummaryCard
          variant="accent"
          label="Total keseluruhan · semua periode"
          value={formatAngka(total.data?.total_liter)}
          unit="liter"
          sub={`≈ ${formatRupiah(total.data?.total_pendapatan)} kumulatif`}
          icon={<><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></>}
        />
      </Reveal>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-[22px] flex-wrap">
        <span className="text-[13px] text-tinta-60 font-semibold">Periode:</span>
        <select
          aria-label="Tahun"
          value={tahun}
          onChange={(e) => setTahun(Number(e.target.value))}
          className="form-select !w-auto !py-[7px] text-[13px] font-semibold"
        >
          {daftarTahun.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div className="inline-flex flex-wrap gap-[2px] border border-border bg-permukaan rounded-[20px] p-[3px] max-w-full">
          {[['all', 'Setahun'], ...MONTHS.map((m, i) => [i + 1, m])].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setBulan(key)}
              title={key === 'all' ? `Januari–Desember ${tahun}` : `${MONTHS_FULL[key - 1]} ${tahun}`}
              className={`text-[13px] font-semibold px-[12px] py-[7px] rounded-full transition-colors ${
                bulan === key ? 'bg-olive text-white' : 'text-tinta-60 hover:text-tinta'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <Reveal delay={60} className="card mb-6">
        <div className="card-hd">
          <div>
            <h3 className="text-[16px] font-semibold">Penjualan per bulan</h3>
            <div className="text-[13px] text-tinta-60">Liter terjual · Januari–Desember {tahun}</div>
          </div>
          <div className="flex gap-[18px] text-[12.5px] text-tinta-60">
            <span className="inline-flex items-center"><i className="w-3 h-3 rounded-sm bg-amber inline-block mr-[7px]" />Periode dipilih</span>
            <span className="inline-flex items-center"><i className="w-3 h-3 rounded-sm bg-olive-lembut border border-[#D2DCCC] inline-block mr-[7px]" />Bulan lain</span>
          </div>
        </div>
        <div className="px-5 pt-[18px] pb-[14px]">
          {allSales.loading ? (
            <ChartFallback height={240} />
          ) : allSales.error ? (
            <div className="h-[240px] grid place-items-center text-critical-teks">Gagal memuat grafik.</div>
          ) : (
            <Suspense fallback={<ChartFallback height={240} />}>
              <SalesBarChart data={monthly} isHighlighted={isDipilih} height={240} />
            </Suspense>
          )}
        </div>
      </Reveal>

      {/* Table */}
      <Reveal delay={90} className="card">
        <div className="card-hd">
          <h3 className="text-[16px] font-semibold">Riwayat penjualan</h3>
          <span className="text-[13px] text-tinta-60">{periodeLabel}</span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          footer={footer}
          loading={allSales.loading}
          error={allSales.error}
          emptyMessage="Belum ada penjualan pada periode ini."
        />
      </Reveal>

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Ubah Penjualan' : 'Catat Penjualan'}
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
          <Field label="Tanggal" required invalid={invalid.tanggal} errMsg="Tanggal belum diisi.">
            <input type="date" className={`form-input ${invalid.tanggal ? 'invalid' : ''}`} value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
            <Field label="Jumlah liter" required invalid={invalid.jumlah_liter} errMsg="Jumlah liter belum benar.">
              <input className={`form-input tnum ${invalid.jumlah_liter ? 'invalid' : ''}`} inputMode="decimal" placeholder="mis. 14,0" value={form.jumlah_liter} onChange={(e) => setForm({ ...form, jumlah_liter: e.target.value })} />
            </Field>
            <Field label="Harga / liter" required invalid={invalid.harga_per_liter} errMsg="Harga belum benar.">
              <div className="relative flex items-center">
                <span className="absolute left-[13px] text-tinta-40 text-[14px]">Rp</span>
                <input className={`form-input tnum !pl-9 ${invalid.harga_per_liter ? 'invalid' : ''}`} inputMode="numeric" placeholder="6.000" value={form.harga_per_liter} onChange={(e) => setForm({ ...form, harga_per_liter: e.target.value })} />
              </div>
            </Field>
          </div>
          <Field label="Pembeli" required invalid={invalid.pembeli} errMsg="Pembeli belum diisi.">
            <input className={`form-input ${invalid.pembeli ? 'invalid' : ''}`} list="pembeliList" placeholder="Nama pembeli / pengepul" value={form.pembeli} onChange={(e) => setForm({ ...form, pembeli: e.target.value })} />
            <datalist id="pembeliList">
              <option value="Pengepul Pak Hadi" />
              <option value="Bengkel Las Jaya" />
              <option value="Koperasi Tani Makmur" />
              <option value="Warga RW 04" />
            </datalist>
          </Field>
          <div className="flex items-center justify-between bg-permukaan-2 border border-border rounded-md px-4 py-3">
            <span className="text-[13px] text-tinta-60">Total otomatis</span>
            <span className="font-body font-bold text-[18px] tnum text-amber-teks">{formatRupiah(autoTotal)}</span>
          </div>
        </form>
      </Modal>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={Boolean(hapus)}
        onCancel={() => setHapus(null)}
        onConfirm={konfirmasiHapus}
        title="Hapus catatan?"
        loading={deleting}
      >
        Catatan penjualan <b className="text-tinta font-semibold">{hapus ? `${formatAngka(hapus.jumlah_liter)} L` : ''}</b> ke {hapus?.pembeli} akan dihapus. Tindakan ini tidak bisa dibatalkan.
      </ConfirmDialog>

      <Toast {...toastProps} />
    </>
  );
}

function formatTanggalSingkat(d) {
  const [y, m, day] = d.split('-');
  return `${parseInt(day, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
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
