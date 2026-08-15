import { bandCenter, scoreFeeder } from './aiEngine.js';

const VALID_MODES = new Set(['off', 'observe', 'auto']);
let mode = VALID_MODES.has(process.env.AI_FEEDER_MODE) ? process.env.AI_FEEDER_MODE : 'observe';
const threshold = Number(process.env.AI_FEEDER_THRESHOLD) || 0.62;
const evalMs = Math.max(1000, Number(process.env.AI_FEEDER_EVAL_MS) || 5000);
const pulseMs = Math.max(500, Number(process.env.AI_FEEDER_PULSE_MS) || 4000);
const cooldownMs = Math.max(1000, Number(process.env.AI_FEEDER_COOLDOWN_MS) || 20000);
const manualOverrideMs = Math.max(1000, Number(process.env.AI_FEEDER_MANUAL_OVERRIDE_MS) || 300000);

// Interlock hardware/commissioning tetap terpisah dari setpoint operator.
const minFurnaceC = Number(process.env.AI_FEEDER_MIN_FURNACE_C) || 550;
const maxFurnaceC = Number(process.env.AI_FEEDER_MAX_FURNACE_C) || 900;
const pyroHighCutoffC = Number(process.env.AI_PYRO_HIGH_CUTOFF_C) || 415;

// Envelope training sintetis. AUTO ditahan bila target berada jauh di luar data model.
const pyroCenterMinC = Number(process.env.AI_PYRO_MODEL_CENTER_MIN_C) || 350;
const pyroCenterMaxC = Number(process.env.AI_PYRO_MODEL_CENTER_MAX_C) || 440;
const furnaceCenterMinC = Number(process.env.AI_FURNACE_MODEL_CENTER_MIN_C) || 700;
const furnaceCenterMaxC = Number(process.env.AI_FURNACE_MODEL_CENTER_MAX_C) || 900;
const maxPyroBandWidthC = Number(process.env.AI_PYRO_MODEL_MAX_BAND_WIDTH_C) || 160;
const maxFurnaceBandWidthC = Number(process.env.AI_FURNACE_MODEL_MAX_BAND_WIDTH_C) || 180;

// Lightweight MPC parameters. These are conservative bootstrap coefficients and MUST
// be commissioned against real machine step-response before production AUTO use.
const mpcHorizonSec = Math.max(5, Number(process.env.AI_MPC_HORIZON_SEC) || 20);
const mpcPyroDropFullPulseC = Math.max(0, Number(process.env.AI_MPC_PYRO_DROP_C) || 3.2);
const mpcFurnaceDropFullPulseC = Math.max(0, Number(process.env.AI_MPC_FURNACE_DROP_C) || 5.0);
const mpcMinImprovement = Math.max(0, Number(process.env.AI_MPC_MIN_IMPROVEMENT) || 0.04);
const trendWindowMs = Math.max(15000, Number(process.env.AI_MPC_TREND_WINDOW_MS) || 60000);

let ioRef = null;
let applyFeeder = null;
let getControl = null;
let lastEvalAt = 0;
let lastMovementAt = 0;
let manualOverrideUntil = 0;
let pulseTimer = null;
let aiPulseActive = false;
let lastDecision = null;
let modeChangedAt = new Date().toISOString();
let evaluating = false;
let trendHistory = [];

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));

export function initFeederAutomation({ io, apply, readControl }) {
  ioRef = io;
  applyFeeder = apply;
  getControl = readControl;
  console.log(`[ai-feeder] mode=${mode}, threshold=${threshold}, pulse<=${pulseMs}ms, cooldown=${cooldownMs}ms, MPC=${mpcHorizonSec}s`);
}

export async function setFeederAutomationMode(next) {
  const clean = String(next || '').toLowerCase();
  if (!VALID_MODES.has(clean)) throw new Error('Mode feeder harus off, observe, atau auto.');
  const previousMode = mode;
  mode = clean;
  modeChangedAt = new Date().toISOString();

  // Masuk AUTO selalu dimulai dari state feeder OFF yang diketahui.
  if (mode === 'auto' && previousMode !== 'auto') {
    manualOverrideUntil = 0;
    const control = getControl?.();
    const calibrationIssue = setpointCalibrationIssue(control);
    if (calibrationIssue) {
      mode = 'observe';
      modeChangedAt = new Date().toISOString();
      throw new Error(`AUTO ditolak: ${calibrationIssue}. Gunakan OBSERVE atau ubah setpoint ke envelope model.`);
    }
    if (control?.feeder) {
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = null;
      aiPulseActive = false;
      await move(false, { source: 'interlock', reason: `arming auto ${previousMode} -> auto: baseline feeder OFF` });
    }
  }

  // Keluar dari AUTO saat pulse AI aktif harus mematikan feeder secara eksplisit.
  if (mode !== 'auto' && aiPulseActive) {
    if (pulseTimer) clearTimeout(pulseTimer);
    pulseTimer = null;
    aiPulseActive = false;
    await move(false, { source: 'ai', reason: `mode feeder ${previousMode} -> ${mode}` });
  }
  const status = getFeederAutomationStatus();
  if (ioRef) ioRef.emit('ai-feeder-mode', status);
  return status;
}

export function registerManualFeederOverride() {
  manualOverrideUntil = Date.now() + manualOverrideMs;
}

function setpointCalibrationIssue(control) {
  const p = control?.pirolisis;
  const f = control?.tungku;
  if (!p || !f) return 'setpoint belum tersedia';
  const pLow = Number(p.bawah); const pHigh = Number(p.atas);
  const fLow = Number(f.bawah); const fHigh = Number(f.atas);
  if (![pLow, pHigh, fLow, fHigh].every(Number.isFinite) || pHigh <= pLow || fHigh <= fLow) return 'setpoint tidak valid';
  const pCenter = (pLow + pHigh) / 2;
  const fCenter = (fLow + fHigh) / 2;
  if (pCenter < pyroCenterMinC || pCenter > pyroCenterMaxC) return `target tengah pirolisis ${pCenter.toFixed(0)}°C di luar envelope ${pyroCenterMinC}–${pyroCenterMaxC}°C`;
  if (pCenter >= pyroHighCutoffC) return `target tengah pirolisis ${pCenter.toFixed(0)}°C harus di bawah hard cutoff ${pyroHighCutoffC}°C agar AUTO dapat mengontrol feeder dengan aman`;
  if (fCenter < furnaceCenterMinC || fCenter > furnaceCenterMaxC) return `target tengah tungku ${fCenter.toFixed(0)}°C di luar envelope ${furnaceCenterMinC}–${furnaceCenterMaxC}°C`;
  if (pHigh - pLow > maxPyroBandWidthC) return `lebar pita pirolisis ${(pHigh - pLow).toFixed(0)}°C melebihi envelope ${maxPyroBandWidthC}°C`;
  if (fHigh - fLow > maxFurnaceBandWidthC) return `lebar pita tungku ${(fHigh - fLow).toFixed(0)}°C melebihi envelope ${maxFurnaceBandWidthC}°C`;
  return null;
}

function safetyInterlock(t, control) {
  if (t.status_gas === true) return 'gas terdeteksi';
  if (t.status_sistem !== 'running') return 'mesin tidak running';
  if (Number(t.suhu_pirolisis) >= pyroHighCutoffC) return `suhu pirolisis >= hard cutoff ${pyroHighCutoffC}°C`;
  if (Number(t.suhu_tungku) >= maxFurnaceC) return `suhu tungku >= ${maxFurnaceC}°C`;
  if (Number(t.suhu_tungku) < minFurnaceC) return `suhu tungku < ${minFurnaceC}°C`;

  const p = control?.pirolisis;
  const f = control?.tungku;
  if (p?.bawah != null && Number(t.suhu_pirolisis) < Number(p.bawah)) return 'suhu pirolisis di bawah setpoint bawah — thermal headroom belum cukup untuk feed';
  if (p?.atas != null && Number(t.suhu_pirolisis) > Number(p.atas)) return 'suhu pirolisis melewati setpoint atas';
  if (f?.bawah != null && Number(t.suhu_tungku) < Number(f.bawah)) return 'suhu tungku di bawah setpoint bawah — feeder ditahan';
  if (f?.atas != null && Number(t.suhu_tungku) > Number(f.atas)) return 'suhu tungku melewati setpoint atas';
  return null;
}

async function move(value, meta) {
  if (!applyFeeder) return;
  const control = getControl?.();
  if (Boolean(control?.feeder) === Boolean(value)) return;
  await applyFeeder(Boolean(value), meta);
  lastMovementAt = Date.now();
}

function emitDecision(decision) {
  const control = getControl?.();
  lastDecision = {
    ...decision,
    timestamp: new Date().toISOString(),
    mode,
    setpoint: control ? {
      pirolisis: { ...control.pirolisis, target: bandCenter(control.pirolisis) },
      tungku: { ...control.tungku, target: bandCenter(control.tungku) },
    } : null,
  };
  if (ioRef) ioRef.emit('ai-feeder-decision', lastDecision);
}

function pushTrendSample(t) {
  // Jangan membawa tren idle/stop ke sesi produksi baru.
  if (t?.status_sistem !== 'running') {
    trendHistory = [];
    return;
  }
  const now = Date.now();
  const pyro = Number(t?.suhu_pirolisis);
  const furnace = Number(t?.suhu_tungku);
  if (!Number.isFinite(pyro) || !Number.isFinite(furnace)) return;
  trendHistory.push({ at: now, pyro, furnace });
  const cutoff = now - trendWindowMs;
  trendHistory = trendHistory.filter((x) => x.at >= cutoff).slice(-30);
}

function linearTrendPerMinute(key) {
  if (trendHistory.length < 2) return 0;
  const firstAt = trendHistory[0].at;
  const xs = trendHistory.map((x) => (x.at - firstAt) / 60000);
  const ys = trendHistory.map((x) => x[key]);
  const meanX = xs.reduce((a, x) => a + x, 0) / xs.length;
  const meanY = ys.reduce((a, y) => a + y, 0) / ys.length;
  let num = 0; let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den <= 1e-9) return 0;
  const raw = num / den;
  return key === 'pyro' ? clamp(raw, -10, 10) : clamp(raw, -20, 20);
}

function currentTrends() {
  return {
    pyro_c_per_min: Number(linearTrendPerMinute('pyro').toFixed(3)),
    furnace_c_per_min: Number(linearTrendPerMinute('furnace').toFixed(3)),
    samples: trendHistory.length,
  };
}

function mpcPlan(t, control, score, trends) {
  const p = control.pirolisis;
  const f = control.tungku;
  const pCenter = bandCenter(p);
  const fCenter = bandCenter(f);
  const pHalf = Math.max((Number(p.atas) - Number(p.bawah)) / 2, 5);
  const fHalf = Math.max((Number(f.atas) - Number(f.bawah)) / 2, 5);
  const horizonMin = mpcHorizonSec / 60;
  const pyroNow = Number(t.suhu_pirolisis) || 0;
  const furnaceNow = Number(t.suhu_tungku) || 0;
  const holdPyro = pyroNow + trends.pyro_c_per_min * horizonMin;
  const holdFurnace = furnaceNow + trends.furnace_c_per_min * horizonMin;
  const total = Math.max(1, Number(t.berat_sampah_total) || Number(t.berat_sampah) || 1);
  const wasteRatio = clamp((Number(t.berat_sampah) || 0) / total, 0, 1);
  const confidence = clamp((Number(score.probability) - threshold) / Math.max(1 - threshold, 0.01), 0, 1);

  const candidates = [0, 0.5, 1].map((factor) => {
    const pyroPred = holdPyro - mpcPyroDropFullPulseC * factor;
    const furnacePred = holdFurnace - mpcFurnaceDropFullPulseC * factor;
    const tracking = ((pyroPred - pCenter) / pHalf) ** 2 + 0.55 * ((furnacePred - fCenter) / fHalf) ** 2;
    let violation = 0;
    if (pyroPred < p.bawah) violation += ((p.bawah - pyroPred) / pHalf) ** 2 * 7;
    if (pyroPred > p.atas) violation += ((pyroPred - p.atas) / pHalf) ** 2 * 4;
    if (furnacePred < f.bawah) violation += ((f.bawah - furnacePred) / fHalf) ** 2 * 8;
    if (furnacePred > f.atas) violation += ((furnacePred - f.atas) / fHalf) ** 2 * 3;
    const throughputReward = (0.85 * wasteRatio + 0.45 * confidence) * factor;
    const effort = 0.10 * factor;
    const cost = tracking + violation + effort - throughputReward;
    return {
      factor,
      pulse_ms: Math.round(pulseMs * factor),
      predicted_pyro_c: Number(pyroPred.toFixed(2)),
      predicted_furnace_c: Number(furnacePred.toFixed(2)),
      cost: Number(cost.toFixed(5)),
    };
  });

  const hold = candidates[0];
  const positive = candidates.slice(1).sort((a, b) => a.cost - b.cost)[0];
  const modelAllowsFeed = Number(score.probability) >= threshold;
  const improved = positive.cost + mpcMinImprovement < hold.cost;
  const chosen = modelAllowsFeed && improved ? positive : hold;

  return {
    strategy: 'lightweight-mpc',
    horizon_sec: mpcHorizonSec,
    score_threshold_passed: modelAllowsFeed,
    improvement: Number((hold.cost - positive.cost).toFixed(5)),
    chosen_factor: chosen.factor,
    pulse_ms: chosen.pulse_ms,
    predicted_pyro_c: chosen.predicted_pyro_c,
    predicted_furnace_c: chosen.predicted_furnace_c,
    hold_prediction: { pyro_c: hold.predicted_pyro_c, furnace_c: hold.predicted_furnace_c },
    candidates,
    bootstrap_coefficients: {
      pyro_drop_full_pulse_c: mpcPyroDropFullPulseC,
      furnace_drop_full_pulse_c: mpcFurnaceDropFullPulseC,
      commissioned: false,
    },
  };
}

export async function evaluateFeederTelemetry(t, { force = false } = {}) {
  pushTrendSample(t);
  const now = Date.now();
  if (evaluating || (!force && now - lastEvalAt < evalMs) || !applyFeeder || !getControl) return lastDecision;
  evaluating = true;
  lastEvalAt = now;
  try {
    const control = getControl();
    const calibrationIssue = setpointCalibrationIssue(control);
    const safety = safetyInterlock(t, control);
    const trends = currentTrends();

    if (mode === 'off') {
      emitDecision({ probability: null, desired: false, action: 'disabled', reason: 'AI feeder mode off', engine: 'none', trends });
      return lastDecision;
    }

    // OBSERVE tetap read-only. Calibration issue dilaporkan, bukan disembunyikan.
    if (mode === 'observe' && (safety || calibrationIssue)) {
      emitDecision({
        probability: 0,
        desired: false,
        action: calibrationIssue ? 'observe-out-of-envelope' : 'observe-interlock',
        reason: calibrationIssue ? `model envelope: ${calibrationIssue}` : `interlock recommendation: ${safety}`,
        engine: calibrationIssue ? 'guard' : 'safety',
        trends,
      });
      return lastDecision;
    }

    // AUTO: calibration envelope dan hard interlock selalu mengalahkan ONNX/MPC.
    const autoGuard = calibrationIssue || safety;
    if (mode === 'auto' && autoGuard) {
      emitDecision({
        probability: 0,
        desired: false,
        action: control.feeder ? 'force-off' : 'hold-off',
        reason: calibrationIssue ? `model envelope: ${calibrationIssue}` : `interlock: ${safety}`,
        engine: calibrationIssue ? 'guard' : 'safety',
        trends,
      });
      if (control.feeder) {
        if (pulseTimer) clearTimeout(pulseTimer);
        pulseTimer = null;
        aiPulseActive = false;
        await move(false, { source: 'interlock', reason: calibrationIssue || safety, aiScore: 0, telemetry: t });
      }
      return lastDecision;
    }

    const score = await scoreFeeder({
      pyroC: t.suhu_pirolisis,
      furnaceC: t.suhu_tungku,
      pyroBand: control.pirolisis,
      furnaceBand: control.tungku,
      wasteKg: t.berat_sampah,
      inputKg: t.berat_sampah_total,
      pyroTrendCPerMin: trends.pyro_c_per_min,
      furnaceTrendCPerMin: trends.furnace_c_per_min,
      gas: t.status_gas,
      running: t.status_sistem === 'running',
    });
    const mpc = mpcPlan(t, control, score, trends);
    const desired = mpc.pulse_ms > 0;
    const overridden = Date.now() < manualOverrideUntil;
    const cooledDown = Date.now() - lastMovementAt >= cooldownMs;

    if (mode !== 'auto') {
      emitDecision({
        probability: score.probability,
        desired,
        action: 'observe-only',
        reason: desired ? `ONNX + MPC merekomendasikan pulse ${(mpc.pulse_ms / 1000).toFixed(1)} s` : 'ONNX + MPC merekomendasikan hold',
        engine: score.engine,
        overridden,
        trends,
        mpc,
      });
      return lastDecision;
    }

    if (overridden) {
      emitDecision({ probability: score.probability, desired, action: 'manual-override', reason: 'override operator masih aktif', engine: score.engine, overridden: true, trends, mpc });
      return lastDecision;
    }

    if (desired && !control.feeder && cooledDown) {
      const plannedPulseMs = Math.max(500, Math.min(pulseMs, mpc.pulse_ms));
      await move(true, {
        source: 'ai',
        reason: `ONNX ${score.probability} + MPC pulse ${plannedPulseMs} ms; target P ${control.pirolisis.bawah}-${control.pirolisis.atas}°C`,
        aiScore: score.probability,
        telemetry: t,
      });
      aiPulseActive = true;
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => {
        pulseTimer = null;
        if (!aiPulseActive) return;
        aiPulseActive = false;
        move(false, { source: 'ai', reason: `MPC pulse ${plannedPulseMs} ms selesai`, aiScore: score.probability, telemetry: t })
          .catch((e) => console.error('[ai-feeder] gagal menutup pulse:', e.message));
      }, plannedPulseMs);
      emitDecision({ probability: score.probability, desired, action: 'pulse-on', reason: `MPC pulse ${plannedPulseMs} ms`, engine: score.engine, overridden: false, trends, mpc });
    } else {
      const reason = !desired ? 'MPC memilih hold' : control.feeder ? 'pulse sedang aktif' : 'cooldown belum selesai';
      emitDecision({ probability: score.probability, desired, action: 'hold', reason, engine: score.engine, overridden: false, trends, mpc });
    }
    return lastDecision;
  } finally {
    evaluating = false;
  }
}

export async function reevaluateFeederTelemetry(t) {
  lastEvalAt = 0;
  return evaluateFeederTelemetry(t, { force: true });
}

export function getFeederAutomationStatus() {
  const control = getControl?.();
  const calibrationIssue = control ? setpointCalibrationIssue(control) : 'control belum siap';
  return {
    mode,
    threshold,
    eval_ms: evalMs,
    pulse_ms_max: pulseMs,
    cooldown_ms: cooldownMs,
    manual_override_until: manualOverrideUntil ? new Date(manualOverrideUntil).toISOString() : null,
    min_furnace_c: minFurnaceC,
    max_furnace_c: maxFurnaceC,
    pyro_high_cutoff_c: pyroHighCutoffC,
    dynamic_setpoint: control ? {
      pirolisis: { ...control.pirolisis, target: bandCenter(control.pirolisis) },
      tungku: { ...control.tungku, target: bandCenter(control.tungku) },
    } : null,
    model_envelope: {
      pyro_target_center_c: [pyroCenterMinC, pyroCenterMaxC],
      furnace_target_center_c: [furnaceCenterMinC, furnaceCenterMaxC],
      max_pyro_band_width_c: maxPyroBandWidthC,
      max_furnace_band_width_c: maxFurnaceBandWidthC,
      valid: !calibrationIssue,
      issue: calibrationIssue,
    },
    mpc: {
      strategy: 'lightweight-mpc',
      horizon_sec: mpcHorizonSec,
      pyro_drop_full_pulse_c: mpcPyroDropFullPulseC,
      furnace_drop_full_pulse_c: mpcFurnaceDropFullPulseC,
      commissioned: false,
    },
    trends: currentTrends(),
    mode_changed_at: modeChangedAt,
    actuator_write_enabled: mode === 'auto',
    last_decision: lastDecision,
  };
}
