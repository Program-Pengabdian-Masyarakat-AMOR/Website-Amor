// users: id, username, password*, role (admin|operator), created_at
// *password TIDAK PERNAH dikirim ke FE — hanya dipakai mock untuk validasi.
export const users = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    created_at: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 2,
    username: 'operator_rw04',
    password: 'operator123',
    role: 'operator',
    created_at: '2026-02-01T08:00:00.000Z',
  },
];
