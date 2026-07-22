import { describe, it, expect, beforeEach } from 'vitest';
import { RoadTextureGenerator } from './RoadTextureGenerator.js';
import * as THREE from 'three';

describe('RoadTextureGenerator', () => {
    beforeEach(() => {
        RoadTextureGenerator.textures.clear();
        RoadTextureGenerator.roughnessTextures.clear();
        RoadTextureGenerator._wetness = 'clear';
    });

    it('should initialize and populate textures', () => {
        RoadTextureGenerator.init();
        expect(RoadTextureGenerator.textures.size).toBe(3);
        expect(RoadTextureGenerator.textures.has('straight')).toBe(true);
        expect(RoadTextureGenerator.textures.has('intersection')).toBe(true);
        expect(RoadTextureGenerator.textures.has('crosswalk')).toBe(true);
        expect(RoadTextureGenerator.roughnessTextures.size).toBe(3);
        expect(RoadTextureGenerator.roughnessTextures.has('straight')).toBe(true);
    });

    it('should create valid THREE.CanvasTexture objects via getTexture', () => {
        const texture = RoadTextureGenerator.getTexture('straight');
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.wrapS).toBe(THREE.RepeatWrapping);
        expect(texture.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture.magFilter).toBe(THREE.NearestFilter);
    });

    it('should create roughness maps with wet patch metadata on albedo', () => {
        const albedo = RoadTextureGenerator.getTexture('straight');
        const roughness = RoadTextureGenerator.getRoughnessTexture('straight');
        expect(roughness).toBeInstanceOf(THREE.CanvasTexture);
        expect(albedo.userData.wetPatches).toBeDefined();
        expect(albedo.userData.wetPatches.length).toBeGreaterThan(0);
    });

    it('getSurfaceMaterialProps uses soft rain gloss (not glitter)', () => {
        RoadTextureGenerator._wetness = 'clear';
        expect(RoadTextureGenerator.getSurfaceMaterialProps()).toEqual({
            roughness: 1.0,
            metalness: 0.0,
            envMapIntensity: 0,
        });
        RoadTextureGenerator._wetness = 'rain';
        expect(RoadTextureGenerator.getSurfaceMaterialProps()).toEqual({
            roughness: 0.62,
            metalness: 0.08,
            envMapIntensity: 0.35,
        });
    });

    it('applyWetnessToMeshes updates opaque road materials and skips transparent', () => {
        const opaque = {
            material: {
                transparent: false,
                roughness: 1,
                metalness: 0,
                envMapIntensity: 0,
                needsUpdate: false,
            },
        };
        const glass = {
            material: {
                transparent: true,
                roughness: 0.85,
                metalness: 0,
                envMapIntensity: 0,
                needsUpdate: false,
            },
        };
        RoadTextureGenerator._wetness = 'rain';
        RoadTextureGenerator.applyWetnessToMeshes([opaque, glass]);
        expect(opaque.material.roughness).toBeCloseTo(0.62);
        expect(opaque.material.metalness).toBeCloseTo(0.08);
        expect(opaque.material.envMapIntensity).toBeCloseTo(0.35);
        expect(opaque.material.needsUpdate).toBe(true);
        expect(glass.material.roughness).toBe(0.85);
        expect(glass.material.envMapIntensity).toBe(0);
    });

    it('setWetness lays out spaced potholes and ruts for rain on straight', () => {
        RoadTextureGenerator.init();
        RoadTextureGenerator.setWetness('rain');
        const patches = RoadTextureGenerator.getTexture('straight').userData.wetPatches;
        expect(RoadTextureGenerator._wetness).toBe('rain');
        expect(patches.length).toBeGreaterThan(0);
        expect(patches.length).toBeLessThanOrEqual(3);
        const kinds = new Set(patches.map((p) => p.kind));
        expect([...kinds].every((k) => k === 'pothole' || k === 'rut')).toBe(true);
        expect(patches.some((p) => p.kind === 'rut')).toBe(true);
        for (const p of patches) {
            expect(p.lobes?.length).toBeGreaterThanOrEqual(1);
        }
        for (let i = 0; i < patches.length; i++) {
            for (let j = i + 1; j < patches.length; j++) {
                const dx = patches[i].x - patches[j].x;
                const dy = patches[i].y - patches[j].y;
                expect(Math.hypot(dx, dy)).toBeGreaterThan(40);
            }
        }
    });

    it('crosswalk has no wear patches; intersection stays sparse', () => {
        RoadTextureGenerator.init();
        RoadTextureGenerator.setWetness('rain');
        expect(RoadTextureGenerator.getTexture('crosswalk').userData.wetPatches).toEqual([]);
        const ix = RoadTextureGenerator.getTexture('intersection').userData.wetPatches;
        expect(ix.length).toBeLessThanOrEqual(2);
        expect(ix.every((p) => p.kind === 'pothole' || p.kind === 'rut')).toBe(true);
    });

    it('setWetness toggles clear ↔ rain and refreshes patch layout + materials', () => {
        RoadTextureGenerator.init();
        const mesh = {
            material: {
                transparent: false,
                roughness: 1,
                metalness: 0,
                envMapIntensity: 0,
                needsUpdate: false,
            },
        };

        RoadTextureGenerator.setWetness('rain', [mesh]);
        const rainPatches = [...RoadTextureGenerator.getTexture('straight').userData.wetPatches];
        expect(mesh.material.envMapIntensity).toBeCloseTo(0.35);

        RoadTextureGenerator.setWetness('clear', [mesh]);
        expect(RoadTextureGenerator._wetness).toBe('clear');
        expect(mesh.material.roughness).toBe(1);
        expect(mesh.material.metalness).toBe(0);
        expect(mesh.material.envMapIntensity).toBe(0);

        RoadTextureGenerator.setWetness('rain', [mesh]);
        const again = RoadTextureGenerator.getTexture('straight').userData.wetPatches;
        expect(again.length).toBeGreaterThan(0);
        // Rebake replaces patch list (new random layout)
        expect(again).not.toBe(rainPatches);
        expect(mesh.material.envMapIntensity).toBeCloseTo(0.35);
    });

    it('_wetPatchCount stays low for rain (no stamp spam)', () => {
        RoadTextureGenerator._wetness = 'rain';
        expect(RoadTextureGenerator._wetPatchCount('straight')).toBeLessThanOrEqual(2);
        expect(RoadTextureGenerator._wetPatchCount('intersection')).toBeLessThanOrEqual(1);
        expect(RoadTextureGenerator._wetPatchCount('crosswalk')).toBeLessThanOrEqual(1);
        RoadTextureGenerator._wetness = 'clear';
        expect(RoadTextureGenerator._wetPatchCount('straight')).toBeLessThanOrEqual(1);
    });
});
