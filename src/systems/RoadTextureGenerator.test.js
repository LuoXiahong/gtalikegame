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

    it('setWetness increases wet patch count for rain', () => {
        RoadTextureGenerator.init();
        const clearCount = RoadTextureGenerator.getTexture('straight').userData.wetPatches.length;
        RoadTextureGenerator.setWetness('rain');
        const rainCount = RoadTextureGenerator.getTexture('straight').userData.wetPatches.length;
        expect(rainCount).toBeGreaterThan(clearCount);
        expect(RoadTextureGenerator._wetness).toBe('rain');
    });
});
