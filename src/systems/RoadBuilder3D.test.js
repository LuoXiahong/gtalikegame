import { describe, it, expect, vi } from 'vitest';
import { RoadBuilder3D } from './RoadBuilder3D.js';

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
    });
});
