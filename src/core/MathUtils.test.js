import { describe, it, expect } from 'vitest';
import { decayFactor, frameBlend } from './MathUtils.js';

describe('decayFactor', () => {
    it('returns the constant unchanged at dt = 1/60 (the frame rate it was tuned for)', () => {
        expect(decayFactor(0.98, 1 / 60)).toBeCloseTo(0.98);
    });

    it('compounds across multiple frames worth of dt', () => {
        // 6 frames of decay at dt=0.1 (6/60s) should match applying the
        // per-frame factor 6 times in a row.
        const sixFrames = Math.pow(0.98, 6);
        expect(decayFactor(0.98, 0.1)).toBeCloseTo(sixFrames);
    });

    it('returns 1 (no decay) at dt = 0', () => {
        expect(decayFactor(0.5, 0)).toBe(1);
    });
});

describe('frameBlend', () => {
    it('returns the constant unchanged at dt = 1/60', () => {
        expect(frameBlend(0.2, 1 / 60)).toBeCloseTo(0.2);
    });

    it('closes more of the gap as dt grows (approaches 1, never exceeds it)', () => {
        const short = frameBlend(0.2, 1 / 60);
        const long = frameBlend(0.2, 0.5);
        expect(long).toBeGreaterThan(short);
        expect(long).toBeLessThan(1);
    });

    it('returns 0 (no movement toward target) at dt = 0', () => {
        expect(frameBlend(0.2, 0)).toBe(0);
    });
});
