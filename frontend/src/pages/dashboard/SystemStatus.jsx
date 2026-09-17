import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import SensorCard from '../../components/SensorCard';
import HealthStatusBadge from '../../components/HealthStatusBadge';
import Reveal from '../../components/Reveal';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { formatAngka, formatJam, formatTanggal } from '../../lib/format';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const POLL_MS = 15000;

const sesiLabel = (id) => (id ? String(id).replace('SES-', '#') : '—');

function durasi(detik) {
  if (detik == null) return '—';
  const s = Math.max(0, Math.round(detik));
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt`;
  const j = Math.floor(m / 60);
  if (j < 24) return `${j} jam ${m % 60} mnt`;
  return `${Math.floor(j / 24)} hari ${j % 24} jam`;
}

function waktu(iso) {
  return iso ? `${formatTanggal(iso)} · ${formatJam(iso)}` : '—';
}

// Admin: kondisi koneksi (Firebase, server, database, AI, socket) + data terkini.
export default function SystemStatus() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [socketOk, setSocketOk] = useState(false);
  const aktif = useRef(true);

  const periksa = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.get('/system/status');
      if (!aktif.current) return;
      setStatus(res);
      setTelemetry((t) => t || res.telemetry);
      setError(null);
    } catch (e) {
      if (aktif.current) setError(e);
    } finally {
      if (aktif.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    aktif.current = true;
    periksa();
    const id = setInterval(periksa, POLL_MS);
    return () => {
      aktif.current = false;
      clearInterval(id);
    };
  }, [periksa]);

  // Telemetri live + status koneksi browser ↔ backend.
  useEffect(() => {
    const socket = getSocket();
    const onSensor = (t) => setTelemetry(t);
    const onConnect = () => setSocketOk(true);
    const onDisconnect = () => setSocketOk(false);
    setSocketOk(socket.connected);
    socket.on('sensor-update', onSensor);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('sensor-update', onSensor);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const fb = status?.firebase;
  const db = status?.database;
  const ai = status?.ai;
  const srv = status?.server;
  const t = telemetry;
  const models = ai ? Object.entries(ai.models) : [];
  const modelOk = models.filter(([, m]) => m.loaded).length;

  return (
    <>
      <Topbar crumb="Admin · Status Sistem" title="Status Sistem & Koneksi" live />

      {/* Ringkasan status */}
      <Reveal className="card overflow-hidden mb-5">
        <div className="px-[22px] py-5 flex items-start gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] tracking-[.1em] uppercase text-tinta-40 font-semibold">Kondisi keseluruhan</div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {status ? <HealthStatusBadge status={status.overall} /> : <span className="text-tinta-40">Memeriksa…</span>}
              {status && (
                <span className="text-[13px] text-tinta-60">
                  Diperiksa {formatJam(status.checked_at)} WIB · otomatis tiap {POLL_MS / 1000} detik
                </span>
              )}
            </div>
            {error && <p className="mt-3 text-[13.5px] text-critical-teks">Backend tidak merespons: {error.message}</p>}
            {status && (
              <ul className="mt-3 flex flex-col gap-[6px]">
                {status.issues.length === 0 && (
                  <li className="text-[13.5px] text-normal-teks">Semua layanan berjalan normal.</li>
                )}
                {status.issues.map((i) => (
                  <li key={i.text} className={`text-[13.5px] flex gap-2 ${i.level === 'critical' ? 'text-critical-teks' : 'text-warning-teks'}`}>
                    <span aria-hidden>•</span>
                    {i.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={periksa} disabled={checking} className="btn btn-outline px-4 py-[9px] text-[14px] disabled:opacity-60">
            <svg viewBox="0 0 24 24" className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} {...svg} strokeWidth="1.9">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            {checking ? 'Memeriksa…' : 'Periksa ulang'}
          </button>
        </div>
      </Reveal>

      {/* Kartu koneksi */}
      <div className="grid grid-cols-2 gap-5 mb-6 max-[900px]:grid-cols-1">
        <StatusCard
          delay={40}
          title="Firebase Realtime Database"
          state={!fb ? null : fb.mode === 'off' ? 'critical' : !fb.connected ? 'critical' : fb.stale ? 'warning' : 'normal'}
          stateLabel={!fb ? null : fb.mode === 'simulator' ? 'Simulator (dev)' : fb.mode === 'off' ? 'Tidak dikonfigurasi' : fb.connected ? 'Tersambung' : 'Terputus'}
          rows={[
            ['Data monitoring terakhir', fb?.last_monitoring_at ? `${durasi(fb.last_monitoring_age_s)} lalu` : 'Belum ada'],
            ['Tulis terakhir (web → IoT)', fb?.last_write_at ? waktu(fb.last_write_at) : 'Belum ada'],
            ['Error tulis terakhir', fb?.last_write_error || 'Tidak ada'],
            ['Tersambung sejak', waktu(fb?.last_connected_at)],
            ['Terputus terakhir', waktu(fb?.last_disconnected_at)],
          ]}
        />
        <StatusCard
          delay={80}
          title="Server backend"
          state={error ? 'critical' : srv ? 'normal' : null}
          stateLabel={error ? 'Tidak merespons' : srv ? 'Berjalan' : null}
          rows={[
            ['Uptime', durasi(srv?.uptime_s)],
            ['Mulai', waktu(srv?.started_at)],
            ['Lingkungan', srv ? `${srv.env} · Node ${srv.node}` : '—'],
            ['Memori', srv ? `${formatAngka(srv.memory_mb)} MB` : '—'],
            ['Koneksi realtime browser', socketOk ? `Tersambung · ${formatAngka(fb?.socket_clients)} klien aktif` : 'Terputus'],
          ]}
        />
        <StatusCard
          delay={120}
          title="Database"
          state={!db ? null : db.ok ? 'normal' : 'critical'}
          stateLabel={!db ? null : db.ok ? `OK · ${db.latency_ms} ms` : 'Gagal'}
          rows={
            db?.ok
              ? [
                  ['Sesi produksi tersimpan', formatAngka(db.counts.production)],
                  ['Riwayat health', formatAngka(db.counts.health)],
                  ['Log gerak feeder', formatAngka(db.counts.feeder)],
                  ['Sesi terakhir', db.last_production ? `${sesiLabel(db.last_production.session_id)} · ${waktu(db.last_production.created_at)}` : 'Belum ada'],
                  ['Akun pengguna', formatAngka(db.counts.users)],
                ]
              : [['Error', db?.error || '—']]
          }
        />
        <StatusCard
          delay={160}
          title="AI engine (ONNX)"
          state={!ai ? null : ai.runtime === 'onnxruntime-node' && modelOk === models.length ? 'normal' : 'warning'}
          stateLabel={!ai ? null : ai.runtime === 'onnxruntime-node' ? 'ONNX aktif' : ai.runtime === 'fallback' ? 'Fallback numerik' : 'Belum siap'}
          rows={[
            ['Model dimuat', ai ? `${modelOk} dari ${models.length}` : '—'],
            ...models.map(([k, m]) => [`Model ${k}`, m.loaded ? 'Dimuat' : m.failure || 'Belum dimuat']),
            ['Mode AI feeder', ai ? String(ai.feeder_mode).toUpperCase() : '—'],
          ]}
        />
      </div>

      {/* Data terkini */}
      <Reveal delay={60} className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-[19px] font-semibold">Data terkini</h2>
          <p className="text-[13px] text-tinta-60">
            {t ? `Diterima ${formatJam(t.timestamp)} WIB · status mesin ${t.status_sistem}` : 'Menunggu telemetri…'}
            {fb?.active_session && ` · sesi berjalan ${sesiLabel(fb.active_session.session_id)} sejak ${formatJam(fb.active_session.started_at)}`}
          </p>
        </div>
        <Link to="/dashboard/rekap" className="text-[13px] text-amber-teks font-medium hover:underline">
          Lihat data lampau & unduh rekap →
        </Link>
      </Reveal>
      <Reveal delay={90} className="grid grid-cols-3 gap-[18px] max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
        <SensorCard live label="Suhu pirolisis" value={t ? formatAngka(t.suhu_pirolisis) : '—'} unit="°C" icon={<path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />} />
        <SensorCard live label="Suhu tungku" value={t ? formatAngka(t.suhu_tungku) : '—'} unit="°C" icon={<path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />} />
        <SensorCard
          live
          tone="olive"
          label="Status gas (MQ-2)"
          icon={<><path d="M3 17a9 9 0 0 1 18 0" /><path d="M12 17a3 3 0 0 0 3-3c0-2-3-6-3-6s-3 4-3 6a3 3 0 0 0 3 3z" /></>}
        >
          <span className={`badge ${t?.status_gas ? 'b-critical' : 'b-normal'} mt-1 self-start`}>
            <span className="pip" />
            {t ? (t.status_gas ? 'Gas terdeteksi' : 'Aman') : '—'}
          </span>
        </SensorCard>
        <SensorCard live tone="olive" label="Berat sampah" value={t ? formatAngka(t.berat_sampah) : '—'} unit="kg" sub={t ? `Total masuk ${formatAngka(t.berat_sampah_total)} kg` : null} icon={<><path d="M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" /><path d="M6.5 7h11l2.5 11a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z" /></>} />
        <SensorCard live label="Berat minyak" value={t ? formatAngka(t.berat_minyak) : '—'} unit="kg" icon={<path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z" />} />
        <SensorCard live label="Prediksi yield (AI)" value={t?.predicted_yield_live != null ? formatAngka(t.predicted_yield_live) : '—'} unit="%" sub="Hanya saat sesi berjalan" icon={<><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></>} />
      </Reveal>
    </>
  );
}

const STATE_DOT = { normal: 'bg-normal', warning: 'bg-warning', critical: 'bg-critical' };

function StatusCard({ title, state, stateLabel, rows, delay }) {
  return (
    <Reveal delay={delay} className="card">
      <div className="card-hd">
        <h3 className="text-[16px] font-semibold">{title}</h3>
        {state ? (
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-tinta-60">
            <span className={`w-[9px] h-[9px] rounded-full ${STATE_DOT[state]}`} />
            {stateLabel}
          </span>
        ) : (
          <span className="text-[13px] text-tinta-40">Memeriksa…</span>
        )}
      </div>
      <dl className="px-[22px] py-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-[9px] border-b border-border last:border-b-0 text-[13.5px]">
            <dt className="text-tinta-60">{k}</dt>
            <dd className="text-right font-medium text-tinta break-words min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}
