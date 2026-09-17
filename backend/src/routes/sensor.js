import { Router } from 'express';
import { allow } from '../middleware/auth.js';
import { getLatestTelemetry, getSeries } from '../services/firebaseBridge.js';

const router = Router();

// GET /api/sensor-data/latest → { latest, series }
router.get('/latest', allow('admin', 'operator'), (req, res) => {
  res.json({ latest: getLatestTelemetry(), series: getSeries() });
});

export default router;
