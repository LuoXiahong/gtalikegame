import { describe, it, expect, beforeEach } from 'vitest';
import { RoofTextureGenerator } from './RoofTextureGenerator.js';
import * as THREE from 'three';

describe('RoofTextureGenerator', () => {
    beforeEach(() => {
        RoofTextureGenerator._roughnessTexture = null;
        RoofTextureGenerator.liveMaterials.clear();
        RoofTextureGenerator._wetness = 'clear';
    });

    it('creates a reusable CanvasTexture for roughness speckle', () => {
        const a = RoofTextureGenerator.getRoughnessTexture();
        const b = RoofTextureGenerator.getRoughnessTexture();
        expect(a).toBeInstanceOf(THREE.CanvasTexture);
        expect(a).toBe(b); // cached, not regenerated per building
        expect(a.wrapS).toBe(THREE.RepeatWrapping);
        expect(a.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('stays matte and dim on clear, gets glossier and brighter on rain', () => {
        RoofTextureGenerator._wetness = 'clear';
        const dry = RoofTextureGenerator.getSurfaceMaterialProps();
        RoofTextureGenerator._wetness = 'rain';
        const wet = RoofTextureGenerator.getSurfaceMaterialProps();

        expect(wet.roughness).toBeLessThan(dry.roughness);
        expect(wet.envMapIntensity).toBeGreaterThan(dry.envMapIntensity);
    });

    it('setWetness updates every tracked material and flips _wetness', () => {
        // needsUpdate is write-only on THREE.Material (no getter), so a real
        // MeshStandardMaterial instance can't be asserted on directly — use a
        // plain mock, matching RoadTextureGenerator.test.js's convention.
        const mat = { roughness: 0, metalness: 0, envMapIntensity: 0, needsUpdate: false };
        RoofTextureGenerator.trackMaterial(mat);

        RoofTextureGenerator.setWetness('rain');
        const wet = RoofTextureGenerator.getSurfaceMaterialProps();
        expect(RoofTextureGenerator._wetness).toBe('rain');
        expect(mat.roughness).toBeCloseTo(wet.roughness);
        expect(mat.metalness).toBeCloseTo(wet.metalness);
        expect(mat.envMapIntensity).toBeCloseTo(wet.envMapIntensity);
        expect(mat.needsUpdate).toBe(true);

        RoofTextureGenerator.setWetness('clear');
        const dry = RoofTextureGenerator.getSurfaceMaterialProps();
        expect(RoofTextureGenerator._wetness).toBe('clear');
        expect(mat.roughness).toBeCloseTo(dry.roughness);
    });

    it('setWetness treats any non-rain value as clear', () => {
        RoofTextureGenerator.setWetness('fog');
        expect(RoofTextureGenerator._wetness).toBe('clear');
    });

    it('tolerates a stale/null entry in liveMaterials without throwing', () => {
        RoofTextureGenerator.liveMaterials.add(null);
        expect(() => RoofTextureGenerator.setWetness('rain')).not.toThrow();
    });
});
