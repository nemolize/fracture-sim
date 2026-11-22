export const GRAVITY = 9.8;
export const WORLD_WIDTH = 10;
export const WORLD_HEIGHT = 5.2;
export const TIME_STEP = 1 / 60;
/** Gravity change (m/s²) that wakes sleeping bodies; chosen empirically, no fixed source. */
export const WAKE_GRAVITY_DELTA = 0.05;
/** Time constant (s) of the gravity average that the wake test reads; chosen empirically, no fixed source. */
export const WAKE_GRAVITY_SMOOTHING = 0.1;
