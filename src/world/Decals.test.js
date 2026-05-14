import { describe, it, expect, beforeEach } from 'vitest';
import { Decals } from './Decals.js';

describe('Decals', () => {
    beforeEach(() => {
        Decals.items = [];
    });

    it('should initialize with an empty items array', () => {
        expect(Decals.items).toEqual([]);
    });

    it('should populate items when init is called', () => {
        Decals.init();
        expect(Decals.items.length).toBeGreaterThan(0);
    });

    it('should contain 4 crosswalks at correct positions', () => {
        Decals.init();
        const crosswalks = Decals.items.filter(item => item.type === 'crosswalk');
        expect(crosswalks.length).toBe(4);

        // Expected crosswalks
        // mid = 1500, offset = 150
        const expected = [
            { x: 1500, y: 1350, w: 180, h: 80 },
            { x: 1500, y: 1650, w: 180, h: 80 },
            { x: 1350, y: 1500, w: 80, h: 180 },
            { x: 1650, y: 1500, w: 80, h: 180 }
        ];

        expected.forEach(exp => {
            const found = crosswalks.find(cw =>
                cw.x === exp.x && cw.y === exp.y && cw.w === exp.w && cw.h === exp.h
            );
            expect(found).toBeDefined();
        });
    });

    it('should contain lane markings excluding the center area', () => {
        Decals.init();
        const lanes = Decals.items.filter(item => item.type === 'lane');

        // Vertical lanes (parallel to Y axis, x is fixed)
        const verticalLanes = lanes.filter(l => l.w === 4);
        // Horizontal lanes (parallel to X axis, y is fixed)
        const horizontalLanes = lanes.filter(l => l.h === 4);

        expect(verticalLanes.length).toBeGreaterThan(0);
        expect(horizontalLanes.length).toBeGreaterThan(0);

        const mid = 1500;
        const offset = 150;
        const exclusionZone = offset + 100; // 250

        lanes.forEach(lane => {
            if (lane.w === 4) {
                // Vertical lane: should not be in the y-range [mid - exclusionZone, mid + exclusionZone]
                expect(Math.abs(lane.y - mid)).toBeGreaterThan(exclusionZone);
                expect(lane.x).toBe(mid + 5);
            } else {
                // Horizontal lane: should not be in the x-range [mid - exclusionZone, mid + exclusionZone]
                expect(Math.abs(lane.x - mid)).toBeGreaterThan(exclusionZone);
                expect(lane.y).toBe(mid + 5);
            }
        });
    });

    it('should have consistent properties for all items', () => {
        Decals.init();
        Decals.items.forEach(item => {
            expect(item).toHaveProperty('x');
            expect(item).toHaveProperty('y');
            expect(item).toHaveProperty('w');
            expect(item).toHaveProperty('h');
            expect(item).toHaveProperty('type');
            expect(['crosswalk', 'lane']).toContain(item.type);
        });
    });
});
