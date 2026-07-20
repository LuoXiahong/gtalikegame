import { describe, it, expect, vi } from 'vitest';
import { RoadBuilder3D } from './RoadBuilder3D.js';
import { RoadTextureGenerator } from './RoadTextureGenerator.js';

describe('RoadBuilder3D', () => {
    it('should build roads and populate laneMarkings and zebras', () => {
        const mockRenderSystem = {
            scene: { add: vi.fn() },
            laneMarkings: [],
            zebras: [],
            createdIntersections: new Set()
        };

        RoadBuilder3D.buildRoads(mockRenderSystem);
        expect(mockRenderSystem.laneMarkings.length).toBeGreaterThan(0);
        expect(mockRenderSystem.zebras.length).toBeGreaterThan(0);
        expect(mockRenderSystem.laneMarkings[0].material.roughnessMap).toBeDefined();
        expect(mockRenderSystem.zebras[0].material.roughnessMap).toBeDefined();
    });

    it('should share roughness textures from RoadTextureGenerator', () => {
        RoadTextureGenerator.textures.clear();
        RoadTextureGenerator.roughnessTextures.clear();
        const rough = RoadTextureGenerator.getRoughnessTexture('straight');
        expect(rough).toBeDefined();
    });
});
