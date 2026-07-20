import { describe, it, expect } from 'vitest';
import { RetroFilmShader } from './RetroFilmShader.js';

describe('RetroFilmShader', () => {
    it('should expose uniforms, vertexShader and fragmentShader', () => {
        expect(RetroFilmShader).toBeDefined();
        expect(RetroFilmShader.uniforms).toBeDefined();
        expect(RetroFilmShader.vertexShader).toContain('vUv = uv');
        expect(RetroFilmShader.fragmentShader).toContain('sepia');
        expect(RetroFilmShader.fragmentShader).toContain('vignette');
        expect(RetroFilmShader.fragmentShader).toContain('overlay');
        expect(RetroFilmShader.fragmentShader).toContain('jitter');
    });

    it('should include intensity early-out and shadow-lift friendly grading', () => {
        expect(RetroFilmShader.fragmentShader).toContain('intensity < 0.001');
        expect(RetroFilmShader.fragmentShader).toContain('shadow lift');
        expect(RetroFilmShader.fragmentShader).toContain('max(0.78, flick)');
        expect(RetroFilmShader.uniforms.intensity.value).toBe(1.0);
    });

    it('should keep warm tint grading and sprockets without dust blobs', () => {
        expect(RetroFilmShader.fragmentShader).toContain('Warm tint');
        expect(RetroFilmShader.fragmentShader).toContain('sprocket');
        expect(RetroFilmShader.fragmentShader).toContain('overlayChannel');
        expect(RetroFilmShader.fragmentShader).not.toContain('blob');
    });

    it('should declare all tunable uniforms', () => {
        const keys = [
            'tDiffuse', 'time', 'intensity', 'vignette', 'flicker', 'jitter',
            'grain', 'scratches', 'dust', 'sepia', 'contrast', 'fps',
        ];
        keys.forEach((k) => {
            expect(RetroFilmShader.uniforms[k]).toBeDefined();
            expect(RetroFilmShader.uniforms[k]).toHaveProperty('value');
        });
    });
});
