import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { ROLES, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Maks 10 percobaan / menit / IP untuk mencegah brute-force.
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, message: 'Terlalu banyak percobaan masuk. Coba lagi sebentar.' });

// POST /api/auth/login { username, password, role } → { token, role }
// Role yang dipilih di form wajib sama dengan role akun. Pesan gagal sengaja
// disamakan agar tidak membocorkan username mana yang valid / role-nya apa.
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password, role } = req.body || {};
    if (!username || !password || !role) {
      return res.status(400).json({ message: 'Role, username, dan kata sandi wajib diisi.' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: 'Role tidak dikenal.' });
    }
    const user = await prisma.user.findUnique({ where: { username } });
    const valid = user && (await bcrypt.compare(password, user.passwordHash)) && user.role === role;
    if (!valid) {
      return res.status(401).json({ message: 'Role, username, atau kata sandi tidak sesuai.' });
    }
    res.json({ token: signToken(user), role: user.role, username: user.username });
  })
);

export default router;
