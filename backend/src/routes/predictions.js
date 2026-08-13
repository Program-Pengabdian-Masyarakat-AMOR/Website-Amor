import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { predictionDTO } from '../lib/serializers.js';
import { predictYield } from '../services/aiEngine.js';

const router = Router();

// GET /api/predictions
// Backward-compatible: baris lama yang predictedYield-nya null akan di-backfill dari ProductionLog.
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    let rows = await prisma.prediction.findMany({ orderBy: { id: 'desc' }, take: 20 });

    const missing = rows.filter((row) => row.predictedYield == null);
    if (missing.length) {
      const sessionIds = [...new Set(missing.map((row) => row.sessionId))];
      const logs = await prisma.productionLog.findMany({ where: { sessionId: { in: sessionIds } } });
      const logsBySession = new Map(logs.map((log) => [log.sessionId, log]));

      await Promise.all(
        missing.map(async (row) => {
          const log = logsBySession.get(row.sessionId);
          if (!log) return;
          const ai = await predictYield({
            inputKg: log.beratSampahTotal,
            oilKg: log.beratMinyakTotal,
            pyroC: log.suhuPirolisisAvg,
            furnaceC: log.suhuTungkuAvg,
            elapsedMs: log.waktuProsesDetik,
            running: false,
          });
          await prisma.prediction.update({ where: { id: row.id }, data: { predictedYield: ai.predictedYield } });
          row.predictedYield = ai.predictedYield;
        })
      );
    }

    res.json(rows.map(predictionDTO));
  })
);

export default router;
