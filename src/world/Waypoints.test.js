import { describe, it, expect } from 'vitest';
import { Waypoints } from './Waypoints.js';

describe('Waypoints', () => {
    it('should define traffic paths for north-south and west-east directions', () => {
        expect(Waypoints.paths).toBeDefined();
        expect(Waypoints.paths.NORTH_SOUTH).toBeDefined();
        expect(Waypoints.paths.SOUTH_NORTH).toBeDefined();
        expect(Waypoints.paths.WEST_EAST).toBeDefined();
        expect(Waypoints.paths.EAST_WEST).toBeDefined();
    });

    it('should contain valid coordinates for waypoints', () => {
        const path = Waypoints.paths.NORTH_SOUTH;
        expect(path.length).toBeGreaterThan(0);
        expect(typeof path[0].x).toBe('number');
        expect(typeof path[0].y).toBe('number');
    });
});
