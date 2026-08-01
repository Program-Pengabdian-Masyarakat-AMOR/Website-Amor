import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { predictionDTO } from '../lib/serializers.js';

const router = Router();

// GET /api/predictions
// Catatan: predicted_yield masih null sampai model ONNX terpasang (FASE 2 lanjutan).
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await prisma.prediction.findMany({ orderBy: { id: 'desc' }, take: 20 });
    res.json(rows.map(predictionDTO));
  })
);

export default router;
