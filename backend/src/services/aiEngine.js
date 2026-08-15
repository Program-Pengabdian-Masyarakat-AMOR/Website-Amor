import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultModelDir = resolve(here, '../../models');

const MODEL_SPECS = {
  yield: { file: 'yield_predictor.onnx', features: 10, outputKind: 'linear' },
  feeder: { file: 'feeder_policy.onnx', features: 9, outputKind: 'probability' },
  monthlyHealth: { file: 'monthly_health.onnx', features: 6, outputKind: 'probability' },
};

// Koefisien ini identik dengan model staging hasil training terbaru. Fallback hanya
// dipakai bila onnxruntime/model tidak tersedia, sehingga kontrak fitur tetap sama.
const FALLBACK = {
  yield: {
    w: [-0.5838632826, 1.8355195560, 0.2190617987, 2.7504364291, 2.9134448712, 0.7633867670, -0.2449856201, -1.7120248151, 24.5528398493, -0.4774587045],
    b: 25.1938378397,
    sigmoid: false,
  },
  feeder: {
    w: [0.2261644655, 0.8293994595, 0.5059953095, 1.2822537112, 2.6154055615, 0.3069367649, 0.2337860650, -3.7056611405, 3.3225025231],
    b: -6.4235124889,
    sigmoid: true,
  },
  monthlyHealth: {
    w: [-7.6008106207, -6.0068499577, -3.6441992016, 3.1923927320, 4.2770248665, -1.4035419955],
    b: 13.0970958272,
    sigmoid: true,
  },
};

export const DEFAULT_AI_BANDS = {
  pirolisis: { bawah: 380, atas: 420 },
  tungku: { bawah: 780, atas: 820 },
};

let ort = null;
let ortLoadAttempted = false;
let ortLoadPromise = null;

const sessions = new Map();
const failures = new Map();

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

function fallbackRun(kind, x) {
  const spec = FALLBACK[kind];
  const score = spec.b + spec.w.reduce((sum, w, i) => sum + w * (Number(x[i]) || 0), 0);
  return spec.sigmoid ? sigmoid(score) : score;
}

async function loadOrt() {
  // Runtime sudah berhasil dimuat.
  if (ort) return ort;

  // Ada proses load yang sedang berlangsung.
  // Semua pemanggil harus menunggu Promise yang sama,
  // bukan mengembalikan `ort` yang masih null.
  if (ortLoadPromise) {
    return ortLoadPromise;
  }

  // Jika sebelumnya sudah benar-benar gagal dimuat,
  // pertahankan fallback untuk proses ini.
  if (ortLoadAttempted && failures.has('runtime')) {
    return null;
  }

  ortLoadAttempted = true;

  ortLoadPromise = (async () => {
    try {
      const mod = await import('onnxruntime-node');

      ort = mod.default || mod;
      failures.delete('runtime');

      console.log('[ai] ONNX Runtime Node aktif.');

      return ort;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      failures.set('runtime', message);

      console.warn(
        '[ai] onnxruntime-node belum tersedia — memakai fallback numerik identik dengan model staging.'
      );

      return null;
    } finally {
      ortLoadPromise = null;
    }
  })();

  return ortLoadPromise;
}

function modelDir() {
  return process.env.AI_MODEL_DIR ? resolve(process.env.AI_MODEL_DIR) : defaultModelDir;
}

function modelPath(kind) {
  return resolve(modelDir(), MODEL_SPECS[kind].file);
}

function readModelManifest() {
  const path = resolve(modelDir(), 'model_manifest.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    failures.set('manifest', e.message);
    return { error: e.message };
  }
}

async function getSession(kind) {
  if (sessions.has(kind)) return sessions.get(kind);
  const runtime = await loadOrt();
  if (!runtime) return null;
  const path = modelPath(kind);
  if (!existsSync(path)) {
    failures.set(kind, `Model tidak ditemukan: ${path}`);
    return null;
  }
  try {
    const session = await runtime.InferenceSession.create(path, { executionProviders: ['cpu'] });
    sessions.set(kind, session);
    console.log(`[ai] model ${kind} dimuat: ${path}`);
    return session;
  } catch (e) {
    failures.set(kind, e.message);
    console.error(`[ai] gagal memuat model ${kind}:`, e.message);
    return null;
  }
}

async function infer(kind, features) {
  const spec = MODEL_SPECS[kind];
  if (!spec) throw new Error(`Model AI tidak dikenal: ${kind}`);
  if (!Array.isArray(features) || features.length !== spec.features) {
    throw new Error(`Fitur ${kind} harus berjumlah ${spec.features}.`);
  }
  const clean = features.map((v) => Number.isFinite(Number(v)) ? Number(v) : 0);
  const session = await getSession(kind);
  if (!session || !ort) return { value: fallbackRun(kind, clean), engine: 'fallback' };

  try {
    const tensor = new ort.Tensor('float32', Float32Array.from(clean), [1, spec.features]);
    const outputs = await session.run({ features: tensor });
    const output = outputs.output || outputs[Object.keys(outputs)[0]];
    const value = Number(output?.data?.[0]);
    if (!Number.isFinite(value)) throw new Error('Output ONNX bukan angka valid.');
    return { value, engine: 'onnx' };
  } catch (e) {
    failures.set(`${kind}:inference`, e.message);
    console.error(`[ai] inference ${kind} gagal; fallback dipakai:`, e.message);
    return { value: fallbackRun(kind, clean), engine: 'fallback' };
  }
}

function normalizeBand(band, fallback) {
  const low = Number(band?.bawah);
  const high = Number(band?.atas);
  if (Number.isFinite(low) && Number.isFinite(high) && high > low) return { bawah: low, atas: high };
  return { ...fallback };
}

export function bandCenter(band, fallback = { bawah: 0, atas: 1 }) {
  const b = normalizeBand(band, fallback);
  return (b.bawah + b.atas) / 2;
}

export function bandQuality(value, band, fallback) {
  const b = normalizeBand(band, fallback);
  const v = Number(value) || 0;
  if (v >= b.bawah && v <= b.atas) return 1;
  const half = Math.max((b.atas - b.bawah) / 2, 5);
  const distance = v < b.bawah ? b.bawah - v : v - b.atas;
  return clamp(1 - distance / Math.max(half * 2, 10), 0, 1);
}

/**
 * Yield model setpoint-aware features:
 * 0 input mass / 20 kg
 * 1 absolute pyro temperature normalized from 300..500 C
 * 2 absolute furnace temperature normalized from 500..1000 C
 * 3 pyro compliance to the active operator band
 * 4 furnace compliance to the active operator band
 * 5 active pyro-band center relative to 400 C
 * 6 active furnace-band center relative to 800 C
 * 7 process progress vs 90 min
 * 8 projected oil recovery from current recovery/progress
 * 9 running flag
 */
export async function predictYield({
  inputKg,
  oilKg,
  pyroC,
  furnaceC,
  pyroBand = DEFAULT_AI_BANDS.pirolisis,
  furnaceBand = DEFAULT_AI_BANDS.tungku,
  elapsedMs,
  running = true,
} = {}) {
  const input = Math.max(0, Number(inputKg) || 0);
  const oil = Math.max(0, Number(oilKg) || 0);
  const pyro = Number(pyroC) || 0;
  const furnace = Number(furnaceC) || 0;
  const pBand = normalizeBand(pyroBand, DEFAULT_AI_BANDS.pirolisis);
  const fBand = normalizeBand(furnaceBand, DEFAULT_AI_BANDS.tungku);
  const elapsedMin = Math.max(0, (Number(elapsedMs) || 0) / 60000);
  const progress = clamp(elapsedMin / 90, 0.05, 1.5);
  const currentRecovery = input > 0 ? oil / input : 0;
  const projectedRecovery = clamp(currentRecovery / Math.max(progress, 0.2), 0, 0.8);

  const features = [
    clamp(input / 20, 0, 2),
    clamp((pyro - 300) / 200, -0.5, 1.5),
    clamp((furnace - 500) / 500, -0.5, 1.5),
    bandQuality(pyro, pBand, DEFAULT_AI_BANDS.pirolisis),
    bandQuality(furnace, fBand, DEFAULT_AI_BANDS.tungku),
    clamp((bandCenter(pBand) - 400) / 100, -1.5, 1.5),
    clamp((bandCenter(fBand) - 800) / 200, -1.5, 1.5),
    progress,
    projectedRecovery,
    running ? 1 : 0,
  ];
  const out = await infer('yield', features);
  return {
    predictedYield: Number(clamp(out.value, 0, 90).toFixed(1)),
    engine: out.engine,
    features,
    context: { pyro_band: pBand, furnace_band: fBand },
  };
}

/**
 * Feeder model features are expressed relative to the CURRENT user setpoint band.
 * Online trends are supplied by feederAutomation and later combined with lightweight MPC.
 */
export async function scoreFeeder({
  pyroC,
  furnaceC,
  pyroBand = DEFAULT_AI_BANDS.pirolisis,
  furnaceBand = DEFAULT_AI_BANDS.tungku,
  wasteKg,
  inputKg,
  pyroTrendCPerMin = 0,
  furnaceTrendCPerMin = 0,
  gas,
  running,
} = {}) {
  const pBand = normalizeBand(pyroBand, DEFAULT_AI_BANDS.pirolisis);
  const fBand = normalizeBand(furnaceBand, DEFAULT_AI_BANDS.tungku);
  const pyro = Number(pyroC) || 0;
  const furnace = Number(furnaceC) || 0;
  const pCenter = bandCenter(pBand);
  const fCenter = bandCenter(fBand);
  const pHalf = Math.max((pBand.atas - pBand.bawah) / 2, 5);
  const fHalf = Math.max((fBand.atas - fBand.bawah) / 2, 5);
  const total = Math.max(1, Number(inputKg) || Number(wasteKg) || 1);

  const features = [
    clamp((pCenter - pyro) / pHalf, -2.5, 2.5),
    clamp((pyro - pBand.bawah) / pHalf, -2.5, 3),
    clamp((fCenter - furnace) / fHalf, -2.5, 2.5),
    clamp((furnace - fBand.bawah) / fHalf, -2.5, 3),
    clamp((Number(wasteKg) || 0) / total, 0, 1),
    clamp((Number(pyroTrendCPerMin) || 0) / 5, -2, 2),
    clamp((Number(furnaceTrendCPerMin) || 0) / 10, -2, 2),
    gas === true ? 1 : 0,
    running === true ? 1 : 0,
  ];
  const out = await infer('feeder', features);
  return {
    probability: Number(clamp(out.value, 0, 1).toFixed(4)),
    engine: out.engine,
    features,
    context: { pyro_band: pBand, furnace_band: fBand, pyro_trend_c_per_min: Number(pyroTrendCPerMin) || 0, furnace_trend_c_per_min: Number(furnaceTrendCPerMin) || 0 },
  };
}

/** Monthly health risk model. pyro/furnace quality = adherence to each session's active band. */
export async function scoreMonthlyHealth({ pyroQuality, furnaceQuality, yieldQuality, yieldCv, criticalRate, sessionCountNorm } = {}) {
  const features = [
    clamp(pyroQuality, 0, 1),
    clamp(furnaceQuality, 0, 1),
    clamp(yieldQuality, 0, 1.2),
    clamp(yieldCv, 0, 1),
    clamp(criticalRate, 0, 1),
    clamp(sessionCountNorm, 0, 1),
  ];
  const out = await infer('monthlyHealth', features);
  return { risk: Number(clamp(out.value, 0, 1).toFixed(4)), engine: out.engine, features };
}

export function getAiEngineStatus() {
  return {
    runtime: ort ? 'onnxruntime-node' : ortLoadAttempted ? 'fallback' : 'not-initialized',
    models: Object.fromEntries(Object.keys(MODEL_SPECS).map((k) => [k, {
      path: modelPath(k),
      loaded: sessions.has(k),
      features: MODEL_SPECS[k].features,
      failure: failures.get(k) || failures.get(`${k}:inference`) || null,
    }])),
    runtimeFailure: failures.get('runtime') || null,
    manifest: readModelManifest(),
  };
}

export async function warmupAiEngine() {
  await Promise.all(Object.keys(MODEL_SPECS).map((kind) => getSession(kind)));
  return getAiEngineStatus();
}
