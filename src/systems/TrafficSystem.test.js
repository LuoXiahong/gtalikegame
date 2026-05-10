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
        World.buildings = [];
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

    it('should reduce speed gradually as obstacle approaches (lerp hamowania)', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        car.transform.x = 100;
        car.transform.y = 100;
        car.transform.angle = 0; // heading east
        
        // Obstacle 140px in front (between minStopDist=100 and sensorDist=180)
        const obs = { type: 'player', transform: { x: 240, y: 100 } };
        World.entities.push(obs);
        
        const speedMult = TrafficSystem.computeSpeedMult(car);
        expect(speedMult).toBeGreaterThan(0);
        expect(speedMult).toBeLessThan(1);
    });

    it('should not react to obstacle at side', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        car.transform.x = 100;
        car.transform.y = 100;
        car.transform.angle = 0; // heading east
        
        // Obstacle at side (90 deg, angleToOther = PI/2)
        const obs = { type: 'player', transform: { x: 100, y: 150 } };
        World.entities.push(obs);
        
        const speedMult = TrafficSystem.computeSpeedMult(car);
        expect(speedMult).toBe(1.0);
    });

    it('should stop when obstacle within 100px ahead', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        car.transform.x = 100;
        car.transform.y = 100;
        car.transform.angle = 0; // heading east
        
        // Obstacle 80px in front (within minStopDist=100)
        const obs = { type: 'player', transform: { x: 180, y: 100 } };
        World.entities.push(obs);
        
        const speedMult = TrafficSystem.computeSpeedMult(car);
        expect(speedMult).toBe(0);
    });

    it('should slow down or stop when approaching a building obstacle', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        car.transform.x = 100;
        car.transform.y = 100;
        car.transform.angle = 0; // heading east
        
        // Building in front
        World.buildings.push({ x: 200, y: 80, w: 50, h: 40 }); // directly in path of EAST ray
        
        const speedMult = TrafficSystem.computeSpeedMult(car);
        expect(speedMult).toBeLessThan(1.0); // should detect and slow down or stop
    });

    it('should trigger collision reaction (stop & bounce) on overlap with building', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        car.transform.x = 100;
        car.transform.y = 100;
        car.transform.width = 90;
        car.transform.height = 45;
        car.ai.currentSpeed = 100;
        
        // Place building overlapping predicted next position
        // If heading EAST (angle = 0, nextX = 100 + 10 = 110)
        World.buildings.push({ x: 120, y: 80, w: 50, h: 40 });
        
        const originalX = car.transform.x;
        
        // Update
        TrafficSystem.update(0.1);
        
        // Speed should be reset to 0
        expect(car.ai.currentSpeed).toBe(0);
        expect(car.physics.velX).toBe(0);
        
        // Position should be bounced back (pushed away from building center at x=145, meaning pushed WEST to < 100)
        expect(car.transform.x).toBeLessThan(originalX);
    });

    it('should trigger collision reaction (stop & bounce) on overlap with another car', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        car.transform.x = 100;
        car.transform.y = 100;
        car.transform.width = 90;
        car.transform.height = 45;
        car.ai.currentSpeed = 100;
        
        const otherCar = {
            type: 'car',
            transform: { x: 120, y: 100, width: 90, height: 45 }
        };
        World.entities.push(otherCar);
        
        const originalX = car.transform.x;
        
        TrafficSystem.update(0.1);
        
        expect(car.ai.currentSpeed).toBe(0);
        expect(car.physics.velX).toBe(0);
        // Pushed away from otherCar center at x=120, meaning WEST to < 100
        expect(car.transform.x).toBeLessThan(originalX);
    });

    it('should activate avoidance behavior when approaching another car closely in front', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        car.transform.x = 100;
        car.transform.y = 100;
        
        const path = Waypoints.paths[car.ai.pathName];
        const target = path[car.ai.targetIndex];
        target.x = 1000;
        target.y = 100;
        
        const otherCar = {
            type: 'car',
            transform: { x: 200, y: 105, width: 90, height: 45 }
        };
        World.entities.push(otherCar);
        
        TrafficSystem.update(0.1);
        
        expect(car.ai.avoidTimer).toBe(1.5);
        expect(car.ai.avoidAngleOffset).not.toBe(0);
    });

    it('should decrement avoidTimer over updates and clear offset when expired', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        
        car.ai.avoidTimer = 0.2;
        car.ai.avoidAngleOffset = 0.4;
        
        TrafficSystem.update(0.1); // decrements by dt (0.1)
        expect(car.ai.avoidTimer).toBeCloseTo(0.1);
        expect(car.ai.avoidAngleOffset).toBe(0.4);
        
        TrafficSystem.update(0.1); // decrements to 0
        expect(car.ai.avoidTimer).toBe(0);
        expect(car.ai.avoidAngleOffset).toBe(0);
    });
});
