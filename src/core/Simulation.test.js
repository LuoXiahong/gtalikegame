/**
 * Headless integration tests: real World/EventBus/systems, no mocks, no DOM,
 * no Playwright. This is the payoff of extracting Simulation out of Game's
 * DOM/rAF loop (raport-architektura-ecs.md § B2) — a fixed dt run over many
 * ticks can assert real gameplay invariants directly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Simulation } from './Simulation.js';
import { World } from '../world/World.js';
import { PedestrianPaths } from '../world/PedestrianPaths.js';
import { GameConfig } from './GameConfig.js';

const DT = 1 / 60;

function runTicks(n) {
    for (let i = 0; i < n; i++) Simulation.step(DT);
}

describe('Simulation (headless)', () => {
    beforeEach(() => {
        World.init();
        Simulation.spawnEntities();
    });

    it('spawns the player, 10 NPCs, and one car', () => {
        expect(World.getEntitiesByType('player').length).toBe(1);
        expect(World.getEntitiesByType('npc').length).toBe(10);
        expect(World.getEntitiesByType('car').length).toBe(1);
    });

    it('starts with the player as the controlled entity', () => {
        const controlled = World.getControlled();
        expect(controlled).toBeDefined();
        expect(controlled.type).toBe('player');
    });

    it('runs 500 ticks without throwing or producing non-finite positions', () => {
        expect(() => runTicks(500)).not.toThrow();

        World.entities.forEach(ent => {
            expect(Number.isFinite(ent.transform.x)).toBe(true);
            expect(Number.isFinite(ent.transform.y)).toBe(true);
        });
    });

    it('keeps every entity within world bounds after many ticks', () => {
        runTicks(500);

        World.entities.forEach(ent => {
            expect(ent.transform.x).toBeGreaterThanOrEqual(0);
            expect(ent.transform.x).toBeLessThanOrEqual(World.width);
            expect(ent.transform.y).toBeGreaterThanOrEqual(0);
            expect(ent.transform.y).toBeLessThanOrEqual(World.height);
        });
    });

    it('never leaves an idle NPC off a sidewalk (AISystem\'s hard "never idle on the road" rule)', () => {
        runTicks(500);

        World.getEntitiesByType('npc').forEach(npc => {
            if (npc.ai.state === 'idle') {
                expect(PedestrianPaths.canStop(npc.transform.x, npc.transform.y)).toBe(true);
            }
        });
    });

    it('spawns traffic up to the configured cap as ticks pass', () => {
        runTicks(60); // 1 simulated second — TrafficSystem tries to spawn every tick it's under cap

        const trafficCars = World.getEntitiesByType('car').filter(c => c.ai?.type === 'traffic');
        expect(trafficCars.length).toBeGreaterThan(0);
        expect(trafficCars.length).toBeLessThanOrEqual(GameConfig.TRAFFIC.MAX_CARS);
    });

    it('reset() restores a fresh world with the original entity counts', () => {
        runTicks(100);
        Simulation.reset();

        expect(World.getEntitiesByType('player').length).toBe(1);
        expect(World.getEntitiesByType('npc').length).toBe(10);
        expect(World.getEntitiesByType('car').length).toBe(1);
        expect(World.getControlled().type).toBe('player');
    });
});
