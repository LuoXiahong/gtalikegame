import { describe, it, expect } from 'vitest';
import { NPC } from './NPC.js';
import { PedestrianPaths } from '../world/PedestrianPaths.js';
import { World } from '../world/World.js';

describe('NPC', () => {
    it('should initialize NPC with sidewalk patrol by default', () => {
        World.init();
        const npc = new NPC('npc1', 550, 550, '#aaa');

        expect(npc.id).toBe('npc1');
        expect(npc.type).toBe('npc');
        expect(npc.transform.width).toBe(18);
        expect(npc.physics.speed).toBe(80);
        expect(npc.ai.state).toBe('idle');
        expect(npc.ai.waypoints.length).toBe(4);
        expect(PedestrianPaths.isOnSidewalk(npc.transform.x, npc.transform.y)).toBe(true);
    });

    it('should use provided waypoints when passed', () => {
        const pts = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
        const npc = new NPC('npc2', 10, 10, '#bbb', pts);
        expect(npc.ai.waypoints).toEqual(pts);
        expect(npc.transform.x).toBe(10);
        expect(npc.transform.y).toBe(10);
    });
});
