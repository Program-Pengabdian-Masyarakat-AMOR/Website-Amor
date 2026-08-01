import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Maks 10 percobaan / menit / IP untuk mencegah brute-force.
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, message: 'Terlalu banyak percobaan masuk. Coba lagi sebentar.' });

// POST /api/auth/login → { token, role }
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan kata sandi wajib diisi.' });
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Username atau kata sandi salah.' });
    }
    res.json({ token: signToken(user), role: user.role });
  })
);

export default router;
