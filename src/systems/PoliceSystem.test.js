import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PoliceSystem } from './PoliceSystem.js';
import { EventBus } from '../core/EventBus.js';
import { GameState, GAME_STATES } from '../core/GameState.js';
import { World } from '../world/World.js';

describe('PoliceSystem', () => {
    beforeEach(() => {
        EventBus.listeners = {};
        World.entities = [];
        vi.spyOn(World, 'addEntity').mockImplementation((e) => {
            World.entities.push(e);
            if (!World.entitiesByType) World.entitiesByType = {};
            if (!World.entitiesByType[e.type]) World.entitiesByType[e.type] = [];
            World.entitiesByType[e.type].push(e);
        });
        vi.spyOn(World, 'removeEntity').mockImplementation((id) => {
            const e = World.entities.find(ent => ent.id === id);
            World.entities = World.entities.filter(e => e.id !== id);
            if (e) {
                World.entitiesByType[e.type] = World.entitiesByType[e.type].filter(ent => ent.id !== id);
            }
        });
        vi.spyOn(World, 'getEntitiesByType').mockImplementation((type) => {
            if (!World.entitiesByType) World.entitiesByType = {};
            return World.entitiesByType[type] || [];
        });
        
        // Mock player target
        const mockPlayer = { type: 'player', transform: { x: 0, y: 0, angle: 0 } };
        World.addEntity(mockPlayer);
        
        PoliceSystem.init();
    });

    it('should activate and spawn police on 2 stars', () => {
        expect(PoliceSystem.isActive).toBe(false);
        EventBus.emit('wanted_level_change', { stars: 2 });
        expect(PoliceSystem.isActive).toBe(true);

        PoliceSystem.update(0.1);
        expect(PoliceSystem.policeCars.length).toBe(1);
        expect(World.entities.length).toBe(2); // player + police
    });

    it('should despawn police when stars drop below 2', () => {
        EventBus.emit('wanted_level_change', { stars: 2 });
        PoliceSystem.update(0.1);
        expect(PoliceSystem.policeCars.length).toBe(1);

        EventBus.emit('wanted_level_change', { stars: 1 });
        expect(PoliceSystem.isActive).toBe(false);
        expect(PoliceSystem.policeCars.length).toBe(0);
        expect(World.entities.length).toBe(1); // just player
    });

    it('should move police towards player', () => {
        EventBus.emit('wanted_level_change', { stars: 2 });
        PoliceSystem.update(0.1);

        const police = PoliceSystem.policeCars[0];
        const player = World.getEntitiesByType('player')[0];
        player.transform.x = 2000;
        player.transform.y = 0;

        const angleBefore = police.transform.angle;
        PoliceSystem.update(0.1);

        expect(police.physics.speed).toBeGreaterThan(0);
        // Soft steer — angle moves toward player, not snaps instantly
        const desired = Math.atan2(player.transform.y - police.transform.y, player.transform.x - police.transform.x);
        const errBefore = Math.abs(Math.atan2(Math.sin(desired - angleBefore), Math.cos(desired - angleBefore)));
        const errAfter = Math.abs(Math.atan2(Math.sin(desired - police.transform.angle), Math.cos(desired - police.transform.angle)));
        expect(errAfter).toBeLessThanOrEqual(errBefore);
    });

    it('should apply inertial velocity (not instant heading snap)', () => {
        EventBus.emit('wanted_level_change', { stars: 2 });
        PoliceSystem.update(0.1);
        const police = PoliceSystem.policeCars[0];
        police.ai.vx = 100;
        police.ai.vy = 0;
        police.transform.angle = 0;
        police.physics.speed = 100;

        const player = World.getEntitiesByType('player')[0];
        player.transform.x = police.transform.x;
        player.transform.y = police.transform.y + 500;

        PoliceSystem.update(0.05);

        expect(police.ai.vx).toBeGreaterThan(0); // remnant of previous direction
        expect(Math.abs(police.physics.velX)).toBeGreaterThan(0);
    });

    it('should reset state correctly', () => {
        PoliceSystem.isActive = true;
        PoliceSystem.policeCars = [{}];
        PoliceSystem.reset();
        expect(PoliceSystem.isActive).toBe(false);
        expect(PoliceSystem.policeCars.length).toBe(0);
    });

    it('should arrest player when police reaches catch radius', () => {
        EventBus.emit('wanted_level_change', { stars: 2 });
        PoliceSystem.update(0.1);

        const police = PoliceSystem.policeCars[0];
        const player = World.getEntitiesByType('player')[0];
        police.transform.x = player.transform.x;
        police.transform.y = player.transform.y;

        PoliceSystem.update(0.1);

        expect(GameState.getState()).toBe(GAME_STATES.WASTED);
        expect(PoliceSystem.isActive).toBe(false);
        expect(PoliceSystem.policeCars.length).toBe(0);
    });
});
