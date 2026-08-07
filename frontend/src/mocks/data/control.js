// Nilai kontrol Web → IoT (FE → backend → Firebase node input, key datar).
// Firmware membaca: input/pirolisis_bawah, pirolisis_atas, tungku_bawah, tungku_atas (Integer).
// Blower & feeder: input/blower, input/feeder (Boolean) — key datar juga.
export const controlDefault = {
  pirolisis: { bawah: 380, atas: 420 },
  tungku: { bawah: 780, atas: 820 },
  blower: false,
  feeder: false,
  alarm: true, // alarm gas aktif; false = dibisukan
};
