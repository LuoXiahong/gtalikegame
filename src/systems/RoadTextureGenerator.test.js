import { describe, it, expect, beforeEach } from 'vitest';
import { RoadTextureGenerator } from './RoadTextureGenerator.js';
import * as THREE from 'three';

describe('RoadTextureGenerator', () => {
    beforeEach(() => {
        RoadTextureGenerator.textures.clear();
    });

    it('should initialize and populate textures', () => {
        RoadTextureGenerator.init();
        expect(RoadTextureGenerator.textures.size).toBe(2);
        expect(RoadTextureGenerator.textures.has('straight')).toBe(true);
        expect(RoadTextureGenerator.textures.has('intersection')).toBe(true);
    });

    it('should create valid THREE.CanvasTexture objects via getTexture', () => {
        const texture = RoadTextureGenerator.getTexture('straight');
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.wrapS).toBe(THREE.RepeatWrapping);
        expect(texture.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture.magFilter).toBe(THREE.NearestFilter);
    });
});
