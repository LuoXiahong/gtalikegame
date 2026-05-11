import { describe, it, expect, beforeEach } from 'vitest';
import { FacadeGenerator } from './FacadeGenerator.js';
import * as THREE from 'three';

describe('FacadeGenerator', () => {
    beforeEach(() => {
        FacadeGenerator.textures.clear();
    });

    it('should initialize and populate textures', () => {
        FacadeGenerator.init();
        expect(FacadeGenerator.textures.size).toBe(4);
        expect(FacadeGenerator.textures.has('residential')).toBe(true);
        expect(FacadeGenerator.textures.has('skyscraper')).toBe(true);
        expect(FacadeGenerator.textures.has('shop_front')).toBe(true);
        expect(FacadeGenerator.textures.has('shop_side')).toBe(true);
    });

    it('should create valid THREE.CanvasTexture objects', () => {
        const texture = FacadeGenerator.createCanvasTexture('residential');
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.wrapS).toBe(THREE.RepeatWrapping);
        expect(texture.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture.magFilter).toBe(THREE.NearestFilter);
    });
});
