import { describe, it, expect } from 'vitest';
import { TiltShiftShader } from './TiltShiftShader.js';

describe('TiltShiftShader', () => {
    it('should be defined with uniforms, vertexShader, and fragmentShader', () => {
        expect(TiltShiftShader).toBeDefined();
        expect(TiltShiftShader.uniforms).toBeDefined();
        expect(TiltShiftShader.vertexShader).toContain('vUv = uv');
        expect(TiltShiftShader.fragmentShader).toContain('blurAmount');
    });
});
