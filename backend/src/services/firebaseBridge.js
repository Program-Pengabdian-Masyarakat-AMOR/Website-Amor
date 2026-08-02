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
let monitoring = {}; // cache mentah node Firebase /monitoring

const num = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v));

// Normalkan status_sistem perangkat → nilai kanonik internal.
function normalizeStatus(raw) {
  const s = String(raw || '').toUpperCase();
  if (s === 'PROCESS' || s === 'RUNNING') return 'running';
  if (s === 'FINISH' || s === 'FINISHED' || s === 'DONE' || s === 'SELESAI') return 'finished';
  return 'idle';
}

function buildTelemetry() {
  return {
    timestamp: new Date().toISOString(),
    suhu_pirolisis: num(monitoring.suhu_pirolisis),
    suhu_tungku: num(monitoring.suhu_tungku),
    berat_sampah: num(monitoring.berat_sampah),
    berat_minyak: num(monitoring.berat_minyak),
    berat_sampah_total: num(monitoring.berat_sampah_total),
    status_gas: Boolean(monitoring.status_gas),
    status_sistem: normalizeStatus(monitoring.status_sistem),
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

// Coalesce update (aman walau node monitoring tunggal): satu emit per perubahan.
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

// Saat status masuk 'finished' (FINISH): catat production log + health + prediksi.
async function handleSessionTransition(t) {
  const now = t.status_sistem;
  const prev = prevStatus;
  prevStatus = now; // set SINKRON sebelum await → cegah pencatatan dobel (race)
  // prev === null → pembacaan pertama; jangan catat (transisi tak teramati),
  // hindari log dobel saat server restart dengan status sudah FINISH.
  if (now === 'finished' && prev !== 'finished' && prev !== null) {
    const sampah = num(monitoring.berat_sampah_total_akhir) || num(monitoring.berat_sampah_total);
    const minyak = num(monitoring.berat_minyak_total_akhir) || num(monitoring.berat_minyak);
    const waktu = Math.round(num(monitoring.waktu_proses));
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

// Semua nilai di node input pakai key DATAR (repo IoT: Firebase.cpp membaca
//   pirolisis_bawah/atas, tungku_bawah/atas). blower/feeder juga key datar
//   (input/blower, input/feeder) — akan dibaca firmware saat fitur ditambahkan.
// Fallback ke struktur bersarang lama agar transisi mulus.
function inputToControl(input) {
  const d = DEFAULT_SETPOINTS;
  return {
    pirolisis: {
      bawah: num(input?.pirolisis_bawah) || num(input?.pirolisis?.suhu_bawah) || d.pirolisis.bawah,
      atas: num(input?.pirolisis_atas) || num(input?.pirolisis?.suhu_atas) || d.pirolisis.atas,
    },
    tungku: {
      bawah: num(input?.tungku_bawah) || num(input?.tungku?.suhu_bawah) || d.tungku.bawah,
      atas: num(input?.tungku_atas) || num(input?.tungku?.suhu_atas) || d.tungku.atas,
    },
    blower: Boolean(input?.blower ?? input?.kontrol?.blower),
    feeder: Boolean(input?.feeder ?? input?.kontrol?.feeder),
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
    // Key datar sesuai firmware.
    await db.ref('input').update({
      pirolisis_bawah: control.pirolisis.bawah,
      pirolisis_atas: control.pirolisis.atas,
      tungku_bawah: control.tungku.bawah,
      tungku_atas: control.tungku.atas,
    });
  }
  return control;
}

export async function setKontrol({ blower, feeder }) {
  if (typeof blower === 'boolean') control.blower = blower;
  if (typeof feeder === 'boolean') control.feeder = feeder;
  // Key datar sesuai gaya node input (input/blower, input/feeder).
  if (db) await db.ref('input').update({ blower: control.blower, feeder: control.feeder });
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

  db.ref('input').get().then(async (snap) => {
    const raw = snap.val() || {};
    control = inputToControl(raw);
    // Migrasi sekali: struktur bersarang lama → key datar sesuai firmware,
    // + buang node kontrol (blower/feeder dikendalikan lokal di alat).
    if (raw.pirolisis || raw.tungku || raw.kontrol) {
      await db.ref('input').update({
        pirolisis_bawah: control.pirolisis.bawah,
        pirolisis_atas: control.pirolisis.atas,
        tungku_bawah: control.tungku.bawah,
        tungku_atas: control.tungku.atas,
      });
      await db.ref('input/pirolisis').remove();
      await db.ref('input/tungku').remove();
      await db.ref('input/kontrol').remove();
      console.log('[bridge] Node input dinormalkan ke key datar (sesuai firmware).');
    }
  });
  db.ref('input').on('value', (snap) => {
    control = inputToControl(snap.val());
  });

  // Semua telemetri kini di satu node: /monitoring.
  db.ref('monitoring').on('value', (snap) => {
    monitoring = snap.val() || {};
    schedulePush();
  });

  console.log('[bridge] Mendengarkan Firebase RTDB (monitoring, input).');
}

// Simulator dev (tanpa Firebase): meniru node /monitoring agar FE tetap hidup.
function startSimulator() {
  let sampah = 6;
  let minyak = 6.5;
  setInterval(() => {
    const pir = Math.round(388 + Math.random() * 30);
    const tun = Math.round(780 + Math.random() * 48);
    const suhuRendah = pir < control.pirolisis.bawah || tun < control.tungku.bawah;
    sampah = Math.max(0, +(sampah - Math.random() * 0.3).toFixed(2));
    minyak = +(minyak + Math.random() * 0.2).toFixed(2);
    monitoring = {
      suhu_pirolisis: pir,
      suhu_tungku: tun,
      berat_sampah: sampah,
      berat_minyak: minyak,
      berat_sampah_total: 15.2,
      berat_sampah_total_akhir: 0,
      berat_minyak_total_akhir: 0,
      waktu_proses: 0,
      status_gas: Math.random() < (suhuRendah ? 0.5 : 0.06),
      status_sistem: 'PROCESS',
    };
    schedulePush();
  }, 3000);
}
