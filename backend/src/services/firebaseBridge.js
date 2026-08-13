import { getDb } from '../config/firebase.js';
import { prisma } from '../lib/prisma.js';
import { hitungAlert, statusDariAlert, DEFAULT_SETPOINTS } from '../lib/thresholds.js';
import { predictYield } from './aiEngine.js';
import { upsertPrediction, upsertSessionHealth, refreshMonthlyHealth } from './productionAi.js';
import {
  evaluateFeederTelemetry,
  getFeederAutomationStatus,
  initFeederAutomation,
  registerManualFeederOverride,
} from './feederAutomation.js';

const MAX_LOG = 30; // 30 titik rata-rata menit terakhir untuk grafik
const LIVE_PREDICTION_INTERVAL_MS = 5000;

let latest = null;
let minuteSeries = [];
let acc = { pir: 0, tun: 0, berat: 0, n: 0 };
let control = {
  pirolisis: { ...DEFAULT_SETPOINTS.pirolisis },
  tungku: { ...DEFAULT_SETPOINTS.tungku },
  blower: false,
  feeder: false,
  alarm: true,
};
let db = null;
let ioRef = null;
let prevStatus = null;
let monitoring = {};
let activeSession = null;

const num = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v));

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
    // Field baru bersifat additive; FE lama aman mengabaikannya.
    predicted_yield_live: activeSession?.livePrediction?.predictedYield ?? null,
    session_id_live: activeSession?.sessionId ?? null,
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
    session_id: activeSession?.sessionId || 'live',
    status: statusDariAlert(alerts),
    keterangan: alerts.length ? alerts.map((a) => a.pesan).join('; ') : 'Semua parameter dalam batas aman.',
    created_at: new Date().toISOString(),
  };
}

let pushTimer = null;
function schedulePush() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    push(buildTelemetry());
  }, 250);
}

function startSession(t) {
  activeSession = {
    sessionId: `SES-${Date.now()}`,
    startedAt: Date.now(),
    sumPir: 0,
    sumTun: 0,
    n: 0,
    gasSeen: false,
    livePrediction: null,
    lastPredictionAt: 0,
  };
  console.log('[bridge] sesi mulai:', activeSession.sessionId);
  updateSessionStats(t);
}

function updateSessionStats(t) {
  if (!activeSession || t.status_sistem !== 'running') return;
  activeSession.sumPir += num(t.suhu_pirolisis);
  activeSession.sumTun += num(t.suhu_tungku);
  activeSession.n += 1;
  activeSession.gasSeen ||= t.status_gas === true;

  const now = Date.now();
  if (now - activeSession.lastPredictionAt < LIVE_PREDICTION_INTERVAL_MS) return;
  activeSession.lastPredictionAt = now;
  const elapsedMs = now - activeSession.startedAt;
  const avgPir = activeSession.sumPir / Math.max(1, activeSession.n);
  const avgTun = activeSession.sumTun / Math.max(1, activeSession.n);
  const predictionSessionId = activeSession.sessionId;
  predictYield({
    inputKg: t.berat_sampah_total,
    oilKg: t.berat_minyak,
    pyroC: avgPir,
    furnaceC: avgTun,
    elapsedMs,
    running: true,
  })
    .then((prediction) => {
      if (!activeSession || activeSession.sessionId !== predictionSessionId) return;
      activeSession.livePrediction = prediction;
      latest = latest ? { ...latest, predicted_yield_live: prediction.predictedYield, session_id_live: activeSession.sessionId } : latest;
      if (ioRef) ioRef.emit('yield-prediction', {
        session_id: activeSession.sessionId,
        predicted_yield: prediction.predictedYield,
        engine: prediction.engine,
        timestamp: new Date().toISOString(),
      });
    })
    .catch((e) => console.error('[ai-yield] prediksi live gagal:', e.message));
}

async function finalizeSession(t) {
  const session = activeSession || {
    sessionId: `SES-${Date.now()}`,
    startedAt: Date.now(),
    sumPir: num(t.suhu_pirolisis),
    sumTun: num(t.suhu_tungku),
    n: 1,
    gasSeen: t.status_gas === true,
    livePrediction: null,
  };

  // Lepas sesi aktif sebelum operasi DB/AI yang async. Jika firmware sangat cepat
  // masuk PROCESS lagi, sesi baru tidak boleh tercampur dengan sesi FINISH lama.
  if (activeSession?.sessionId === session.sessionId) activeSession = null;

  const sampah = num(monitoring.berat_sampah_total_akhir) || num(monitoring.berat_sampah_total);
  const minyak = num(monitoring.berat_minyak_total_akhir) || num(monitoring.berat_minyak);
  const waktuMs = Math.round(num(monitoring.waktu_proses)) || Math.max(0, Date.now() - session.startedAt);
  const yieldPct = sampah > 0 ? Number(((minyak / sampah) * 100).toFixed(1)) : 0;
  const avgPir = session.n ? session.sumPir / session.n : num(t.suhu_pirolisis);
  const avgTun = session.n ? session.sumTun / session.n : num(t.suhu_tungku);

  let predictedYield = session.livePrediction?.predictedYield;
  if (!Number.isFinite(Number(predictedYield))) {
    const pred = await predictYield({ inputKg: sampah, oilKg: minyak, pyroC: avgPir, furnaceC: avgTun, elapsedMs: waktuMs, running: false });
    predictedYield = pred.predictedYield;
  }

  const log = await prisma.productionLog.create({
    data: {
      sessionId: session.sessionId,
      beratSampahTotal: sampah,
      beratMinyakTotal: minyak,
      yieldPercent: yieldPct,
      waktuProsesDetik: waktuMs, // legacy column name; value is milliseconds
      suhuPirolisisAvg: Number(avgPir.toFixed(2)),
      suhuTungkuAvg: Number(avgTun.toFixed(2)),
    },
  });

  await Promise.all([
    upsertPrediction({
      sessionId: session.sessionId,
      actualYield: yieldPct,
      inputKg: sampah,
      outputKg: minyak,
      elapsedMs: waktuMs,
      pyroAvg: avgPir,
      furnaceAvg: avgTun,
      predictedYield,
    }),
    upsertSessionHealth({ sessionId: session.sessionId, pyroAvg: avgPir, furnaceAvg: avgTun, gasDetected: session.gasSeen }),
  ]);
  await refreshMonthlyHealth(log.createdAt);

  console.log('[bridge] sesi selesai dicatat:', session.sessionId, `yield aktual ${yieldPct}%`, `prediksi ${predictedYield}%`, `(log #${log.id})`);
}

async function handleSessionState(t) {
  const now = t.status_sistem;
  const prev = prevStatus;
  prevStatus = now;

  if (now === 'running') {
    if (!activeSession) startSession(t);
    else updateSessionStats(t);
  }

  // prev=null berarti pembacaan pertama. Jika pertama kali sudah FINISH, jangan
  // catat agar restart server tidak menggandakan sesi.
  if (now === 'finished' && prev !== 'finished' && prev !== null) {
    await finalizeSession(t);
  }

  if (now === 'idle' && prev === 'running') {
    // Perangkat kembali idle tanpa FINISH: jangan buat production log palsu.
    console.warn('[bridge] sesi berubah running -> idle tanpa FINISH; state sesi dibuang.');
    activeSession = null;
  }
}

function push(t) {
  latest = t;
  acc.pir += t.suhu_pirolisis;
  acc.tun += t.suhu_tungku;
  acc.berat += t.berat_sampah;
  acc.n += 1;

  if (ioRef) {
    ioRef.emit('sensor-update', t);
    ioRef.emit('health-update', buildHealth(t));
  }

  handleSessionState(t).catch((e) => console.error('[bridge] state sesi gagal:', e.message));
  evaluateFeederTelemetry(t).catch((e) => console.error('[ai-feeder] evaluasi gagal:', e.message));
}

function flushMinuteLog() {
  if (acc.n === 0) return;
  const point = {
    timestamp: new Date().toISOString(),
    suhu_pirolisis: Math.round(acc.pir / acc.n),
    suhu_tungku: Math.round(acc.tun / acc.n),
    berat_sampah: Number((acc.berat / acc.n).toFixed(1)),
  };
  minuteSeries.push(point);
  if (minuteSeries.length > MAX_LOG) minuteSeries.shift();
  acc = { pir: 0, tun: 0, berat: 0, n: 0 };
  if (ioRef) ioRef.emit('temp-log', point);
}

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
    alarm: input?.alarm !== false,
  };
}

export function getLatestTelemetry() {
  return latest || buildTelemetry();
}
export function getSeries() {
  return minuteSeries.slice();
}
export function getCurrentHealth() {
  return buildHealth(getLatestTelemetry());
}
export function getControl() {
  return { ...control, ai_feeder: getFeederAutomationStatus() };
}

export async function setSetpoint({ pirolisis, tungku }) {
  if (pirolisis) control.pirolisis = { ...control.pirolisis, ...pirolisis };
  if (tungku) control.tungku = { ...control.tungku, ...tungku };
  if (db) {
    await db.ref('input').update({
      pirolisis_bawah: control.pirolisis.bawah,
      pirolisis_atas: control.pirolisis.atas,
      tungku_bawah: control.tungku.bawah,
      tungku_atas: control.tungku.atas,
    });
  }
  return getControl();
}

async function applyFeederState(value, { source = 'manual', reason = 'perintah operator', aiScore = null, telemetry = null } = {}) {
  const desired = Boolean(value);
  if (control.feeder === desired) return getControl();
  control.feeder = desired;
  if (db) await db.ref('input').update({ feeder: desired });

  const t = telemetry || getLatestTelemetry();
  try {
    const log = await prisma.feederMovement.create({
      data: {
        action: desired ? 'on' : 'off',
        source,
        reason: String(reason || ''),
        suhuPirolisis: Number.isFinite(Number(t?.suhu_pirolisis)) ? Number(t.suhu_pirolisis) : null,
        suhuTungku: Number.isFinite(Number(t?.suhu_tungku)) ? Number(t.suhu_tungku) : null,
        beratSampah: Number.isFinite(Number(t?.berat_sampah)) ? Number(t.berat_sampah) : null,
        aiScore: Number.isFinite(Number(aiScore)) ? Number(aiScore) : null,
      },
    });
    const dto = {
      id: log.id,
      action: log.action,
      source: log.source,
      reason: log.reason,
      suhu_pirolisis: log.suhuPirolisis,
      suhu_tungku: log.suhuTungku,
      berat_sampah: log.beratSampah,
      ai_score: log.aiScore,
      created_at: log.createdAt,
    };
    if (ioRef) ioRef.emit('feeder-movement', dto);
    console.log(`[feeder] ${desired ? 'ON' : 'OFF'} (${source}) — ${reason}`);
  } catch (e) {
    console.error('[feeder] state berubah tetapi log DB gagal:', e.message);
  }
  return getControl();
}

export async function setKontrol({ blower, feeder, alarm }) {
  if (typeof blower === 'boolean') control.blower = blower;
  if (typeof alarm === 'boolean') control.alarm = alarm;
  if (typeof feeder === 'boolean') {
    registerManualFeederOverride();
    await applyFeederState(feeder, { source: 'manual', reason: 'perintah operator dari web' });
  }
  if (db) {
    const patch = {};
    if (typeof blower === 'boolean') patch.blower = control.blower;
    if (typeof alarm === 'boolean') patch.alarm = control.alarm;
    if (Object.keys(patch).length) await db.ref('input').update(patch);
  }
  return getControl();
}

export function initBridge(io) {
  ioRef = io;
  db = getDb();
  initFeederAutomation({ io, apply: applyFeederState, readControl: () => control });

  setInterval(flushMinuteLog, 60000);

  if (!db) {
    console.warn('[bridge] Firebase off — menjalankan simulator telemetri untuk dev.');
    startSimulator();
    return;
  }

  db.ref('input').get().then(async (snap) => {
    const raw = snap.val() || {};
    control = inputToControl(raw);
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

  db.ref('monitoring').on('value', (snap) => {
    monitoring = snap.val() || {};
    schedulePush();
  });

  console.log('[bridge] Mendengarkan Firebase RTDB (monitoring, input).');
}

function startSimulator() {
  let sampah = 6;
  let minyak = 0.2;
  let tick = 0;
  setInterval(() => {
    tick += 1;
    const pir = Math.round(388 + Math.random() * 30);
    const tun = Math.round(760 + Math.random() * 70);
    const suhuRendah = pir < control.pirolisis.bawah || tun < control.tungku.bawah;
    sampah = Math.max(0, +(sampah - Math.random() * 0.08).toFixed(2));
    minyak = +(minyak + Math.random() * 0.05).toFixed(2);
    monitoring = {
      suhu_pirolisis: pir,
      suhu_tungku: tun,
      berat_sampah: sampah,
      berat_minyak: minyak,
      berat_sampah_total: 15.2,
      berat_sampah_total_akhir: 0,
      berat_minyak_total_akhir: 0,
      waktu_proses: 0,
      status_gas: Math.random() < (suhuRendah ? 0.08 : 0.01),
      status_sistem: 'PROCESS',
    };
    // Simulator sengaja tidak FINISH otomatis agar tidak membanjiri DB saat dev.
    schedulePush();
  }, 3000);
}
