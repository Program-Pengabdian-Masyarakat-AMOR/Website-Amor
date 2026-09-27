import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Maks 10 percobaan / menit / IP untuk mencegah brute-force.
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, message: 'Terlalu banyak percobaan masuk. Coba lagi sebentar.' });

// POST /api/auth/login { username, password } → { token, role }
// Role tidak lagi dikirim dari form login. Backend menentukan role dari akun
// yang valid agar pengguna tidak perlu memilih Admin/Operator/Management di UI.
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || !password) {
      return res.status(400).json({ message: 'Username dan kata sandi wajib diisi.' });
    }

    const user = await prisma.user.findUnique({ where: { username: cleanUsername } });
    const valid = user && (await bcrypt.compare(password, user.passwordHash));
    if (!valid) {
      // Pesan gagal sengaja dibuat umum agar tidak membocorkan username mana yang valid.
      return res.status(401).json({ message: 'Username atau kata sandi tidak sesuai.' });
    }
    res.json({ token: signToken(user), role: user.role, username: user.username });
  })
);

export default router;
