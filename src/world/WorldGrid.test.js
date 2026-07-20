import { describe, it, expect } from 'vitest';
import { WorldGrid } from './WorldGrid.js';

describe('WorldGrid', () => {
    it('should export correct layout constants', () => {
        expect(WorldGrid.BLOCK_SIZE).toBe(500);
        expect(WorldGrid.STREET_WIDTH).toBe(200);
        expect(WorldGrid.GRID_COLS).toBe(3);
        expect(WorldGrid.GRID_ROWS).toBe(3);
        expect(WorldGrid.PADDING).toBe(500);
    });

    it('should calculate correct block bounds for given row and col', () => {
        // Block [0, 0]
        const b00 = WorldGrid.getBlockBounds(0, 0);
        expect(b00).toEqual({
            x: 500,
            y: 500,
            w: 500,
            h: 500
        });

        // Block [1, 1]
        const b11 = WorldGrid.getBlockBounds(1, 1);
        expect(b11).toEqual({
            x: 500 + 1 * (500 + 200),
            y: 500 + 1 * (500 + 200),
            w: 500,
            h: 500
        });

        // Block [2, 1]
        const b21 = WorldGrid.getBlockBounds(2, 1);
        expect(b21).toEqual({
            x: 500 + 1 * (500 + 200),
            y: 500 + 2 * (500 + 200),
            w: 500,
            h: 500
        });
    });

    it('should return correct street centers', () => {
        expect(WorldGrid.getStreetCenters()).toEqual([1100, 1800]);
    });

    it('should return null for out-of-bounds indices', () => {
        expect(WorldGrid.getBlockBounds(-1, 0)).toBeNull();
        expect(WorldGrid.getBlockBounds(0, 3)).toBeNull();
    });

    it('should determine whether a point lies in any block correctly', () => {
        // Inside block [0, 0] (e.g. x=600, y=600)
        expect(WorldGrid.isPointInAnyBlock(600, 600)).toBe(true);

        // On vertical street between columns 0 and 1 (e.g. x=1100, y=600)
        expect(WorldGrid.isPointInAnyBlock(1100, 600)).toBe(false);

        // In outer padding margin (e.g. x=100, y=100)
        expect(WorldGrid.isPointInAnyBlock(100, 100)).toBe(false);
    });
});
