import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { feederMovementDTO } from '../lib/serializers.js';

const router = Router();

// GET /api/feeder-logs?limit=50
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const rows = await prisma.feederMovement.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    res.json(rows.map(feederMovementDTO));
  })
);

export default router;
