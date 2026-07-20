import { describe, it, expect, beforeEach } from 'vitest';
import { Decals } from './Decals.js';
import { WorldGrid } from './WorldGrid.js';

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

    it('should place crosswalks at every street intersection', () => {
        Decals.init();
        const crosswalks = Decals.items.filter(item => item.type === 'crosswalk');
        const centers = WorldGrid.getStreetCenters();
        // 4 approaches × each intersection
        expect(crosswalks.length).toBe(centers.length * centers.length * 4);

        centers.forEach(cx => {
            centers.forEach(cy => {
                const near = crosswalks.filter(cw =>
                    Math.abs(cw.x - cx) < 200 && Math.abs(cw.y - cy) < 200
                );
                expect(near.length).toBe(4);
            });
        });
    });

    it('should contain lane markings', () => {
        Decals.init();
        const lanes = Decals.items.filter(item => item.type === 'lane');
        expect(lanes.length).toBeGreaterThan(0);
        lanes.forEach(item => {
            expect(['crosswalk', 'lane']).toContain(item.type);
        });
    });
});
