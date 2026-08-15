import { prisma } from '../lib/prisma.js';
import { bandQuality, scoreMonthlyHealth } from './aiEngine.js';
import { DEFAULT_SETPOINTS } from '../lib/thresholds.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));

function monthBounds(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
  if (!match) throw new Error('month harus berformat YYYY-MM');
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) throw new Error('month tidak valid');
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function bandFromLog(log, kind) {
  if (kind === 'pirolisis') {
    const low = Number(log.pirolisisSetpointBawah);
    const high = Number(log.pirolisisSetpointAtas);
    if (Number.isFinite(low) && Number.isFinite(high) && high > low) return { bawah: low, atas: high };
    return DEFAULT_SETPOINTS.pirolisis;
  }
  const low = Number(log.tungkuSetpointBawah);
  const high = Number(log.tungkuSetpointAtas);
  if (Number.isFinite(low) && Number.isFinite(high) && high > low) return { bawah: low, atas: high };
  return DEFAULT_SETPOINTS.tungku;
}

function tempFromLog(log, kind) {
  if (kind === 'pirolisis') {
    const filtered = Number(log.suhuPirolisisFiltered);
    if (Number.isFinite(filtered)) return filtered;
    const avg = Number(log.suhuPirolisisAvg);
    return Number.isFinite(avg) ? avg : null;
  }
  const filtered = Number(log.suhuTungkuFiltered);
  if (Number.isFinite(filtered)) return filtered;
  const avg = Number(log.suhuTungkuAvg);
  return Number.isFinite(avg) ? avg : null;
}

export function currentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function evaluateMonthlyHealth(monthKey = currentMonthKey()) {
  const { start, end } = monthBounds(monthKey);
  const logs = await prisma.productionLog.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'asc' },
  });
  if (!logs.length) return null;

  const sessionIds = logs.map((x) => x.sessionId);
  const healthRows = await prisma.healthStatus.findMany({ where: { sessionId: { in: sessionIds } } });

  const inputKg = logs.reduce((a, x) => a + Number(x.beratSampahTotal || 0), 0);
  const outputKg = logs.reduce((a, x) => a + Number(x.beratMinyakTotal || 0), 0);
  const weightedYield = inputKg > 0 ? (outputKg / inputKg) * 100 : 0;
  const yields = logs.map((x) => Number(x.yieldPercent || 0));
  const meanYield = yields.reduce((a, x) => a + x, 0) / yields.length;
  const variance = yields.reduce((a, x) => a + (x - meanYield) ** 2, 0) / yields.length;
  const yieldCv = meanYield > 0 ? Math.sqrt(variance) / meanYield : 1;

  // Setiap sesi dibandingkan dengan pita yang aktif pada sesi itu. Data lama tanpa
  // snapshot setpoint memakai default lama agar tetap backward-compatible.
  let weightedPyroQuality = 0;
  let weightedFurnaceQuality = 0;
  let qualityWeight = 0;
  let sumPyro = 0; let nPyro = 0;
  let sumFurnace = 0; let nFurnace = 0;
  let sumPyroTarget = 0; let nPyroTarget = 0;
  let sumFurnaceTarget = 0; let nFurnaceTarget = 0;

  for (const log of logs) {
    const weight = Math.max(1, Number(log.beratSampahTotal || 0));
    const pBand = bandFromLog(log, 'pirolisis');
    const fBand = bandFromLog(log, 'tungku');
    const pTemp = tempFromLog(log, 'pirolisis');
    const fTemp = tempFromLog(log, 'tungku');
    if (pTemp != null && fTemp != null) {
      weightedPyroQuality += bandQuality(pTemp, pBand, DEFAULT_SETPOINTS.pirolisis) * weight;
      weightedFurnaceQuality += bandQuality(fTemp, fBand, DEFAULT_SETPOINTS.tungku) * weight;
      qualityWeight += weight;
    }
    if (pTemp != null) { sumPyro += pTemp; nPyro += 1; }
    if (fTemp != null) { sumFurnace += fTemp; nFurnace += 1; }
    sumPyroTarget += (pBand.bawah + pBand.atas) / 2; nPyroTarget += 1;
    sumFurnaceTarget += (fBand.bawah + fBand.atas) / 2; nFurnaceTarget += 1;
  }

  const pyroQuality = qualityWeight ? weightedPyroQuality / qualityWeight : 0;
  const furnaceQuality = qualityWeight ? weightedFurnaceQuality / qualityWeight : 0;
  const avgPir = nPyro ? sumPyro / nPyro : 0;
  const avgTun = nFurnace ? sumFurnace / nFurnace : 0;
  const avgPyroTarget = nPyroTarget ? sumPyroTarget / nPyroTarget : 0;
  const avgFurnaceTarget = nFurnaceTarget ? sumFurnaceTarget / nFurnaceTarget : 0;

  const criticalSessions = new Set(healthRows.filter((x) => x.status === 'critical').map((x) => x.sessionId));
  const criticalCount = criticalSessions.size;

  const metrics = {
    pyroQuality: clamp(pyroQuality, 0, 1),
    furnaceQuality: clamp(furnaceQuality, 0, 1),
    // Training health memakai 40% sebagai reference quality = 1.0, bukan hard target.
    yieldQuality: clamp(weightedYield / 40, 0, 1.2),
    yieldCv: clamp(yieldCv, 0, 1),
    criticalRate: logs.length ? criticalCount / logs.length : 0,
    sessionCountNorm: clamp(logs.length / 20, 0, 1),
  };
  const ai = await scoreMonthlyHealth(metrics);
  const status = ai.risk >= 0.7 ? 'critical' : ai.risk >= 0.4 ? 'warning' : 'normal';
  const sessionId = `MONTH-${monthKey}`;
  const keterangan = [
    `Rekap bulanan ${monthKey}: ${logs.length} sesi`,
    `yield ${weightedYield.toFixed(1)}%`,
    `kepatuhan pirolisis ${(metrics.pyroQuality * 100).toFixed(0)}%`,
    `tungku ${(metrics.furnaceQuality * 100).toFixed(0)}%`,
    `AI risk ${(ai.risk * 100).toFixed(0)}% (${ai.engine})`,
  ].join(' · ');

  const existing = await prisma.healthStatus.findFirst({ where: { sessionId }, orderBy: { id: 'desc' } });
  const row = existing
    ? await prisma.healthStatus.update({ where: { id: existing.id }, data: { status, keterangan, createdAt: new Date() } })
    : await prisma.healthStatus.create({ data: { sessionId, status, keterangan } });

  return {
    row,
    month: monthKey,
    status,
    risk: ai.risk,
    engine: ai.engine,
    metrics: {
      sessions: logs.length,
      inputKg: Number(inputKg.toFixed(2)),
      outputKg: Number(outputKg.toFixed(2)),
      weightedYield: Number(weightedYield.toFixed(2)),
      avgPyroC: Number(avgPir.toFixed(2)),
      avgFurnaceC: Number(avgTun.toFixed(2)),
      avgPyroTargetC: Number(avgPyroTarget.toFixed(2)),
      avgFurnaceTargetC: Number(avgFurnaceTarget.toFixed(2)),
      pyroSetpointAdherence: Number(metrics.pyroQuality.toFixed(4)),
      furnaceSetpointAdherence: Number(metrics.furnaceQuality.toFixed(4)),
      yieldCv: Number(yieldCv.toFixed(4)),
      criticalRate: Number(metrics.criticalRate.toFixed(4)),
    },
  };
}
