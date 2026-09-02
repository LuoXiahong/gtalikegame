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

    it('should offset every lane toward the right-hand side of its travel direction', () => {
        const centers = WorldGrid.getStreetCenters();

        Object.keys(Waypoints.lanes).forEach(name => {
            const [axis, index] = name.split('_');
            const center = centers[Number(index)];
            const path = Waypoints.paths[name];
            const len = Math.hypot(path[1].x - path[0].x, path[1].y - path[0].y);
            const dirX = (path[1].x - path[0].x) / len;
            const dirY = (path[1].y - path[0].y) / len;
            // y-down screen space: the right-hand side of heading (dx, dy) is (-dy, dx)
            const rightX = -dirY * Waypoints.LANE_OFFSET;
            const rightY = dirX * Waypoints.LANE_OFFSET;

            if (axis === 'NS') {
                expect(path[0].x).toBe(center + rightX);
            } else {
                expect(path[0].y).toBe(center + rightY);
            }
        });
    });

    it('should keep vertical paths on street centers from WorldGrid', () => {
        const centers = WorldGrid.getStreetCenters();
        const lane = Waypoints.LANE_OFFSET;

        expect(Waypoints.paths.NS_0_S[0].x).toBe(centers[0] - lane);
        expect(Waypoints.paths.NS_0_N[0].x).toBe(centers[0] + lane);
        expect(Waypoints.paths.NS_1_S[0].x).toBe(centers[1] - lane);
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

    it('should segment every lane at each intersection it crosses', () => {
        const centers = WorldGrid.getStreetCenters();
        // Both terminals + a near and a far node per crossed intersection
        const expected = 2 + centers.length * 2;

        Object.values(Waypoints.lanes).forEach(lane => {
            expect(lane.length).toBe(expected);
        });
    });

    it('should give every node an exit and keep the whole network reachable', () => {
        const start = Waypoints.lanes.NS_0_S[0];
        const seen = new Set([start]);
        const queue = [start];

        while (queue.length > 0) {
            Waypoints.getSuccessors(queue.pop()).forEach(next => {
                if (!seen.has(next)) {
                    seen.add(next);
                    queue.push(next);
                }
            });
        }

        expect(seen.size).toBe(Object.keys(Waypoints.nodes).length);
        Object.keys(Waypoints.nodes).forEach(id => {
            expect(Waypoints.getSuccessors(id).length).toBeGreaterThan(0);
        });
    });

    it('should never offer a U-turn on any two-edge walk', () => {
        Waypoints.edges.forEach(edge => {
            const from = Waypoints.nodes[edge.from];
            const node = Waypoints.nodes[edge.to];
            const inX = (node.x - from.x) / edge.length;
            const inY = (node.y - from.y) / edge.length;

            Waypoints.getSuccessors(edge.to).forEach(nextId => {
                const next = Waypoints.nodes[nextId];
                const len = Math.hypot(next.x - node.x, next.y - node.y);
                const dot = ((next.x - node.x) / len) * inX + ((next.y - node.y) / len) * inY;
                expect(dot).toBeGreaterThan(-0.5);
            });
        });
    });

    it('should offer a southbound car a right turn west and a left turn east', () => {
        const lane = Waypoints.lanes.NS_0_S;
        const nearNode = Waypoints.nodes[lane[1]];
        const farNode = Waypoints.nodes[lane[2]];
        const near = Waypoints.turnOptions(lane[1], lane[0]);
        const far = Waypoints.turnOptions(lane[2], lane[1]);

        // Near node: right turn only (west), and straight continues south
        expect(Waypoints.nodes[near.right].x).toBeLessThan(nearNode.x);
        expect(near.left).toBeNull();
        expect(Waypoints.nodes[near.straight].y).toBeGreaterThan(nearNode.y);

        // Far node: left turn only (east)
        expect(Waypoints.nodes[far.left].x).toBeGreaterThan(farNode.x);
        expect(far.right).toBeNull();
        expect(Waypoints.nodes[far.straight].y).toBeGreaterThan(farNode.y);
    });

    it('should offer an eastbound car a right turn south and a left turn north', () => {
        const lane = Waypoints.lanes.EW_0_E;
        const nearNode = Waypoints.nodes[lane[1]];
        const farNode = Waypoints.nodes[lane[2]];
        const near = Waypoints.turnOptions(lane[1], lane[0]);
        const far = Waypoints.turnOptions(lane[2], lane[1]);

        expect(Waypoints.nodes[near.right].y).toBeGreaterThan(nearNode.y);
        expect(near.left).toBeNull();
        expect(Waypoints.nodes[far.left].y).toBeLessThan(farNode.y);
        expect(far.right).toBeNull();
    });

    it('should turn a car around onto the opposite lane at the city edge', () => {
        const lane = Waypoints.lanes.NS_0_S;
        const deadEnd = lane[lane.length - 1];
        const successors = Waypoints.getSuccessors(deadEnd);

        expect(successors).toEqual([Waypoints.lanes.NS_0_N[0]]);
        // Same edge of the map, just the other side of the street
        expect(Waypoints.nodes[successors[0]].y).toBe(Waypoints.nodes[deadEnd].y);
        expect(Waypoints.nodes[successors[0]].x).not.toBe(Waypoints.nodes[deadEnd].x);
    });
});
