import { prisma } from '../lib/prisma.js';
import { predictYield } from './aiEngine.js';
import { hitungAlert, statusDariAlert, DEFAULT_SETPOINTS } from '../lib/thresholds.js';
import { evaluateMonthlyHealth, currentMonthKey } from './monthlyHealth.js';

function validBand(band, fallback) {
  const low = Number(band?.bawah);
  const high = Number(band?.atas);
  if (Number.isFinite(low) && Number.isFinite(high) && high > low) return { bawah: low, atas: high };
  return { ...fallback };
}

export async function upsertPrediction({
  sessionId,
  actualYield,
  inputKg,
  outputKg,
  elapsedMs,
  pyroAvg,
  furnaceAvg,
  pyroBand = DEFAULT_SETPOINTS.pirolisis,
  furnaceBand = DEFAULT_SETPOINTS.tungku,
  predictedYield = null,
} = {}) {
  let prediction = predictedYield;
  let engine = 'live';
  if (!Number.isFinite(Number(prediction))) {
    const out = await predictYield({
      inputKg,
      oilKg: outputKg,
      pyroC: pyroAvg,
      furnaceC: furnaceAvg,
      pyroBand: validBand(pyroBand, DEFAULT_SETPOINTS.pirolisis),
      furnaceBand: validBand(furnaceBand, DEFAULT_SETPOINTS.tungku),
      elapsedMs,
      running: false,
    });
    prediction = out.predictedYield;
    engine = out.engine;
  }

  const existing = await prisma.prediction.findFirst({ where: { sessionId }, orderBy: { id: 'desc' } });
  const data = { predictedYield: Number(prediction), actualYield: Number(actualYield) };
  const row = existing
    ? await prisma.prediction.update({ where: { id: existing.id }, data })
    : await prisma.prediction.create({ data: { sessionId, ...data } });
  return { row, engine };
}

export async function upsertSessionHealth({
  sessionId,
  pyroAvg,
  furnaceAvg,
  pyroBand = DEFAULT_SETPOINTS.pirolisis,
  furnaceBand = DEFAULT_SETPOINTS.tungku,
  gasDetected = false,
} = {}) {
  const setpoint = {
    pirolisis: validBand(pyroBand, DEFAULT_SETPOINTS.pirolisis),
    tungku: validBand(furnaceBand, DEFAULT_SETPOINTS.tungku),
  };
  const alerts = hitungAlert({
    suhuPirolisis: Number(pyroAvg),
    suhuTungku: Number(furnaceAvg),
    statusGas: gasDetected === true,
    statusSistem: 'running',
    setpoint,
  });
  const status = statusDariAlert(alerts);
  const keterangan = alerts.length
    ? alerts.map((a) => a.pesan).join('; ')
    : `Sesi selesai dalam pita aktif: pirolisis ${setpoint.pirolisis.bawah}–${setpoint.pirolisis.atas}°C, tungku ${setpoint.tungku.bawah}–${setpoint.tungku.atas}°C.`;
  const existing = await prisma.healthStatus.findFirst({ where: { sessionId }, orderBy: { id: 'desc' } });
  return existing
    ? prisma.healthStatus.update({ where: { id: existing.id }, data: { status, keterangan } })
    : prisma.healthStatus.create({ data: { sessionId, status, keterangan } });
}

export async function refreshMonthlyHealth(date = new Date()) {
  try {
    return await evaluateMonthlyHealth(currentMonthKey(date));
  } catch (e) {
    console.error('[ai-health] refresh bulanan gagal:', e.message);
    return null;
  }
}
