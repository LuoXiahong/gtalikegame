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

    it('crosswalk paint gets the same env light as the asphalt under it', () => {
        // Paint at envMapIntensity 0 while the wet asphalt sits at 1.1 renders
        // the stripes DARKER than the road; the old isotropic lamps masked it.
        RoadTextureGenerator.setWetness('rain');
        const mockRenderSystem = {
            scene: { add: vi.fn(), environment: {} },
            laneMarkings: [],
            zebras: [],
            createdIntersections: new Set()
        };
        RoadBuilder3D.buildRoads(mockRenderSystem);

        const props = RoadTextureGenerator.getSurfaceMaterialProps();
        const overlays = mockRenderSystem.zebras.filter(m => m.material.transparent);
        expect(overlays.length).toBeGreaterThan(0);
        for (const mesh of overlays) {
            expect(mesh.material.envMapIntensity).toBeCloseTo(props.envMapIntensity);
            // ...without inheriting the asphalt's wet sheen.
            expect(mesh.material.roughness).toBeGreaterThan(props.roughness);
        }
    });

    it('should share roughness textures from RoadTextureGenerator', () => {
        RoadTextureGenerator.textures.clear();
        RoadTextureGenerator.roughnessTextures.clear();
        const rough = RoadTextureGenerator.getRoughnessTexture('straight');
        expect(rough).toBeDefined();
    });
});
