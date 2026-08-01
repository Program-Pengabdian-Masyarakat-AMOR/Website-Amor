// Cek koneksi Firebase: baca node telemetri + tes tulis/baca.
// Jalankan dari folder backend:  node scripts/firebase-check.js
import { getDb } from '../src/config/firebase.js';

const db = getDb();
if (!db) {
  console.log('❌ Firebase TIDAK terkonfigurasi. Cek backend/.env (FIREBASE_SERVICE_ACCOUNT & FIREBASE_DATABASE_URL).');
  process.exit(1);
}

const nodes = ['suhu', 'berat', 'gas', 'status', 'hasil_akhir', 'input'];
console.log('📡 Terhubung. Isi node saat ini:\n');
for (const n of nodes) {
  const val = (await db.ref(n).get()).val();
  console.log(`  ${n.padEnd(12)} :`, val == null ? '(belum ada)' : JSON.stringify(val));
}

// Tes tulis lalu baca lalu bersihkan (node aman, bukan /input).
const stamp = new Date().toISOString();
await db.ref('_webCheck').set({ dari: 'backend', waktu: stamp });
const back = (await db.ref('_webCheck').get()).val();
await db.ref('_webCheck').remove();
console.log('\n✅ Tes tulis→baca berhasil:', JSON.stringify(back), '(sudah dibersihkan)');
console.log('\nKesimpulan: backend BISA baca & tulis ke Firebase. Web ⇄ Firebase tersambung.');
process.exit(0);
