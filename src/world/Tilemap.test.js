import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Tilemap, TILE_TYPES } from './Tilemap.js';

// Mock World
vi.mock('./World.js', () => ({
    World: {
        width: 1000,
        height: 1000,
        tileSize: 100
    }
}));

describe('Tilemap', () => {
    beforeEach(() => {
        Tilemap.init();
    });

    it('should initialize with correct dimensions', () => {
        expect(Tilemap.cols).toBe(10);
        expect(Tilemap.rows).toBe(10);
        expect(Tilemap.data.length).toBe(10);
        expect(Tilemap.data[0].length).toBe(10);
    });

    it('should set and get tiles correctly', () => {
        Tilemap.setTile(5, 5, TILE_TYPES.ROAD);
        expect(Tilemap.data[5][5]).toBe(TILE_TYPES.ROAD);
    });

    it('should return correct tile type for world coordinates', () => {
        Tilemap.setTile(2, 3, TILE_TYPES.SIDEWALK);
        // (2*100 + 50, 3*100 + 50) = (250, 350)
        expect(Tilemap.getTileAt(250, 350)).toBe(TILE_TYPES.SIDEWALK);
    });

    it('should return GRASS for out of bounds coordinates', () => {
        expect(Tilemap.getTileAt(-10, -10)).toBe(TILE_TYPES.GRASS);
        expect(Tilemap.getTileAt(2000, 2000)).toBe(TILE_TYPES.GRASS);
    });

    it('should generate a simple crossroad pattern', () => {
        // midCol = 5, midRow = 5
        // Row 5 should be ROAD (mostly)
        expect(Tilemap.getTileAt(550, 550)).toBe(TILE_TYPES.ROAD);
        // Column 5 should be ROAD (mostly)
        expect(Tilemap.getTileAt(550, 150)).toBe(TILE_TYPES.ROAD);
    });
});
