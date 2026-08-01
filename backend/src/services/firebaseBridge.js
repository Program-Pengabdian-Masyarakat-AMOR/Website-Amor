import { getDb } from '../config/firebase.js';
import { prisma } from '../lib/prisma.js';
import { hitungAlert, statusDariAlert, DEFAULT_SETPOINTS } from '../lib/thresholds.js';

const MAX_SERIES = 14;

// --- State internal ---
let latest = null; // telemetri terkini (bentuk yang dikirim ke FE)
const series = [];
let control = {
  pirolisis: { ...DEFAULT_SETPOINTS.pirolisis },
  tungku: { ...DEFAULT_SETPOINTS.tungku },
  blower: false,
  feeder: false,
};
let db = null;
let ioRef = null;
let prevStatus = null;

// Cache node Firebase mentah
const cache = { berat: {}, gas: {}, suhu: {}, status: {} };

const num = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v));

function buildTelemetry() {
  return {
    timestamp: new Date().toISOString(),
    suhu_pirolisis: num(cache.suhu.suhu_pirolisis),
    suhu_tungku: num(cache.suhu.suhu_tungku),
    berat_sampah: num(cache.berat.berat_sampah),
    berat_minyak: num(cache.berat.berat_minyak),
    berat_sampah_total: num(cache.berat.berat_sampah_total),
    status_gas: Boolean(cache.gas.status_gas),
    status_sistem: String(cache.status.status_sistem || 'idle').toLowerCase(),
  };
}

function buildHealth(t) {
  const alerts = hitungAlert({
    suhuPirolisis: t.suhu_pirolisis,
    suhuTungku: t.suhu_tungku,
    statusGas: t.status_gas,
    statusSistem: t.status_sistem,
    setpoint: control,
  });
  return {
    id: 'live',
    session_id: 'live',
    status: statusDariAlert(alerts),
    keterangan: alerts.length ? alerts.map((a) => a.pesan).join('; ') : 'Semua parameter dalam batas aman.',
    created_at: new Date().toISOString(),
  };
}

// Beberapa node Firebase bisa berubah nyaris bersamaan; coalesce agar satu
// pembaruan logis = satu emit (mengurangi spam & titik grafik ganda).
let pushTimer = null;
function schedulePush() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    push(buildTelemetry());
  }, 250);
}

function push(t) {
  latest = t;
  series.push(t);
  if (series.length > MAX_SERIES) series.shift();
  if (ioRef) {
    ioRef.emit('sensor-update', t);
    ioRef.emit('health-update', buildHealth(t));
  }
  handleSessionTransition(t).catch((e) => console.error('[bridge] finalize sesi gagal:', e.message));
}

// Saat status running → idle: catat production log + health + prediksi (placeholder ONNX).
async function handleSessionTransition(t) {
  const now = t.status_sistem;
  const wasRunning = prevStatus === 'running';
  prevStatus = now; // set SINKRON sebelum await → cegah pencatatan sesi dobel (race)
  if (wasRunning && now === 'idle') {
    const h = db ? (await db.ref('hasil_akhir').get()).val() || {} : {};
    const sampah = num(h.berat_sampah_total) || t.berat_sampah_total;
    const minyak = num(h.berat_minyak_total) || t.berat_minyak;
    const waktu = Math.round(num(h.waktu_proses));
    const yieldPct = sampah > 0 ? Number(((minyak / sampah) * 100).toFixed(1)) : 0;
    const sessionId = `SES-${Date.now()}`;

    const log = await prisma.productionLog.create({
      data: {
        sessionId,
        beratSampahTotal: sampah,
        beratMinyakTotal: minyak,
        yieldPercent: yieldPct,
        waktuProsesDetik: waktu,
        suhuPirolisisAvg: t.suhu_pirolisis,
        suhuTungkuAvg: t.suhu_tungku,
      },
    });
    const alerts = hitungAlert({ suhuPirolisis: t.suhu_pirolisis, suhuTungku: t.suhu_tungku, statusGas: t.status_gas, statusSistem: 'running', setpoint: control });
    await prisma.healthStatus.create({
      data: {
        sessionId,
        status: statusDariAlert(alerts),
        keterangan: alerts.length ? alerts.map((a) => a.pesan).join('; ') : 'Sesi selesai dalam batas aman.',
      },
    });
    // Prediksi: predictedYield menunggu model ONNX (FASE 2 lanjutan)
    await prisma.prediction.create({ data: { sessionId, predictedYield: null, actualYield: yieldPct } });
    console.log('[bridge] Sesi selesai dicatat:', sessionId, `yield ${yieldPct}%`, `(log #${log.id})`);
  }
}

function inputToControl(input) {
  const d = DEFAULT_SETPOINTS;
  return {
    pirolisis: { bawah: num(input?.pirolisis?.suhu_bawah) || d.pirolisis.bawah, atas: num(input?.pirolisis?.suhu_atas) || d.pirolisis.atas },
    tungku: { bawah: num(input?.tungku?.suhu_bawah) || d.tungku.bawah, atas: num(input?.tungku?.suhu_atas) || d.tungku.atas },
    blower: Boolean(input?.kontrol?.blower),
    feeder: Boolean(input?.kontrol?.feeder),
  };
}

// --- API publik untuk route ---
export function getLatestTelemetry() {
  return latest || buildTelemetry();
}
export function getSeries() {
  return series.slice();
}
export function getCurrentHealth() {
  return buildHealth(getLatestTelemetry());
}
export function getControl() {
  return control;
}

export async function setSetpoint({ pirolisis, tungku }) {
  if (pirolisis) control.pirolisis = { ...control.pirolisis, ...pirolisis };
  if (tungku) control.tungku = { ...control.tungku, ...tungku };
  if (db) {
    await db.ref('input/pirolisis').update({ suhu_bawah: control.pirolisis.bawah, suhu_atas: control.pirolisis.atas });
    await db.ref('input/tungku').update({ suhu_bawah: control.tungku.bawah, suhu_atas: control.tungku.atas });
  }
  return control;
}

export async function setKontrol({ blower, feeder }) {
  if (typeof blower === 'boolean') control.blower = blower;
  if (typeof feeder === 'boolean') control.feeder = feeder;
  if (db) await db.ref('input/kontrol').update({ blower: control.blower, feeder: control.feeder });
  return control;
}

// --- Inisialisasi ---
export function initBridge(io) {
  ioRef = io;
  db = getDb();

  if (!db) {
    console.warn('[bridge] Firebase off — menjalankan simulator telemetri untuk dev.');
    startSimulator();
    return;
  }

  db.ref('input').get().then((snap) => {
    control = inputToControl(snap.val());
  });
  db.ref('input').on('value', (snap) => {
    control = inputToControl(snap.val());
  });

  const bind = (node) =>
    db.ref(node).on('value', (snap) => {
      cache[node] = snap.val() || {};
      schedulePush();
    });
  ['berat', 'gas', 'suhu', 'status'].forEach(bind);

  console.log('[bridge] Mendengarkan Firebase RTDB (berat, gas, suhu, status, input).');
}

// Simulator dev (tanpa Firebase): meniru telemetri agar FE tetap hidup.
function startSimulator() {
  let sampah = 6;
  let minyak = 6.5;
  setInterval(() => {
    const pir = Math.round(388 + Math.random() * 30);
    const tun = Math.round(780 + Math.random() * 48);
    const suhuRendah = pir < control.pirolisis.bawah || tun < control.tungku.bawah;
    sampah = Math.max(0, +(sampah - Math.random() * 0.3).toFixed(2));
    minyak = +(minyak + Math.random() * 0.2).toFixed(2);
    cache.suhu = { suhu_pirolisis: pir, suhu_tungku: tun };
    cache.berat = { berat_sampah: sampah, berat_minyak: minyak, berat_sampah_total: 15.2 };
    cache.gas = { status_gas: Math.random() < (suhuRendah ? 0.5 : 0.06) };
    cache.status = { status_sistem: 'running' };
    schedulePush();
  }, 3000);
}
