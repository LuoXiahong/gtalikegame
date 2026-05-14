import { describe, it, expect, vi } from 'vitest';
import { CityBuilder3D } from './CityBuilder3D.js';

describe('CityBuilder3D', () => {
    it('should build city elements and populate collections', () => {
        const mockRenderSystem = {
            scene: { add: vi.fn() },
            sidewalks: [],
            buildingZones: [],
            buildings: [],
            trees: [],
            billboards: [],
            contactShadowTexture: {}
        };

        CityBuilder3D.buildCity(mockRenderSystem);
        expect(mockRenderSystem.sidewalks.length).toBeGreaterThan(0);
        expect(mockRenderSystem.buildings.length).toBeGreaterThan(0);
        expect(mockRenderSystem.trees.length).toBeGreaterThan(0);
    });
});
