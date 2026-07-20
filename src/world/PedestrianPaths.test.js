import { describe, it, expect } from 'vitest';
import { PedestrianPaths } from './PedestrianPaths.js';
import { WorldGrid } from './WorldGrid.js';
import { Tilemap, TILE_TYPES } from './Tilemap.js';
import { World } from './World.js';

describe('PedestrianPaths', () => {
    it('should build a 4-point sidewalk loop inside block bounds', () => {
        const loop = PedestrianPaths.getSidewalkLoop(0, 0);
        expect(loop).toHaveLength(4);
        const b = WorldGrid.getBlockBounds(0, 0);
        loop.forEach(p => {
            expect(p.x).toBeGreaterThan(b.x);
            expect(p.x).toBeLessThan(b.x + b.w);
            expect(p.y).toBeGreaterThan(b.y);
            expect(p.y).toBeLessThan(b.y + b.h);
        });
    });

    it('should keep sidewalk loop points on SIDEWALK tiles', () => {
        World.init();
        const loop = PedestrianPaths.getSidewalkLoop(1, 1);
        loop.forEach(p => {
            expect(Tilemap.getTileAt(p.x, p.y)).toBe(TILE_TYPES.SIDEWALK);
        });
    });

    it('should not place loop points on ROAD', () => {
        World.init();
        PedestrianPaths.getAllSidewalkLoops().forEach(({ points }) => {
            points.forEach(p => {
                expect(Tilemap.getTileAt(p.x, p.y)).not.toBe(TILE_TYPES.ROAD);
            });
        });
    });

    it('should return a nearby sidewalk point from the road', () => {
        World.init();
        const near = PedestrianPaths.nearestSidewalkPoint(1100, 1100);
        expect(PedestrianPaths.isOnSidewalk(near.x, near.y)).toBe(true);
    });

    it('should allow stop only on sidewalk, never on road', () => {
        World.init();
        const loop = PedestrianPaths.getSidewalkLoop(0, 0);
        expect(PedestrianPaths.canStop(loop[0].x, loop[0].y)).toBe(true);
        expect(PedestrianPaths.canStop(1100, 1100)).toBe(false);
    });

    it('should build a patrol that crosses the street when requested', () => {
        const patrol = PedestrianPaths.buildPatrol(0, 0, true);
        expect(patrol.length).toBeGreaterThan(4);
        // Mid crossing point should be on/near the road between blocks
        const mid = patrol.find(p => Math.abs(p.x - 1100) < 80);
        expect(mid).toBeDefined();
    });
});
