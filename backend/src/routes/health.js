import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { allow } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { healthDTO } from '../lib/serializers.js';
import { getCurrentHealth } from '../services/firebaseBridge.js';
import { evaluateMonthlyHealth, currentMonthKey } from '../services/monthlyHealth.js';

const router = Router();

// GET /api/health-status → { current (terhitung live), history }
router.get(
  '/',
  allow('admin', 'operator'),
  asyncHandler(async (req, res) => {
    const monthly = await evaluateMonthlyHealth(currentMonthKey()).catch((e) => {
      console.error('[health] monthly AI gagal:', e.message);
      return null;
    });
    const history = await prisma.healthStatus.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    res.json({ current: getCurrentHealth(), history: history.map(healthDTO), monthly: monthly ? { month: monthly.month, status: monthly.status, risk: monthly.risk, engine: monthly.engine, metrics: monthly.metrics } : null });
  })
);

export default router;
