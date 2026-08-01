import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { healthDTO } from '../lib/serializers.js';
import { getCurrentHealth } from '../services/firebaseBridge.js';

const router = Router();

// GET /api/health-status → { current (terhitung live), history }
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const history = await prisma.healthStatus.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    res.json({ current: getCurrentHealth(), history: history.map(healthDTO) });
  })
);

export default router;
