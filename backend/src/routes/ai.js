import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { getAiEngineStatus, warmupAiEngine } from '../services/aiEngine.js';
import { evaluateMonthlyHealth, currentMonthKey } from '../services/monthlyHealth.js';
import { getFeederAutomationStatus, setFeederAutomationMode } from '../services/feederAutomation.js';

const router = Router();

router.get('/status', requireAuth, (req, res) => {
  res.json({ engine: getAiEngineStatus(), feeder: getFeederAutomationStatus() });
});

router.post(
  '/warmup',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json(await warmupAiEngine());
  })
);

router.get(
  '/monthly-health',
  requireAuth,
  asyncHandler(async (req, res) => {
    const month = req.query.month || currentMonthKey();
    const result = await evaluateMonthlyHealth(month);
    res.json(result || { month, status: 'no-data', message: 'Belum ada sesi produksi pada bulan tersebut.' });
  })
);

router.put(
  '/feeder-mode',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    try {
      res.json(await setFeederAutomationMode(req.body?.mode));
    } catch (e) {
      res.status(400).json({ message: e.message });
    }
  })
);

export default router;
