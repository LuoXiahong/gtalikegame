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
        expect(albedo.userData.puddles).toEqual([]);
    });

    it('getSurfaceMaterialProps keeps rain road mostly matte (puddle gloss via map)', () => {
        RoadTextureGenerator._wetness = 'clear';
        expect(RoadTextureGenerator.getSurfaceMaterialProps()).toEqual({
            roughness: 1.0,
            metalness: 0.0,
            envMapIntensity: 0,
        });
        RoadTextureGenerator._wetness = 'rain';
        expect(RoadTextureGenerator.getSurfaceMaterialProps()).toEqual({
            roughness: 0.92,
            metalness: 0.04,
            envMapIntensity: 0.55,
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
        expect(opaque.material.roughness).toBeCloseTo(0.92);
        expect(opaque.material.metalness).toBeCloseTo(0.04);
        expect(opaque.material.envMapIntensity).toBeCloseTo(0.55);
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

    it('setWetness generates separate puddles with dual lobes (not wear kinds)', () => {
        RoadTextureGenerator.init();
        RoadTextureGenerator.setWetness('rain');
        const straight = RoadTextureGenerator.getTexture('straight');
        const puddles = straight.userData.puddles;
        expect(puddles.length).toBeGreaterThanOrEqual(1);
        expect(puddles.length).toBeLessThanOrEqual(3);
        expect(puddles.every((p) => p.kind === 'puddle')).toBe(true);
        for (const p of puddles) {
            expect(p.lobes?.length).toBeGreaterThanOrEqual(2);
            // Large, mostly round main body
            expect(p.lobes[0].rx).toBeGreaterThanOrEqual(32);
            expect(p.lobes[0].ry / p.lobes[0].rx).toBeGreaterThan(0.85);
        }
        // Clear has no puddles
        RoadTextureGenerator.setWetness('clear');
        expect(RoadTextureGenerator.getTexture('straight').userData.puddles).toEqual([]);
    });

    it('crosswalk has no wear/puddles; intersection stays sparse', () => {
        RoadTextureGenerator.init();
        RoadTextureGenerator.setWetness('rain');
        expect(RoadTextureGenerator.getTexture('crosswalk').userData.wetPatches).toEqual([]);
        expect(RoadTextureGenerator.getTexture('crosswalk').userData.puddles).toEqual([]);
        const ix = RoadTextureGenerator.getTexture('intersection').userData.wetPatches;
        expect(ix.length).toBeLessThanOrEqual(2);
        expect(ix.every((p) => p.kind === 'pothole' || p.kind === 'rut')).toBe(true);
        const ixPuddles = RoadTextureGenerator.getTexture('intersection').userData.puddles;
        expect(ixPuddles.length).toBeGreaterThan(0);
        expect(ixPuddles.every((p) => p.kind === 'puddle')).toBe(true);
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
        expect(mesh.material.envMapIntensity).toBeCloseTo(0.55);

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
        expect(mesh.material.envMapIntensity).toBeCloseTo(0.55);
        expect(RoadTextureGenerator.getTexture('straight').userData.puddles.length).toBeGreaterThan(0);
    });

    it('_wetPatchCount stays low for rain (no stamp spam)', () => {
        RoadTextureGenerator._wetness = 'rain';
        expect(RoadTextureGenerator._wetPatchCount('straight')).toBeLessThanOrEqual(2);
        expect(RoadTextureGenerator._wetPatchCount('intersection')).toBeLessThanOrEqual(1);
        expect(RoadTextureGenerator._wetPatchCount('crosswalk')).toBeLessThanOrEqual(1);
        RoadTextureGenerator._wetness = 'clear';
        expect(RoadTextureGenerator._wetPatchCount('straight')).toBeLessThanOrEqual(1);
    });

    it('paints each puddle with a single gradient, not one per lobe', () => {
        // Three lobes each filled with their own radial ramp stacked three
        // gradients on top of one another, and every lobe boundary showed as a
        // step — the concentric "donut" rings. The lobes must describe one
        // silhouette that a single gradient fills.
        const gradients = [];
        const ctx = {
            save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
            beginPath: () => {}, ellipse: () => {}, fill: () => {},
            createRadialGradient: () => {
                const g = { addColorStop: () => {} };
                gradients.push(g);
                return g;
            }
        };
        const puddle = {
            x: 100, y: 100, rot: 0, intensity: 1,
            lobes: [
                { ox: 0, oy: 0, rx: 40, ry: 38, rot: 0 },
                { ox: 5, oy: -4, rx: 32, ry: 30, rot: 0 },
                { ox: -8, oy: 6, rx: 16, ry: 15, rot: 0 }
            ]
        };

        RoadTextureGenerator.addPuddlesAlbedo(ctx, [puddle]);
        expect(gradients.length).toBe(1);

        gradients.length = 0;
        RoadTextureGenerator.addPuddlesRoughness(ctx, [puddle]);
        expect(gradients.length).toBe(1);
    });

    it('_puddleCount is rain-only and zero on crosswalk', () => {
        RoadTextureGenerator._wetness = 'clear';
        expect(RoadTextureGenerator._puddleCount('straight')).toBe(0);
        RoadTextureGenerator._wetness = 'rain';
        expect(RoadTextureGenerator._puddleCount('straight')).toBe(3);
        expect(RoadTextureGenerator._puddleCount('intersection')).toBe(2);
        expect(RoadTextureGenerator._puddleCount('crosswalk')).toBe(0);
    });
});
