import { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import SalesSummaryCard from '../../components/SalesSummaryCard';
import DataTable from '../../components/DataTable';
import ChartFallback from '../../components/ChartFallback';
import Reveal from '../../components/Reveal';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatAngka, formatRupiah } from '../../lib/format';
import { MONTHS, MONTHS_FULL } from '../../lib/periode';

const SalesBarChart = lazy(() => import('../../components/SalesBarChart'));

const pad = (n) => String(n).padStart(2, '0');

function agregat(rows) {
  return {
    liter: rows.reduce((a, r) => a + Number(r.jumlah_liter), 0),
    pendapatan: rows.reduce((a, r) => a + Number(r.total_harga), 0),
    transaksi: rows.length,
  };
}

function tren(sekarang, lalu) {
  if (!lalu) return sekarang ? 'Belum ada pembanding bulan lalu' : 'Belum ada transaksi';
  const pct = ((sekarang - lalu) / lalu) * 100;
  return `${pct >= 0 ? 'Naik' : 'Turun'} ${formatAngka(Math.abs(pct))}% dari bulan lalu`;
}

// Management: ringkasan penjualan (bulan berjalan, dinamis) + pratinjau data publik.
export default function ManagementHome() {
  const { username } = useAuth();
  const sales = useApi(() => api.get('/sales'), []);
  const konten = useApi(() => api.get('/site-content/landing-stats'), []);

  const now = new Date();
  const tahun = now.getFullYear();
  const bulan = now.getMonth() + 1;
  const kunciBulanIni = `${tahun}-${pad(bulan)}`;
  const tglLalu = new Date(tahun, bulan - 2, 1);
  const kunciBulanLalu = `${tglLalu.getFullYear()}-${pad(tglLalu.getMonth() + 1)}`;

  const data = useMemo(() => {
    const rows = sales.data || [];
    const literPerBulan = Array(12).fill(0);
    const pembeli = {};
    rows.forEach((r) => {
      if (!r.tanggal.startsWith(`${tahun}-`)) return;
      literPerBulan[Number(r.tanggal.slice(5, 7)) - 1] += Number(r.jumlah_liter);
      pembeli[r.pembeli] = (pembeli[r.pembeli] || 0) + Number(r.total_harga);
    });
    return {
      bulanIni: agregat(rows.filter((r) => r.tanggal.startsWith(kunciBulanIni))),
      bulanLalu: agregat(rows.filter((r) => r.tanggal.startsWith(kunciBulanLalu))),
      tahunIni: agregat(rows.filter((r) => r.tanggal.startsWith(`${tahun}-`))),
      semua: agregat(rows),
      chart: literPerBulan.map((v, i) => ({ key: i + 1, label: MONTHS[i], liter: Number(v.toFixed(1)) })),
      terbaru: rows.slice().sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b.id - a.id)).slice(0, 6),
      topPembeli: Object.entries(pembeli).sort((a, b) => b[1] - a[1]).slice(0, 4),
    };
  }, [sales.data, tahun, kunciBulanIni, kunciBulanLalu]);

  const { bulanIni, bulanLalu, tahunIni, semua } = data;
  const labelBulanIni = `${MONTHS_FULL[bulan - 1]} ${tahun}`;

  const columns = [
    { key: 'tgl', header: 'Tanggal', render: (r) => { const [y, m, d] = r.tanggal.split('-'); return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`; } },
    { key: 'pembeli', header: 'Pembeli', render: (r) => r.pembeli },
    { key: 'liter', header: 'Jumlah', align: 'right', cellClass: 'tnum', render: (r) => `${formatAngka(r.jumlah_liter)} L` },
    { key: 'total', header: 'Total', align: 'right', cellClass: 'tnum font-semibold', render: (r) => formatRupiah(r.total_harga) },
  ];

  const statsPublik = (konten.data?.items || []).filter((s) => s.visible !== false);

  return (
    <>
      <Topbar crumb="Management · Dashboard" title={`Halo, ${username || 'management'}`} live />

      <Reveal className="grid grid-cols-3 gap-5 mb-6 max-[1080px]:grid-cols-1">
        <SalesSummaryCard
          label="Pendapatan"
          period={labelBulanIni}
          value={sales.loading ? '…' : formatRupiah(bulanIni.pendapatan)}
          sub={sales.loading ? null : `${formatAngka(bulanIni.liter)} liter · ${bulanIni.transaksi} transaksi · ${tren(bulanIni.pendapatan, bulanLalu.pendapatan)}`}
          icon={<><circle cx="12" cy="12" r="9" /><path d="M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5" /><path d="M12 6.5v11" /></>}
        />
        <SalesSummaryCard
          label="Tahun ini"
          period={String(tahun)}
          value={sales.loading ? '…' : formatAngka(tahunIni.liter)}
          unit="liter"
          sub={sales.loading ? null : `≈ ${formatRupiah(tahunIni.pendapatan)} · ${tahunIni.transaksi} transaksi`}
          icon={<path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z" />}
        />
        <SalesSummaryCard
          variant="accent"
          label="Total keseluruhan · semua periode"
          value={sales.loading ? '…' : formatAngka(semua.liter)}
          unit="liter"
          sub={sales.loading ? null : `≈ ${formatRupiah(semua.pendapatan)} kumulatif`}
          icon={<><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></>}
        />
      </Reveal>

      <div className="grid grid-cols-[1.6fr_1fr] gap-5 items-start max-[1080px]:grid-cols-1">
        <div className="flex flex-col gap-5">
          <Reveal delay={40} className="card">
            <div className="card-hd">
              <div>
                <h3 className="text-[16px] font-semibold">Penjualan per bulan</h3>
                <div className="text-[13px] text-tinta-60">Liter terjual · Januari–Desember {tahun}</div>
              </div>
              <Link to="/dashboard/sales" className="text-[13px] text-amber-teks font-medium hover:underline">Kelola</Link>
            </div>
            <div className="px-5 pt-[18px] pb-[14px]">
              {sales.loading ? (
                <ChartFallback height={230} />
              ) : sales.error ? (
                <div className="h-[230px] grid place-items-center text-critical-teks">Gagal memuat grafik.</div>
              ) : (
                <Suspense fallback={<ChartFallback height={230} />}>
                  <SalesBarChart data={data.chart} isHighlighted={(k) => k === bulan} height={230} />
                </Suspense>
              )}
            </div>
          </Reveal>

          <Reveal delay={80} className="card">
            <div className="card-hd">
              <h3 className="text-[16px] font-semibold">Transaksi terbaru</h3>
              <Link to="/dashboard/sales" className="text-[13px] text-amber-teks font-medium hover:underline">Semua</Link>
            </div>
            <DataTable columns={columns} rows={data.terbaru} loading={sales.loading} error={sales.error} emptyMessage="Belum ada penjualan." />
          </Reveal>
        </div>

        <div className="flex flex-col gap-5">
          <Reveal delay={60} className="card">
            <div className="card-hd">
              <h3 className="text-[16px] font-semibold">Pembeli utama · {tahun}</h3>
            </div>
            <div className="p-[22px] flex flex-col gap-3">
              {!sales.loading && data.topPembeli.length === 0 && <p className="text-tinta-40 text-[14px]">Belum ada transaksi tahun ini.</p>}
              {data.topPembeli.map(([nama, total], i) => (
                <div key={nama} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-olive-lembut text-olive grid place-items-center text-[12.5px] font-bold flex-none">{i + 1}</span>
                  <span className="text-[14px] min-w-0 truncate">{nama}</span>
                  <b className="ml-auto text-[14px] tnum font-semibold">{formatRupiah(total)}</b>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={100} className="card">
            <div className="card-hd">
              <div>
                <h3 className="text-[16px] font-semibold">Data publik di landing page</h3>
                <div className="text-[13px] text-tinta-60">Yang sedang tampil di amor.co.id</div>
              </div>
              <Link to="/dashboard/konten" className="text-[13px] text-amber-teks font-medium hover:underline">Ubah</Link>
            </div>
            <div className="p-[22px] flex flex-col gap-3">
              {konten.loading && <p className="text-tinta-40 text-[14px]">Memuat…</p>}
              {konten.error && <p className="text-critical-teks text-[14px]">Gagal memuat data publik.</p>}
              {statsPublik.map((s, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 border-b border-border last:border-b-0 pb-3 last:pb-0">
                  <span className="text-[13.5px] text-tinta-60">{s.caption}</span>
                  <b className="font-heading text-[20px] font-semibold tnum text-amber-teks whitespace-nowrap">
                    {s.value}
                    {s.unit && <small className="text-[13px] text-tinta-60 font-body"> {s.unit}</small>}
                  </b>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}
