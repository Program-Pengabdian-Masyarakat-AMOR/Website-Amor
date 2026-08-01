// Status kontrol Web → IoT (dikirim FE ke Firebase /input/... lewat backend).
// Struktur mirror path Firebase:
//   /input/pirolisis/suhu_bawah, /input/pirolisis/suhu_atas  (Integer)
//   /input/tungku/suhu_bawah,    /input/tungku/suhu_atas     (Integer)
//   /input/kontrol/blower, /input/kontrol/feeder             (Boolean)
export const controlDefault = {
  pirolisis: { bawah: 380, atas: 420 },
  tungku: { bawah: 780, atas: 820 },
  blower: false,
  feeder: false,
};
