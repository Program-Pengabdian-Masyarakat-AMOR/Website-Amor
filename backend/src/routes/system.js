import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { allow } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { getBridgeStatus, getLatestTelemetry } from '../services/firebaseBridge.js';
import { getAiEngineStatus } from '../services/aiEngine.js';
import { getFeederAutomationStatus } from '../services/feederAutomation.js';

const router = Router();
const serverStartedAt = new Date();

// Data Firebase dianggap "basi" bila node monitoring tidak berubah selama ini (detik).
const STALE_AFTER_S = Number(process.env.MONITORING_STALE_AFTER_S) || 120;

async function databaseStatus() {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [production, health, feeder, members, users, lastProduction] = await Promise.all([
      prisma.productionLog.count(),
      prisma.healthStatus.count(),
      prisma.feederMovement.count(),
      prisma.member.count(),
      prisma.user.count(),
      prisma.productionLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { sessionId: true, createdAt: true } }),
    ]);
    return {
      ok: true,
      latency_ms: Date.now() - t0,
      counts: { production, health, feeder, members, users },
      last_production: lastProduction ? { session_id: lastProduction.sessionId, created_at: lastProduction.createdAt } : null,
    };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: e.message };
  }
}

function aiSummary() {
  const engine = getAiEngineStatus();
  return {
    runtime: engine.runtime,
    runtime_failure: engine.runtimeFailure,
    models: Object.fromEntries(
      Object.entries(engine.models).map(([k, m]) => [k, { loaded: m.loaded, failure: m.failure }])
    ),
    feeder_mode: getFeederAutomationStatus().mode,
  };
}

// GET /api/system/status → ringkasan health check sistem (admin)
router.get(
  '/status',
  allow('admin'),
  asyncHandler(async (req, res) => {
    const firebase = getBridgeStatus();
    const database = await databaseStatus();
    const ai = aiSummary();
    const stale = firebase.last_monitoring_age_s == null || firebase.last_monitoring_age_s > STALE_AFTER_S;

    // Diringkas jadi satu status: critical bila DB/Firebase mati, warning bila data basi / AI fallback.
    const issues = [];
    if (!database.ok) issues.push({ level: 'critical', text: 'Database tidak dapat diakses.' });
    if (firebase.mode === 'off') issues.push({ level: 'critical', text: 'Firebase belum dikonfigurasi.' });
    else if (!firebase.connected) issues.push({ level: 'critical', text: 'Koneksi ke Firebase terputus.' });
    if (firebase.mode !== 'off' && stale) {
      issues.push({ level: 'warning', text: `Belum ada data monitoring baru dari Firebase lebih dari ${STALE_AFTER_S} detik.` });
    }
    if (firebase.last_write_error) {
      issues.push({ level: 'warning', text: `Penulisan terakhir ke Firebase gagal: ${firebase.last_write_error}` });
    }
    if (ai.runtime === 'fallback') {
      issues.push({ level: 'warning', text: 'AI engine memakai fallback numerik (ONNX runtime tidak aktif).' });
    }
    const overall = issues.some((i) => i.level === 'critical') ? 'critical' : issues.length ? 'warning' : 'normal';

    res.json({
      overall,
      issues,
      checked_at: new Date().toISOString(),
      server: {
        started_at: serverStartedAt.toISOString(),
        uptime_s: Math.round(process.uptime()),
        node: process.version,
        env: process.env.NODE_ENV || 'development',
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      firebase: { ...firebase, stale, stale_after_s: STALE_AFTER_S },
      database,
      ai,
      telemetry: getLatestTelemetry(),
    });
  })
);

export default router;
