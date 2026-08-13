import { prisma } from '../lib/prisma.js';
import { scoreMonthlyHealth } from './aiEngine.js';

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
  const healthRows = await prisma.healthStatus.findMany({
    where: { sessionId: { in: sessionIds } },
  });

  const inputKg = logs.reduce((a, x) => a + Number(x.beratSampahTotal || 0), 0);
  const outputKg = logs.reduce((a, x) => a + Number(x.beratMinyakTotal || 0), 0);
  const weightedYield = inputKg > 0 ? (outputKg / inputKg) * 100 : 0;
  const yields = logs.map((x) => Number(x.yieldPercent || 0));
  const meanYield = yields.reduce((a, x) => a + x, 0) / yields.length;
  const variance = yields.reduce((a, x) => a + (x - meanYield) ** 2, 0) / yields.length;
  const yieldCv = meanYield > 0 ? Math.sqrt(variance) / meanYield : 1;

  const validPir = logs.map((x) => Number(x.suhuPirolisisAvg)).filter(Number.isFinite);
  const validTun = logs.map((x) => Number(x.suhuTungkuAvg)).filter(Number.isFinite);
  const avgPir = validPir.length ? validPir.reduce((a, x) => a + x, 0) / validPir.length : 0;
  const avgTun = validTun.length ? validTun.reduce((a, x) => a + x, 0) / validTun.length : 0;
  const criticalSessions = new Set(
    healthRows.filter((x) => x.status === 'critical').map((x) => x.sessionId)
  );
  const criticalCount = criticalSessions.size;

  const metrics = {
    pyroQuality: clamp(1 - Math.abs(avgPir - 400) / 120, 0, 1),
    furnaceQuality: clamp(1 - Math.abs(avgTun - 800) / 300, 0, 1),
    yieldQuality: clamp(weightedYield / 70, 0, 1.2),
    yieldCv: clamp(yieldCv, 0, 1),
    criticalRate: logs.length ? criticalCount / logs.length : 0,
    sessionCountNorm: clamp(logs.length / 20, 0, 1),
  };
  const ai = await scoreMonthlyHealth(metrics);
  const status = ai.risk >= 0.7 ? 'critical' : ai.risk >= 0.4 ? 'warning' : 'normal';
  const sessionId = `MONTH-${monthKey}`;
  const keterangan = [
    `Rekap bulanan ${monthKey}: ${logs.length} sesi`,
    `input ${inputKg.toFixed(1)} kg`,
    `output ${outputKg.toFixed(1)} kg`,
    `yield ${weightedYield.toFixed(1)}%`,
    `rata-rata pirolisis ${avgPir.toFixed(0)}°C`,
    `tungku ${avgTun.toFixed(0)}°C`,
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
      yieldCv: Number(yieldCv.toFixed(4)),
      criticalRate: Number(metrics.criticalRate.toFixed(4)),
    },
  };
}
