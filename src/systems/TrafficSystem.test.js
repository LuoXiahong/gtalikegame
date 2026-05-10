import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrafficSystem } from './TrafficSystem.js';
import { World } from '../world/World.js';
import { Entity } from '../entities/Entity.js';

vi.mock('../world/World.js', () => ({
    World: {
        entities: [],
        addEntity: vi.fn(e => World.entities.push(e)),
        getEntitiesByType: vi.fn(type => World.entities.filter(e => e.type === type)),
        width: 3000,
        height: 3000
    }
}));

describe('TrafficSystem', () => {
    beforeEach(() => {
        World.entities = [];
        vi.clearAllMocks();
    });

    it('should spawn cars when below maxCars', () => {
        TrafficSystem.maxCars = 3;
        TrafficSystem.update(0.1);
        expect(World.entities.length).toBe(1);
        
        TrafficSystem.update(0.1);
        TrafficSystem.update(0.1);
        expect(World.entities.length).toBe(3);
    });

    it('should not spawn cars when at maxCars', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.update(0.1);
        expect(World.entities.length).toBe(1);
        
        TrafficSystem.update(0.1);
        expect(World.entities.length).toBe(1);
    });

    it('should update traffic car velocity based on path', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.update(0.016); // spawn
        TrafficSystem.update(0.016); // update velocity
        const car = World.entities[0];
        
        expect(car.ai).toBeDefined();
        expect(car.ai.type).toBe('traffic');
        // Sprawdzamy czy auto ma jakąkolwiek prędkość (velX lub velY)
        expect(Math.abs(car.physics.velX) + Math.abs(car.physics.velY)).toBeGreaterThan(0);
    });

    it('should stop car when obstacle is ahead', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.update(0.1); // spawn
        TrafficSystem.update(0.1); // update logic & angle
        const car = World.entities[0];
        
        // Przeszkoda 100px przed autem (zależy od ścieżki, car.transform.angle jest już ustawione po pierwszym update)
        const obstacle = new Entity('obs', 'player', car.transform.x + Math.cos(car.transform.angle) * 100, car.transform.y + Math.sin(car.transform.angle) * 100);
        
        World.entities.push(obstacle);
        
        // Update a few times to let currentSpeed slow down
        for(let i=0; i<100; i++) TrafficSystem.update(0.1);
        
        expect(car.ai.currentSpeed).toBeLessThan(1);
    });

    it('should spawn car only if start point is outside player radius', () => {
        TrafficSystem.maxCars = 1;
        const originalRadius = TrafficSystem.spawnRadius;
        TrafficSystem.spawnRadius = 99999; // make sure everything is within spawn radius
        
        const player = { type: 'player', transform: { x: 1500, y: 1500 } };
        World.entities.push(player);
        
        TrafficSystem.update(0.1);
        expect(World.getEntitiesByType('car').length).toBe(0);
        
        // Restore/lower radius
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        expect(World.getEntitiesByType('car').length).toBe(1);
        
        TrafficSystem.spawnRadius = originalRadius;
    });

    it('should spawn car with one of the predefined colors', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
        expect(colors).toContain(car.visual.color);
    });
});
