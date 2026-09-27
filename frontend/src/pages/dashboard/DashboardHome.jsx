import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import HealthStatusBadge from '../../components/HealthStatusBadge';
import ChartFallback from '../../components/ChartFallback';
import Reveal from '../../components/Reveal';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { hitungAlert, statusDariAlert, statusSuhu, DEFAULT_SETPOINTS } from '../../lib/thresholds';
import { formatAngka, formatJam } from '../../lib/format';

const LineChart = lazy(() => import('../../components/LineChart'));

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

const STATUS_UI = {
  normal: { wrap: 'b-normal', ring: 'bg-normal-bg border-normal text-normal', tint: 'from-normal-bg' },
  warning: { wrap: 'b-warning', ring: 'bg-warning-bg border-warning text-warning', tint: 'from-warning-bg' },
  critical: { wrap: 'b-critical', ring: 'bg-critical-bg border-critical text-critical', tint: 'from-critical-bg' },
};

const ICON_ALERT = (
  <>
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.9 2.4 18a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z" />
  </>
);
const ICON_CHECK = <path d="m20 6-11 11-5-5" />;

function sesiLabel(sessionId) {
  return sessionId ? sessionId.replace('SES-', '#') : '—';
}

function CardShell({ title, action, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="card-hd">
        <h3 className="text-[16px] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function DashboardHome() {
  const { username } = useAuth();

  const sensor = useApi(() => api.get('/sensor-data/latest'), []);
  const produksi = useApi(() => api.get('/production-logs'), []);
  const health = useApi(() => api.get('/health-status'), []);
  const kontrol = useApi(() => api.get('/control'), []);
  const [liveLatest, setLiveLatest] = useState(null);
  const [liveControl, setLiveControl] = useState(null);
  const [liveHealth, setLiveHealth] = useState(null);
  const [socketOk, setSocketOk] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onSensor = (payload) => setLiveLatest(payload);
    const onControl = (payload) => setLiveControl(payload);
    const onHealth = (payload) => setLiveHealth(payload);
    const onConnect = () => setSocketOk(true);
    const onDisconnect = () => setSocketOk(false);
    setSocketOk(socket.connected);
    socket.on('sensor-update', onSensor);
    socket.on('control-update', onControl);
    socket.on('health-update', onHealth);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('sensor-update', onSensor);
      socket.off('control-update', onControl);
      socket.off('health-update', onHealth);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const latest = liveLatest || sensor.data?.latest;
  const sesiTerbaru = produksi.data?.[0];

  const controlLive = liveControl || kontrol.data;
  const activeSetpoint = {
    pirolisis: controlLive?.pirolisis || DEFAULT_SETPOINTS.pirolisis,
    tungku: controlLive?.tungku || DEFAULT_SETPOINTS.tungku,
  };
  const setpointSource = controlLive ? 'Setpoint dinamis aktif' : 'Setpoint default';

  const alertsMesin = latest
    ? hitungAlert({
        suhuPirolisis: latest.suhu_pirolisis,
        suhuTungku: latest.suhu_tungku,
        statusGas: latest.status_gas,
        statusSistem: latest.status_sistem,
        setpoint: activeSetpoint,
      })
    : [];
  const status = latest ? statusDariAlert(alertsMesin) : 'normal';
  const ui = STATUS_UI[status];

  const chartData = (produksi.data || [])
    .slice()
    .reverse()
    .map((p) => ({ label: sesiLabel(p.session_id), yield: p.yield_percent }));

  const alerts = (liveHealth ? [liveHealth, ...(health.data?.history || []).filter((r) => r.id !== liveHealth.id)] : health.data?.history || []).slice(0, 4);
  const sp = controlLive;

  return (
    <>
      <Topbar crumb="Beranda · Dashboard" title={`Selamat datang kembali, ${username || 'operator'}`} live={socketOk} />

      <div className="grid grid-cols-[1.62fr_1fr] gap-5 items-start max-[1080px]:grid-cols-1">
        {/* KOLOM KIRI */}
        <div className="flex flex-col gap-5">
          {/* STATUS MESIN */}
          <Reveal className="card overflow-hidden">
            {sensor.loading && !latest ? (
              <div className="px-[26px] py-10 text-tinta-40">Memuat status mesin…</div>
            ) : sensor.error && !latest ? (
              <div className="px-[26px] py-10 text-critical-teks">Gagal memuat status mesin.</div>
            ) : (
              <>
                <div className={`px-[26px] py-6 flex items-start justify-between gap-[18px] bg-gradient-to-b ${ui.tint} to-permukaan`}>
                  <div>
                    <div className="text-[12px] tracking-[.1em] uppercase text-tinta-40 font-semibold">
                      Status mesin terkini
                    </div>
                    <div className="font-heading text-[30px] font-semibold mt-2 mb-1">Reaktor AMOR</div>
                    <div className="text-[14px] text-tinta-60 flex items-center gap-[7px]">
                      <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] text-tinta-40" {...svg} strokeWidth="1.7">
                        <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Rumah Produksi AMOR
                    </div>
                    <div className="mt-[14px]">
                      <HealthStatusBadge status={status} />
                    </div>
                  </div>
                  <div className={`w-[84px] h-[84px] flex-none rounded-full grid place-items-center border-2 ${ui.ring}`}>
                    <svg viewBox="0 0 24 24" className="w-[38px] h-[38px]" {...svg} strokeWidth="1.7">
                      {status === 'normal' ? ICON_CHECK : ICON_ALERT}
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-3 border-t border-border max-[760px]:grid-cols-1">
                  <Reading
                    label="Suhu pirolisis"
                    value={formatAngka(latest.suhu_pirolisis)}
                    unit="°C"
                    sub={`Target ${activeSetpoint.pirolisis.bawah}–${activeSetpoint.pirolisis.atas} °C · ${setpointSource}`}
                    warn={latest.status_sistem === 'running' && statusSuhu(latest.suhu_pirolisis, activeSetpoint.pirolisis) !== 'aman'}
                    icon={<path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />}
                  />
                  <Reading
                    label="Suhu tungku"
                    value={formatAngka(latest.suhu_tungku)}
                    unit="°C"
                    sub={`Target ${activeSetpoint.tungku.bawah}–${activeSetpoint.tungku.atas} °C · ${setpointSource}`}
                    warn={latest.status_sistem === 'running' && statusSuhu(latest.suhu_tungku, activeSetpoint.tungku) !== 'aman'}
                    icon={<path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />}
                  />
                  <Reading
                    label="Status gas"
                    value={latest.status_gas ? 'Terdeteksi' : 'Aman'}
                    sub="Sensor MQ-2"
                    warn={latest.status_gas === true}
                    icon={<><path d="M3 17a9 9 0 0 1 18 0" /><path d="M12 17a3 3 0 0 0 3-3c0-2-3-6-3-6s-3 4-3 6a3 3 0 0 0 3 3z" /></>}
                    last
                  />
                </div>

                <div className="px-[22px] py-[13px] flex items-center justify-between bg-permukaan-2 border-t border-border text-[13px] text-tinta-60">
                  <span className="flex items-center gap-[7px]">
                    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] text-tinta-40" {...svg} strokeWidth="1.7">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    Diperbarui {latest.timestamp ? formatJam(latest.timestamp) : '—'} WIB
                  </span>
                  <span className="capitalize">Sesi {sesiLabel(sesiTerbaru?.session_id)} · {latest.status_sistem}</span>
                </div>
              </>
            )}
          </Reveal>

          {/* TREN PRODUKSI */}
          <Reveal delay={90}>
          <CardShell
            title="Tren produksi · yield per sesi"
            action={<Link to="/dashboard/monitoring" className="text-[13px] text-amber-teks font-medium hover:underline">Lihat semua</Link>}
          >
            <div className="px-5 pt-4 pb-3">
              <div className="text-[13px] text-tinta-60 mb-1">
                {chartData.length} sesi terakhir · target yield 70%
              </div>
              {produksi.loading ? (
                <div className="h-[240px] grid place-items-center text-tinta-40">Memuat grafik…</div>
              ) : produksi.error ? (
                <div className="h-[240px] grid place-items-center text-critical-teks">Gagal memuat grafik.</div>
              ) : (
                <Suspense fallback={<ChartFallback height={240} />}>
                  <LineChart
                    data={chartData}
                    xKey="label"
                    lines={[{ dataKey: 'yield', name: 'Yield', color: '#D9641E', area: true, unit: '%' }]}
                    leftAxis={{ domain: [50, 80] }}
                    referenceY={{ value: 70, label: 'Target 70%', color: '#3A4D39' }}
                    height={240}
                  />
                </Suspense>
              )}
              <div className="flex gap-[18px] text-[12.5px] text-tinta-60 mt-2">
                <span className="inline-flex items-center gap-[7px]">
                  <i className="w-[18px] border-t-[2.5px] border-amber inline-block" />Yield per sesi (%)
                </span>
                <span className="inline-flex items-center gap-[7px]">
                  <i className="w-[18px] border-t-[2.5px] border-dashed border-olive inline-block" />Target 70%
                </span>
              </div>
            </div>
          </CardShell>
          </Reveal>
        </div>

        {/* KOLOM KANAN */}
        <div className="flex flex-col gap-5">
          {/* KONTROL AKTIF */}
          <Reveal delay={40}>
          <CardShell
            title="Kontrol aktif"
            action={<Link to="/dashboard/kontrol" className="text-[13px] text-amber-teks font-medium hover:underline">Atur</Link>}
          >
            <div className="p-[22px] flex flex-col gap-3">
              {kontrol.loading && !sp ? (
                <div className="text-tinta-40">Memuat kontrol…</div>
              ) : kontrol.error && !sp ? (
                <div className="text-critical-teks">Gagal memuat data kontrol.</div>
              ) : (
                <>
                  <KontrolRow label="Setpoint pirolisis" value={`${formatAngka(activeSetpoint.pirolisis.bawah)}–${formatAngka(activeSetpoint.pirolisis.atas)} °C`} />
                  <KontrolRow label="Setpoint tungku" value={`${formatAngka(activeSetpoint.tungku.bawah)}–${formatAngka(activeSetpoint.tungku.atas)} °C`} />
                  <KontrolRow label="Blower" value={sp?.blower ? 'ON' : 'OFF'} on={sp?.blower} />
                  <KontrolRow label="Feeder" value={sp?.feeder ? 'ON' : 'OFF'} on={sp?.feeder} />
                  <KontrolRow label="Alarm gas" value={sp?.alarm !== false ? 'Aktif' : 'Nonaktif'} on={sp?.alarm !== false} />
                  <KontrolRow label="Mode AI feeder" value={String(sp?.ai_feeder?.mode || '—').toUpperCase()} />
                </>
              )}
            </div>
          </CardShell>
          </Reveal>

          {/* ALERT */}
          <Reveal delay={120}>
          <CardShell title="Alert terbaru · Health Check">
            <div className="flex flex-col">
              {health.loading && !liveHealth && <div className="px-[22px] py-8 text-tinta-40">Memuat alert…</div>}
              {!liveHealth && !health.loading && health.error && (
                <div className="px-[22px] py-8 text-critical-teks">Gagal memuat alert.</div>
              )}
              {!health.loading && !health.error && alerts.length === 0 && (
                <div className="px-[22px] py-8 text-tinta-40">Belum ada alert.</div>
              )}
              {(!health.loading || liveHealth) &&
                (!health.error || liveHealth) &&
                alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
            </div>
          </CardShell>
          </Reveal>
        </div>
      </div>
    </>
  );
}

function Reading({ label, value, unit, sub, warn, icon, last }) {
  return (
    <div className={`px-[22px] py-[18px] ${last ? '' : 'border-r border-border max-[760px]:border-r-0 max-[760px]:border-b'}`}>
      <div className="text-[12.5px] text-tinta-40 flex items-center gap-[7px]">
        <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] text-tinta-40" {...svg} strokeWidth="1.7">
          {icon}
        </svg>
        {label}
      </div>
      <div className="font-body font-bold text-[25px] mt-[6px] tnum leading-none">
        {value}
        {unit && <small className="text-[14px] font-semibold text-tinta-60"> {unit}</small>}
      </div>
      <div className={`text-[12px] mt-[6px] ${warn ? 'text-warning-teks font-semibold' : 'text-tinta-40'}`}>{sub}</div>
    </div>
  );
}

function KontrolRow({ label, value, on }) {
  const tone = on === true ? 'text-normal-teks' : on === false ? 'text-tinta-40' : 'text-tinta';
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-[11px] rounded-md border border-border bg-permukaan">
      <span className="text-[13px] text-tinta-60">{label}</span>
      <b className={`text-[14px] font-semibold tnum ${tone}`}>{value}</b>
    </div>
  );
}

function AlertRow({ alert }) {
  const tone =
    alert.status === 'critical'
      ? 'bg-critical-bg text-critical'
      : alert.status === 'warning'
        ? 'bg-warning-bg text-warning'
        : 'bg-normal-bg text-normal';
  return (
    <div className="flex gap-[13px] px-[22px] py-[15px] border-b border-border last:border-b-0">
      <div className={`w-8 h-8 rounded-[9px] flex-none grid place-items-center ${tone}`}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" {...svg} strokeWidth="2">
          {alert.status === 'normal' ? ICON_CHECK : alert.status === 'critical' ? (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </>
          ) : (
            ICON_ALERT
          )}
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-[14px] leading-snug">{alert.keterangan}</div>
        <div className="text-[12.5px] text-tinta-40 mt-[6px] flex items-center gap-2 flex-wrap">
          <HealthStatusBadge status={alert.status} size="sm" />
          {formatJam(alert.created_at)} · Sesi {sesiLabel(alert.session_id)}
        </div>
      </div>
    </div>
  );
}
