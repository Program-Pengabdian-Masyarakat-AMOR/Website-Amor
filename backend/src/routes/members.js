import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { allow } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { memberDTO } from '../lib/serializers.js';

const router = Router();

router.use(allow('admin'));

// GET /api/members
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await prisma.member.findMany({ orderBy: { id: 'asc' } });
    res.json(rows.map(memberDTO));
  })
);

// POST /api/members
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (!b.nama || !b.nim_nip || !b.kontak) {
      return res.status(400).json({ message: 'Nama, NIM/NIP, dan kontak wajib diisi.' });
    }
    const row = await prisma.member.create({
      data: { nama: b.nama, nimNip: b.nim_nip, jabatan: b.jabatan || 'Anggota', kontak: b.kontak, foto: b.foto || '' },
    });
    res.status(201).json(memberDTO(row));
  })
);

// PUT /api/members/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    const exists = await prisma.member.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: 'Anggota tidak ditemukan.' });
    const row = await prisma.member.update({
      where: { id },
      data: {
        nama: b.nama ?? exists.nama,
        nimNip: b.nim_nip ?? exists.nimNip,
        jabatan: b.jabatan ?? exists.jabatan,
        kontak: b.kontak ?? exists.kontak,
        foto: b.foto ?? exists.foto,
      },
    });
    res.json(memberDTO(row));
  })
);

// DELETE /api/members/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.member.deleteMany({ where: { id } });
    res.json({ id });
  })
);

export default router;
