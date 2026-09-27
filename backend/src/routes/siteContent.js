import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { allow } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { CONTENT_KEYS, readContent, sanitizeContent } from '../lib/siteContent.js';

const router = Router();

// GET /api/site-content/:key (publik — dibaca landing page)
router.get(
  '/:key',
  asyncHandler(async (req, res) => {
    if (!CONTENT_KEYS.includes(req.params.key)) return res.status(404).json({ message: 'Konten tidak dikenal.' });
    res.json(await readContent(req.params.key));
  })
);

// PUT /api/site-content/:key (management)
router.put(
  '/:key',
  allow('management'),
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const clean = sanitizeContent(key, req.body);
    const value = JSON.stringify(clean);
    await prisma.siteContent.upsert({
      where: { key },
      update: { value, updatedBy: req.user.username },
      create: { key, value, updatedBy: req.user.username },
    });
    res.json(await readContent(key));
  })
);

export default router;
