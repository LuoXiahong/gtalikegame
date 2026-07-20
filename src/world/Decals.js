/**
 * Ground decorations (crosswalks, lane markings).
 */
import { WorldGrid } from './WorldGrid.js';

export const Decals = {
    items: [],

    init() {
        this.items = [];
        const centers = WorldGrid.getStreetCenters();
        const roadWidth = WorldGrid.STREET_WIDTH;
        const offset = roadWidth / 2 + 50; // just outside intersection / sidewalk edge

        centers.forEach(cx => {
            centers.forEach(cy => {
                this.items.push(
                    { x: cx, y: cy - offset, w: 180, h: 80, type: 'crosswalk' },
                    { x: cx, y: cy + offset, w: 180, h: 80, type: 'crosswalk' },
                    { x: cx - offset, y: cy, w: 80, h: 180, type: 'crosswalk' },
                    { x: cx + offset, y: cy, w: 80, h: 180, type: 'crosswalk' }
                );
            });
        });

        // Dashed lane lines along street axes (skip near intersections)
        centers.forEach(mid => {
            for (let y = 100; y < 3000; y += 200) {
                const nearIntersection = centers.some(cy => Math.abs(y - cy) < offset + 100);
                if (!nearIntersection) {
                    this.items.push({ x: mid + 5, y: y, w: 4, h: 60, type: 'lane' });
                }
            }
            for (let x = 100; x < 3000; x += 200) {
                const nearIntersection = centers.some(cx => Math.abs(x - cx) < offset + 100);
                if (!nearIntersection) {
                    this.items.push({ x: x, y: mid + 5, w: 60, h: 4, type: 'lane' });
                }
            }
        });
    }
};
