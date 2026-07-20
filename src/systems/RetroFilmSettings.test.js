import { describe, it, expect, beforeEach } from 'vitest';
import {
    RetroFilmSettings,
    RETRO_PRESETS,
} from './RetroFilmSettings.js';

describe('RetroFilmSettings', () => {
    beforeEach(() => {
        RetroFilmSettings.reset();
    });

    it('should start with classic preset (readable colors, lifted shadows)', () => {
        expect(RetroFilmSettings.enabled).toBe(true);
        expect(RetroFilmSettings.intensity).toBe(RETRO_PRESETS.classic.intensity);
        expect(RetroFilmSettings.sepia).toBe(35);
        expect(RetroFilmSettings.jitter).toBe(25);
        expect(RetroFilmSettings.dust).toBe(0);
        expect(RetroFilmSettings.scratches).toBe(40);
        expect(RetroFilmSettings.contrast).toBe(15);
        expect(RetroFilmSettings.vignette).toBe(40);
    });

    it('isActive should be false when disabled or intensity is 0', () => {
        expect(RetroFilmSettings.isActive()).toBe(true);

        RetroFilmSettings.set('enabled', false);
        expect(RetroFilmSettings.isActive()).toBe(false);

        RetroFilmSettings.set('enabled', true);
        RetroFilmSettings.set('intensity', 0);
        expect(RetroFilmSettings.isActive()).toBe(false);
    });

    it('should clamp slider values', () => {
        RetroFilmSettings.set('grain', 150);
        expect(RetroFilmSettings.grain).toBe(100);

        RetroFilmSettings.set('jitter', -10);
        expect(RetroFilmSettings.jitter).toBe(0);

        RetroFilmSettings.set('contrast', -80);
        expect(RetroFilmSettings.contrast).toBe(-50);

        RetroFilmSettings.set('contrast', 200);
        expect(RetroFilmSettings.contrast).toBe(100);
    });

    it('should apply presets including off', () => {
        expect(RetroFilmSettings.applyPreset('ruined')).toBe(true);
        expect(RetroFilmSettings.scratches).toBe(RETRO_PRESETS.ruined.scratches);
        expect(RetroFilmSettings.jitter).toBe(45);
        expect(RetroFilmSettings.enabled).toBe(true);

        expect(RetroFilmSettings.applyPreset('off')).toBe(true);
        expect(RetroFilmSettings.enabled).toBe(false);
        expect(RetroFilmSettings.intensity).toBe(0);
        expect(RetroFilmSettings.isActive()).toBe(false);

        expect(RetroFilmSettings.applyPreset('nope')).toBe(false);
    });

    it('applyToUniforms should map 0-100 to 0-1 including jitter', () => {
        const uniforms = {};
        ['intensity', 'vignette', 'flicker', 'jitter', 'grain', 'scratches', 'dust', 'sepia', 'contrast', 'fps']
            .forEach((k) => { uniforms[k] = { value: -1 }; });

        RetroFilmSettings.applyPreset('classic');
        RetroFilmSettings.applyToUniforms(uniforms);

        expect(uniforms.intensity.value).toBeCloseTo(0.85);
        expect(uniforms.vignette.value).toBeCloseTo(0.40);
        expect(uniforms.jitter.value).toBeCloseTo(0.25);
        expect(uniforms.scratches.value).toBeCloseTo(0.40);
        expect(uniforms.dust.value).toBe(0);
        expect(uniforms.sepia.value).toBeCloseTo(0.35);
        expect(uniforms.fps.value).toBe(18);

        RetroFilmSettings.applyPreset('off');
        RetroFilmSettings.applyToUniforms(uniforms);
        expect(uniforms.intensity.value).toBe(0);
    });

    it('toJSON should return a plain snapshot', () => {
        const json = RetroFilmSettings.toJSON();
        expect(json).toEqual({
            enabled: true,
            intensity: 85,
            vignette: 40,
            flicker: 25,
            jitter: 25,
            grain: 35,
            scratches: 40,
            dust: 0,
            sepia: 35,
            contrast: 15,
        });
    });
});
