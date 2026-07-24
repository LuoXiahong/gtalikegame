import { describe, it, expect } from 'vitest';
import {
    TiltShiftShader,
    TILT_SHIFT_BLUR,
    TILT_SHIFT_FOCUS,
    TILT_SHIFT_FALLOFF,
    TILT_SHIFT_SOFT
} from './TiltShiftShader.js';

describe('TiltShiftShader', () => {
    it('should be defined with uniforms, vertexShader, and fragmentShader', () => {
        expect(TiltShiftShader).toBeDefined();
        expect(TiltShiftShader.uniforms).toBeDefined();
        expect(TiltShiftShader.vertexShader).toContain('vUv = uv');
        expect(TiltShiftShader.fragmentShader).toContain('blurAmount');
    });

    it('uses a strong enough blur for visible edge soft-focus (diorama)', () => {
        // Pre-T14 blur was 0.0004 — invisible on 1080p (~3px at taps×4)
        expect(TILT_SHIFT_BLUR).toBeGreaterThanOrEqual(0.003);
        expect(TiltShiftShader.uniforms.blur.value).toBe(TILT_SHIFT_BLUR);
        expect(TiltShiftShader.uniforms.focus.value).toBe(TILT_SHIFT_FOCUS);
        expect(TiltShiftShader.uniforms.falloff.value).toBe(TILT_SHIFT_FALLOFF);
        expect(TiltShiftShader.uniforms.soft.value).toBe(TILT_SHIFT_SOFT);
        // Sharp band narrower than old 0.28 so corners actually leave focus
        expect(TILT_SHIFT_FALLOFF).toBeLessThan(0.25);
    });

    it('keeps a sharp mid-band early-out and multi-axis kernel', () => {
        expect(TiltShiftShader.fragmentShader).toContain('Early-out');
        expect(TiltShiftShader.fragmentShader).toMatch(/t \* t/);
        expect(TiltShiftShader.fragmentShader).toContain('SAMPLE( 2.0,  2.0');
        expect(TiltShiftShader.fragmentShader).toContain('SAMPLE( 2.5,  0.0');
    });
});
