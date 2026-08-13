import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultModelDir = resolve(here, '../../models');

const MODEL_SPECS = {
  yield: { file: 'yield_predictor.onnx', features: 6, outputKind: 'linear' },
  feeder: { file: 'feeder_policy.onnx', features: 5, outputKind: 'probability' },
  monthlyHealth: { file: 'monthly_health.onnx', features: 6, outputKind: 'probability' },
};

const FALLBACK = {
  yield: { w: [2.0, 18.0, 8.0, 5.0, 45.0, 1.0], b: 8.0, sigmoid: false },
  feeder: { w: [2.8, 0.5, 0.6, -5.0, 1.2], b: -1.4, sigmoid: true },
  monthlyHealth: { w: [-1.4, -0.8, -1.2, 1.6, 3.0, -0.1], b: 2.0, sigmoid: true },
};

let ort = null;
let ortLoadAttempted = false;
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
  if (ortLoadAttempted) return ort;
  ortLoadAttempted = true;
  try {
    const mod = await import('onnxruntime-node');
    ort = mod.default || mod;
    console.log('[ai] ONNX Runtime Node aktif.');
  } catch (e) {
    failures.set('runtime', e.message);
    console.warn('[ai] onnxruntime-node belum tersedia — memakai fallback numerik identik dengan model bootstrap.');
  }
  return ort;
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

/**
 * Yield model features (semua sudah dinormalisasi sebelum masuk ONNX):
 * 0 input mass / 20 kg
 * 1 kualitas suhu pirolisis terhadap target 400 C (0..1)
 * 2 kualitas suhu tungku bawah terhadap baseline 800 C (0..1)
 * 3 progress waktu terhadap 90 menit (0..1.5)
 * 4 projected recovery minyak/input berdasarkan progress (0..0.8)
 * 5 running/finished flag
 */
export async function predictYield({ inputKg, oilKg, pyroC, furnaceC, elapsedMs, running = true } = {}) {
  const input = Math.max(0, Number(inputKg) || 0);
  const oil = Math.max(0, Number(oilKg) || 0);
  const elapsedMin = Math.max(0, (Number(elapsedMs) || 0) / 60000);
  const progress = clamp(elapsedMin / 90, 0.05, 1.5);
  const currentRecovery = input > 0 ? oil / input : 0;
  const projectedRecovery = clamp(currentRecovery / Math.max(progress, 0.2), 0, 0.8);
  const features = [
    clamp(input / 20, 0, 2),
    clamp(1 - Math.abs((Number(pyroC) || 0) - 400) / 120, 0, 1),
    clamp(1 - Math.abs((Number(furnaceC) || 0) - 800) / 300, 0, 1),
    progress,
    projectedRecovery,
    running ? 1 : 0,
  ];
  const out = await infer('yield', features);
  return { predictedYield: Number(clamp(out.value, 0, 90).toFixed(1)), engine: out.engine, features };
}

/**
 * Feeder model features:
 * 0 error suhu pirolisis: (400 - Tpirolisis)/100, -1..1
 * 1 panas tungku: (Ttungku - 600)/400, 0..1.5
 * 2 rasio sampah yang masih terbaca terhadap total input, 0..1
 * 3 gas flag
 * 4 running flag
 * Output = probabilitas kebutuhan pulse feeder. Interlock keselamatan ada di
 * feederAutomation.js dan tidak boleh dihilangkan saat model diganti.
 */
export async function scoreFeeder({ pyroC, furnaceC, wasteKg, inputKg, gas, running } = {}) {
  const total = Math.max(1, Number(inputKg) || Number(wasteKg) || 1);
  const features = [
    clamp((400 - (Number(pyroC) || 0)) / 100, -1, 1),
    clamp(((Number(furnaceC) || 0) - 600) / 400, 0, 1.5),
    clamp((Number(wasteKg) || 0) / total, 0, 1),
    gas === true ? 1 : 0,
    running === true ? 1 : 0,
  ];
  const out = await infer('feeder', features);
  return { probability: Number(clamp(out.value, 0, 1).toFixed(4)), engine: out.engine, features };
}

/** Monthly health risk model. Output 0..1; higher = worse. */
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
