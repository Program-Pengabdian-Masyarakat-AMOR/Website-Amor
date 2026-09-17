// Buat / perbarui SATU akun tanpa menyentuh data lain (aman untuk server produksi).
// Berbeda dengan `npm run seed` yang MENGHAPUS data penjualan, produksi, dan anggota.
//
// Pemakaian:
//   npm run user:create -- --username manajemen_amor --password "RahasiaKuat123" --role management
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { ROLES } from '../src/middleware/auth.js';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const username = arg('username');
  const password = arg('password');
  const role = arg('role');

  if (!username || !password || !role) {
    throw new Error('Wajib: --username <nama> --password <sandi> --role <admin|operator|management>');
  }
  if (!ROLES.includes(role)) throw new Error(`Role harus salah satu dari: ${ROLES.join(', ')}`);
  if (password.length < 8) throw new Error('Kata sandi minimal 8 karakter.');

  const passwordHash = await bcrypt.hash(password, 10);
  const existed = await prisma.user.findUnique({ where: { username } });
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role },
    create: { username, passwordHash, role },
  });
  console.log(`[user] ${existed ? 'diperbarui' : 'dibuat'}: ${username} (${role})`);
}

main()
  .catch((e) => {
    console.error('[user]', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
