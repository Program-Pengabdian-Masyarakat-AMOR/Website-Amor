import { scoreFeeder } from './aiEngine.js';

const VALID_MODES = new Set(['off', 'observe', 'auto']);
let mode = VALID_MODES.has(process.env.AI_FEEDER_MODE) ? process.env.AI_FEEDER_MODE : 'observe';
const threshold = Number(process.env.AI_FEEDER_THRESHOLD) || 0.62;
const evalMs = Math.max(1000, Number(process.env.AI_FEEDER_EVAL_MS) || 5000);
const pulseMs = Math.max(500, Number(process.env.AI_FEEDER_PULSE_MS) || 4000);
const cooldownMs = Math.max(1000, Number(process.env.AI_FEEDER_COOLDOWN_MS) || 20000);
const manualOverrideMs = Math.max(1000, Number(process.env.AI_FEEDER_MANUAL_OVERRIDE_MS) || 300000);
const minFurnaceC = Number(process.env.AI_FEEDER_MIN_FURNACE_C) || 550;
const maxFurnaceC = Number(process.env.AI_FEEDER_MAX_FURNACE_C) || 900;
const pyroTargetC = Number(process.env.AI_PYRO_TARGET_C) || 400;
const pyroHighCutoffC = Number(process.env.AI_PYRO_HIGH_CUTOFF_C) || 415;

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

export function initFeederAutomation({ io, apply, readControl }) {
  ioRef = io;
  applyFeeder = apply;
  getControl = readControl;
  console.log(`[ai-feeder] mode=${mode}, threshold=${threshold}, pulse=${pulseMs}ms, cooldown=${cooldownMs}ms`);
}

export async function setFeederAutomationMode(next) {
  const clean = String(next || '').toLowerCase();
  if (!VALID_MODES.has(clean)) throw new Error('Mode feeder harus off, observe, atau auto.');
  const previousMode = mode;
  mode = clean;
  modeChangedAt = new Date().toISOString();

  // Masuk AUTO selalu dimulai dari state feeder OFF yang diketahui. Ini mencegah
  // feeder manual yang sudah ON sebelum arming dianggap sebagai state AI.
  if (mode === 'auto' && previousMode !== 'auto') {
    manualOverrideUntil = 0;
    const control = getControl?.();
    if (control?.feeder) {
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = null;
      aiPulseActive = false;
      await move(false, { source: 'interlock', reason: `arming auto ${previousMode} -> auto: baseline feeder OFF` });
    }
  }

  // Jika AI sedang menyalakan feeder lalu mode keluar dari auto, feeder harus OFF
  // secara eksplisit. Jangan hanya membatalkan timer karena itu bisa meninggalkan
  // aktuator dalam keadaan ON tanpa jadwal penutupan.
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

function safetyInterlock(t, control) {
  if (t.status_gas === true) return 'gas terdeteksi';
  if (t.status_sistem !== 'running') return 'mesin tidak running';
  if (Number(t.suhu_pirolisis) >= pyroHighCutoffC) return `suhu pirolisis >= ${pyroHighCutoffC}°C`;
  if (Number(t.suhu_tungku) >= maxFurnaceC) return `suhu tungku >= ${maxFurnaceC}°C`;
  if (Number(t.suhu_tungku) < minFurnaceC) return `suhu tungku < ${minFurnaceC}°C`;
  if (control?.pirolisis?.atas && Number(t.suhu_pirolisis) > Number(control.pirolisis.atas)) return 'suhu pirolisis melewati setpoint atas';
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
  lastDecision = { ...decision, timestamp: new Date().toISOString(), mode };
  if (ioRef) ioRef.emit('ai-feeder-decision', lastDecision);
}

export async function evaluateFeederTelemetry(t) {
  const now = Date.now();
  if (evaluating || now - lastEvalAt < evalMs || !applyFeeder || !getControl) return lastDecision;
  evaluating = true;
  lastEvalAt = now;
  try {
    const control = getControl();
    const safety = safetyInterlock(t, control);

    if (mode === 'off') {
      emitDecision({ probability: null, desired: false, action: 'disabled', reason: 'AI feeder mode off', engine: 'none' });
      return lastDecision;
    }

    // Mode observe benar-benar read-only: interlock dan model hanya memberi rekomendasi,
    // tidak menulis apa pun ke Firebase/aktuator.
    if (mode === 'observe' && safety) {
      emitDecision({ probability: 0, desired: false, action: 'observe-interlock', reason: `interlock recommendation: ${safety}`, engine: 'safety' });
      return lastDecision;
    }

    // Pada mode auto, interlock selalu mengalahkan model dan override manual.
    if (mode === 'auto' && safety) {
      emitDecision({ probability: 0, desired: false, action: control.feeder ? 'force-off' : 'hold-off', reason: `interlock: ${safety}`, engine: 'safety' });
      if (control.feeder) {
        if (pulseTimer) clearTimeout(pulseTimer);
        pulseTimer = null;
        aiPulseActive = false;
        await move(false, { source: 'interlock', reason: safety, aiScore: 0, telemetry: t });
      }
      return lastDecision;
    }

    const score = await scoreFeeder({
      pyroC: t.suhu_pirolisis,
      furnaceC: t.suhu_tungku,
      wasteKg: t.berat_sampah,
      inputKg: t.berat_sampah_total,
      gas: t.status_gas,
      running: t.status_sistem === 'running',
    });
    const desired = score.probability >= threshold && Number(t.suhu_pirolisis) < pyroTargetC;
    const overridden = Date.now() < manualOverrideUntil;
    const cooledDown = Date.now() - lastMovementAt >= cooldownMs;

    if (mode !== 'auto') {
      emitDecision({ probability: score.probability, desired, action: 'observe-only', reason: desired ? 'model merekomendasikan pulse' : 'model merekomendasikan hold', engine: score.engine, overridden });
      return lastDecision;
    }

    if (overridden) {
      emitDecision({ probability: score.probability, desired, action: 'manual-override', reason: 'override operator masih aktif', engine: score.engine, overridden: true });
      return lastDecision;
    }

    if (desired && !control.feeder && cooledDown) {
      await move(true, { source: 'ai', reason: `probability ${score.probability} >= ${threshold}`, aiScore: score.probability, telemetry: t });
      aiPulseActive = true;
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => {
        pulseTimer = null;
        if (!aiPulseActive) return;
        aiPulseActive = false;
        move(false, { source: 'ai', reason: `pulse ${pulseMs} ms selesai`, aiScore: score.probability, telemetry: t })
          .catch((e) => console.error('[ai-feeder] gagal menutup pulse:', e.message));
      }, pulseMs);
      emitDecision({ probability: score.probability, desired, action: 'pulse-on', reason: `pulse ${pulseMs} ms`, engine: score.engine, overridden: false });
    } else {
      const reason = !desired ? 'model hold' : control.feeder ? 'pulse sedang aktif' : 'cooldown belum selesai';
      emitDecision({ probability: score.probability, desired, action: 'hold', reason, engine: score.engine, overridden: false });
    }
    return lastDecision;
  } finally {
    evaluating = false;
  }
}

export function getFeederAutomationStatus() {
  return {
    mode,
    threshold,
    eval_ms: evalMs,
    pulse_ms: pulseMs,
    cooldown_ms: cooldownMs,
    manual_override_until: manualOverrideUntil ? new Date(manualOverrideUntil).toISOString() : null,
    min_furnace_c: minFurnaceC,
    max_furnace_c: maxFurnaceC,
    pyro_target_c: pyroTargetC,
    pyro_high_cutoff_c: pyroHighCutoffC,
    mode_changed_at: modeChangedAt,
    actuator_write_enabled: mode === 'auto',
    last_decision: lastDecision,
  };
}
