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

const SalesBarChart = lazy(() => import('../../components/SalesBarChart'));

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const PERIODS = [
  { key: '2026-06', label: 'Juni', dari: '2026-06-01', sampai: '2026-06-30' },
  { key: '2026-05', label: 'Mei', dari: '2026-05-01', sampai: '2026-05-31' },
  { key: '2026-04', label: 'April', dari: '2026-04-01', sampai: '2026-04-30' },
  { key: 'all', label: 'Apr–Jun', dari: '2026-04-01', sampai: '2026-06-30' },
];

function periodLabel(key) {
  if (key === 'all') return 'April–Juni 2026';
  const [y, m] = key.split('-');
  return `${MONTHS_FULL[parseInt(m, 10) - 1]} ${y}`;
}
function monthLabel(key) {
  const [, m] = key.split('-');
  return MONTHS[parseInt(m, 10) - 1];
}
const KOSONG = { id: null, tanggal: '', jumlah_liter: '', harga_per_liter: '', pembeli: '' };
const parseNum = (v) => Number(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;

export default function Sales() {
  const { toast, toastProps } = useToast();
  const [period, setPeriod] = useState('2026-06');
  const cur = PERIODS.find((p) => p.key === period);

  const allSales = useApi(() => api.get('/sales'), []);
  const ringkasan = useApi(() => api.get(`/sales/summary?dari=${cur.dari}&sampai=${cur.sampai}`), [period]);
  const total = useApi(() => api.get('/sales/summary'), []);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(KOSONG);
  const [invalid, setInvalid] = useState({});
  const [saving, setSaving] = useState(false);
  const [hapus, setHapus] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const sales = useMemo(() => allSales.data || [], [allSales.data]);

  // Baris untuk periode terpilih (urut tanggal terbaru dulu).
  const rows = useMemo(() => {
    const inRange =
      period === 'all'
        ? sales.filter((s) => s.tanggal >= '2026-04-01' && s.tanggal <= '2026-06-30')
        : sales.filter((s) => s.tanggal.slice(0, 7) === period);
    return inRange.slice().sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
  }, [sales, period]);

  // Agregasi liter per bulan untuk grafik.
  const monthly = useMemo(() => {
    const map = {};
    sales.forEach((s) => {
      const k = s.tanggal.slice(0, 7);
      map[k] = (map[k] || 0) + Number(s.jumlah_liter);
    });
    return Object.keys(map)
      .sort()
      .map((k) => ({ key: k, label: monthLabel(k), liter: Number(map[k].toFixed(1)) }));
  }, [sales]);

  const isDipilih = (k) => (period === 'all' ? k >= '2026-04' && k <= '2026-06' : k === period);

  async function reloadAll() {
    await Promise.all([allSales.reload(), ringkasan.reload(), total.reload()]);
  }

  function openTambah() {
    setForm({ ...KOSONG, tanggal: '2026-06-13' });
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
        { content: <b>Total {periodLabel(period)}</b> },
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
          period={periodLabel(period)}
          value={formatAngka(ringkas?.total_liter)}
          unit="liter"
          sub={ringkas ? `${ringkas.jumlah_transaksi} transaksi pada periode ini` : '—'}
          icon={<path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z" />}
        />
        <SalesSummaryCard
          label="Pendapatan"
          period={periodLabel(period)}
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
        <div className="inline-flex gap-[2px] border border-border bg-permukaan rounded-full p-[3px]">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`text-[13px] font-semibold px-[14px] py-[7px] rounded-full transition-colors ${
                period === p.key ? 'bg-olive text-white' : 'text-tinta-60 hover:text-tinta'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <Reveal delay={60} className="card mb-6">
        <div className="card-hd">
          <div>
            <h3 className="text-[16px] font-semibold">Penjualan per bulan</h3>
            <div className="text-[13px] text-tinta-60">Liter terjual · {periodLabel('all')}</div>
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
          <span className="text-[13px] text-tinta-60">{periodLabel(period)}</span>
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
