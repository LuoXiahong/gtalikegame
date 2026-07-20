import { describe, it, expect, vi } from 'vitest';
import { CityBuilder3D } from './CityBuilder3D.js';
import { FacadeGenerator } from './FacadeGenerator.js';

describe('CityBuilder3D', () => {
    it('should build city elements and populate collections', () => {
        const mockRenderSystem = {
            scene: { add: vi.fn() },
            sidewalks: [],
            buildingZones: [],
            buildings: [],
            trees: [],
            billboards: [],
            props: [],
            streetLights: [],
            contactShadowTexture: {}
        };

        CityBuilder3D.buildCity(mockRenderSystem);
        expect(mockRenderSystem.sidewalks.length).toBeGreaterThan(0);
        expect(mockRenderSystem.buildings.length).toBeGreaterThan(0);
        expect(mockRenderSystem.trees.length).toBeGreaterThan(0);
        expect(mockRenderSystem.props.length).toBeGreaterThanOrEqual(18);
        expect(mockRenderSystem.streetLights.length).toBeGreaterThan(0);
    });

    it('should create face materials with emissive maps', () => {
        FacadeGenerator.init();
        const mat = CityBuilder3D.createFaceMaterial('residential', 10, 20, 0x9c4a3a);
        expect(mat.map).toBeDefined();
        expect(mat.emissiveMap).toBeDefined();
        expect(mat.emissiveIntensity).toBeCloseTo(0.4);
        expect(mat.emissiveMap).not.toBe(mat.map);
    });
});
