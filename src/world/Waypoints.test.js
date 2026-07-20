import { describe, it, expect } from 'vitest';
import { Waypoints } from './Waypoints.js';
import { WorldGrid } from './WorldGrid.js';

describe('Waypoints', () => {
    it('should define traffic paths for both street axes and directions', () => {
        expect(Waypoints.paths).toBeDefined();
        expect(Waypoints.paths.NS_0_S).toBeDefined();
        expect(Waypoints.paths.NS_0_N).toBeDefined();
        expect(Waypoints.paths.NS_1_S).toBeDefined();
        expect(Waypoints.paths.EW_0_E).toBeDefined();
        expect(Waypoints.paths.EW_0_W).toBeDefined();
        expect(Waypoints.paths.EW_1_E).toBeDefined();
    });

    it('should contain valid coordinates for waypoints', () => {
        const path = Waypoints.paths.NS_0_S;
        expect(path.length).toBeGreaterThan(0);
        expect(typeof path[0].x).toBe('number');
        expect(typeof path[0].y).toBe('number');
    });

    it('should keep vertical paths on street centers from WorldGrid', () => {
        const centers = WorldGrid.getStreetCenters();
        const lane = Waypoints.LANE_OFFSET;

        expect(Waypoints.paths.NS_0_S[0].x).toBe(centers[0] + lane);
        expect(Waypoints.paths.NS_0_N[0].x).toBe(centers[0] - lane);
        expect(Waypoints.paths.NS_1_S[0].x).toBe(centers[1] + lane);
        expect(Waypoints.paths.EW_0_E[0].y).toBe(centers[0] + lane);
        expect(Waypoints.paths.EW_1_W[0].y).toBe(centers[1] - lane);
    });

    it('should not place paths inside city blocks', () => {
        Object.values(Waypoints.paths).forEach(path => {
            path.forEach(node => {
                expect(WorldGrid.isPointInAnyBlock(node.x, node.y)).toBe(false);
            });
        });
    });
});
