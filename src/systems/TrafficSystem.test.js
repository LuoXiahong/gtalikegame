import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrafficSystem } from './TrafficSystem.js';
import { World } from '../world/World.js';
import { Entity } from '../entities/Entity.js';
import { Waypoints } from '../world/Waypoints.js';

vi.mock('../world/World.js', () => ({
    World: {
        entities: [],
        addEntity: vi.fn(e => World.entities.push(e)),
        removeEntity: vi.fn(id => { World.entities = World.entities.filter(e => e.id !== id); }),
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

    it('should remove car when farther than despawnRadius from player', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.despawnRadius = 100; // Small despawn radius
        
        const player = { type: 'player', transform: { x: 100, y: 100 } };
        World.entities.push(player);
        
        TrafficSystem.update(0.1); // Spawns a car
        const car = World.getEntitiesByType('car')[0];
        
        // Place car 200px away (outside 100px despawnRadius)
        car.transform.x = 300;
        car.transform.y = 100;
        
        const originalCarId = car.id;
        TrafficSystem.update(0.1); // This should trigger despawn
        
        const remainingCars = World.getEntitiesByType('car');
        const originalCarExists = remainingCars.some(c => c.id === originalCarId);
        expect(originalCarExists).toBe(false);
    });

    it('should NOT remove occupied car even outside despawnRadius', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.despawnRadius = 100;
        
        const player = { type: 'player', transform: { x: 100, y: 100 } };
        World.entities.push(player);
        
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        // Make car occupied
        car.occupied = true;
        car.transform.x = 300;
        car.transform.y = 100;
        
        TrafficSystem.update(0.1);
        expect(World.getEntitiesByType('car').length).toBe(1);
    });

    it('should assign a consistent laneOffset to each spawned car', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        expect(car.ai.laneOffset).toBeDefined();
        expect(car.ai.laneOffset).toBeGreaterThanOrEqual(-15);
        expect(car.ai.laneOffset).toBeLessThanOrEqual(15);
    });

    it('should use laneOffset in target computation', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        // Force laneOffset to a specific non-zero value
        car.ai.laneOffset = 20;
        
        const path = Waypoints.paths[car.ai.pathName];
        const rawTarget = path[car.ai.targetIndex];
        
        // Let's run a single update to update direction/velocity
        TrafficSystem.update(0.016);
        
        // Raw direction angle to target without offset
        const rawAngle = Math.atan2(rawTarget.y - car.transform.y, rawTarget.x - car.transform.x);
        
        // Because of lane offset, the actual car transform angle must be different from the raw angle to target
        expect(car.transform.angle).not.toBe(rawAngle);
    });
});
