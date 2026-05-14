import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PoliceSystem } from './PoliceSystem.js';
import { EventBus } from '../core/EventBus.js';
import { World } from '../world/World.js';
import { VehicleSystem } from './VehicleSystem.js';

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
        // Move player away
        const player = World.getEntitiesByType('player')[0];
        player.transform.x = 2000;
        player.transform.y = 0;

        PoliceSystem.update(0.1);
        
        // Police should accelerate
        expect(police.physics.speed).toBeGreaterThan(0);
        // Angle should be roughly towards player
        expect(police.transform.angle).toBeCloseTo(Math.atan2(player.transform.y - police.transform.y, player.transform.x - police.transform.x));
    });
    it('should include dt in velocity calculation', () => {
        EventBus.emit('wanted_level_change', { stars: 2 });
        PoliceSystem.update(0.1);
        const police = PoliceSystem.policeCars[0];
        
        const dt = 0.5;
        PoliceSystem.update(dt);
        
        const expectedVelX = Math.cos(police.transform.angle) * police.physics.speed * dt;
        expect(police.physics.velX).toBeCloseTo(expectedVelX);
    });

    it('should reset state correctly', () => {
        PoliceSystem.isActive = true;
        PoliceSystem.policeCars = [{}];
        PoliceSystem.reset();
        expect(PoliceSystem.isActive).toBe(false);
        expect(PoliceSystem.policeCars.length).toBe(0);
    });
});
