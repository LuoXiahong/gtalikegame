/**
 * Frame-rate-independent scaling for per-frame damping constants.
 *
 * Constants like `friction: 0.5` or `driftInertia: 0.2` were tuned assuming
 * one multiply/lerp per rendered frame at 60fps. Applied directly at any
 * other frame rate (or after a `dt` spike from a stalled tab), the same
 * constant decays position/velocity a different amount per second — the game
 * behaves differently depending on the player's monitor refresh rate.
 * These rescale a 60fps-tuned constant to the actual elapsed `dt`, so one
 * call at dt=1/60 and one call covering six dropped frames (dt=0.1) close
 * the same fraction of a second's worth of decay.
 */

/**
 * Rescales a per-frame multiplicative decay factor (e.g. `velX *= friction`
 * each frame) to the elapsed `dt`. At dt = 1/60 this returns `perFrameFactor`
 * unchanged; at other dt it compounds (or fractions) it accordingly.
 * @param {number} perFrameFactor - decay factor tuned for a 1/60s frame (0..1)
 * @param {number} dt - elapsed seconds this tick
 * @returns {number}
 */
export function decayFactor(perFrameFactor, dt) {
    return Math.pow(perFrameFactor, dt * 60);
}

/**
 * Rescales a per-frame lerp-toward-target blend (e.g.
 * `current += (target - current) * blend` each frame) to the elapsed `dt`.
 * @param {number} perFrameBlend - fraction of the gap closed per 1/60s frame (0..1)
 * @param {number} dt - elapsed seconds this tick
 * @returns {number}
 */
export function frameBlend(perFrameBlend, dt) {
    return 1 - decayFactor(1 - perFrameBlend, dt);
}
