import { Router } from 'express';
import auth from './auth.js';
import sensor from './sensor.js';
import control from './control.js';
import production from './production.js';
import health from './health.js';
import predictions from './predictions.js';
import members from './members.js';
import sales from './sales.js';
import feederLogs from './feederLogs.js';
import ai from './ai.js';
import system from './system.js';
import recap from './recap.js';
import siteContent from './siteContent.js';

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
router.use('/feeder-logs', feederLogs);
router.use('/ai', ai);
router.use('/system', system);
router.use('/recap', recap);
router.use('/site-content', siteContent);

export default router;
