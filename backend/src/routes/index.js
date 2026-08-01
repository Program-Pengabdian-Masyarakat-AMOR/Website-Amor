import { Router } from 'express';
import auth from './auth.js';
import sensor from './sensor.js';
import control from './control.js';
import production from './production.js';
import health from './health.js';
import predictions from './predictions.js';
import members from './members.js';
import sales from './sales.js';

const router = Router();

router.get('/health-check', (req, res) => res.json({ ok: true, service: 'amor-server' }));

router.use('/auth', auth);
router.use('/sensor-data', sensor);
router.use('/control', control);
router.use('/production-logs', production);
router.use('/health-status', health);
router.use('/predictions', predictions);
router.use('/members', members);
router.use('/sales', sales);

export default router;
