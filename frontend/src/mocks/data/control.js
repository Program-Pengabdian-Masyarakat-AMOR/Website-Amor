// Nilai kontrol Web → IoT (FE → backend → Firebase node input, key datar).
// Firmware membaca: input/pirolisis_bawah, pirolisis_atas, tungku_bawah, tungku_atas (Integer).
// AI feeder membaca pita yang sama sebagai target dinamis.
export const controlDefault = {
  pirolisis: { bawah: 380, atas: 420 },
  tungku: { bawah: 780, atas: 820 },
  blower: false,
  feeder: false,
  alarm: true,
  ai_feeder: {
    mode: 'observe',
    threshold: 0.62,
    eval_ms: 5000,
    pulse_ms_max: 4000,
    cooldown_ms: 20000,
    min_furnace_c: 550,
    max_furnace_c: 900,
    pyro_high_cutoff_c: 415,
    dynamic_setpoint: {
      pirolisis: { bawah: 380, atas: 420, target: 400 },
      tungku: { bawah: 780, atas: 820, target: 800 },
    },
    model_envelope: {
      pyro_target_center_c: [350, 440],
      furnace_target_center_c: [700, 900],
      max_pyro_band_width_c: 160,
      max_furnace_band_width_c: 180,
      valid: true,
      issue: null,
    },
    mpc: {
      strategy: 'lightweight-mpc',
      horizon_sec: 20,
      commissioned: false,
    },
    last_decision: null,
  },
};
