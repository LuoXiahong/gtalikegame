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
        const colors = ['#1a1a1a', '#5c1a1a', '#1a3a2a', '#1a2744', '#d4c5a9', '#3d2e1f'];
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
        expect(World.entities.includes(car)).toBe(true);
    });

    it('should spawn cars with zero laneOffset on a path sample', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.despawnRadius = 5000;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        const path = Waypoints.paths[car.ai.pathName];
        expect(car.ai.laneOffset).toBe(0);
        expect(path).toBeDefined();
        // Position lies on the path segment (not necessarily path[0])
        const a = path[0];
        const b = path[1];
        const { latDist } = TrafficSystem.projectOnSegment(car, a, b);
        expect(latDist).toBeLessThan(1);
    });

    it('should steer toward path waypoint target', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        const path = Waypoints.paths[car.ai.pathName];
        const target = path[car.ai.targetIndex];
        // Point away from target so steering has work to do
        car.transform.angle = Math.atan2(target.y - car.transform.y, target.x - car.transform.x) + 1.0;
        const angleBefore = car.transform.angle;

        TrafficSystem.update(0.05);

        const desired = Math.atan2(target.y - car.transform.y, target.x - car.transform.x);
        const errBefore = Math.abs(Math.atan2(Math.sin(desired - angleBefore), Math.cos(desired - angleBefore)));
        const errAfter = Math.abs(Math.atan2(Math.sin(desired - car.transform.angle), Math.cos(desired - car.transform.angle)));
        expect(errAfter).toBeLessThan(errBefore);
    });

    it('should reverse (wayback) at path end instead of jumping to start', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        const path = Waypoints.paths[car.ai.pathName];

        // Place car on the final waypoint, traveling forward
        const last = path[path.length - 1];
        car.transform.x = last.x;
        car.transform.y = last.y;
        car.ai.targetIndex = path.length - 1;
        car.ai.pathDir = 1;

        const posBefore = { x: car.transform.x, y: car.transform.y };
        TrafficSystem.update(0.016);

        expect(car.ai.pathDir).toBe(-1);
        expect(car.ai.targetIndex).toBe(path.length - 2);
        // Still near the end — no teleport to path start
        expect(Math.hypot(car.transform.x - posBefore.x, car.transform.y - posBefore.y)).toBeLessThan(30);
        expect(Math.hypot(car.transform.x - path[0].x, car.transform.y - path[0].y)).toBeGreaterThan(100);
    });

    it('should reverse again at path start (ping-pong)', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        const path = Waypoints.paths[car.ai.pathName];

        car.transform.x = path[0].x;
        car.transform.y = path[0].y;
        car.ai.targetIndex = 0;
        car.ai.pathDir = -1;

        TrafficSystem.update(0.016);

        expect(car.ai.pathDir).toBe(1);
        expect(car.ai.targetIndex).toBe(1);
    });

    it('should seek back toward path when far off (no teleport)', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        const path = Waypoints.paths[car.ai.pathName];
        const prev = path[0];
        const target = path[1];

        car.transform.x = (prev.x + target.x) / 2 + 150;
        car.transform.y = (prev.y + target.y) / 2 + 150;
        car.ai.targetIndex = 1;
        car.ai.recovering = true;
        car.ai.vx = 0;
        car.ai.vy = 0;

        const { nearX, nearY } = TrafficSystem.projectOnSegment(car, prev, target);
        const towardPath = Math.atan2(nearY - car.transform.y, nearX - car.transform.x);
        car.transform.angle = towardPath + 1.2;

        const errBefore = Math.abs(Math.atan2(
            Math.sin(towardPath - car.transform.angle),
            Math.cos(towardPath - car.transform.angle)
        ));

        for (let i = 0; i < 10; i++) TrafficSystem.update(0.05);

        const errAfter = Math.abs(Math.atan2(
            Math.sin(towardPath - car.transform.angle),
            Math.cos(towardPath - car.transform.angle)
        ));
        // Steering reduced heading error toward path — no instant position warp to lane
        expect(errAfter).toBeLessThan(errBefore);
        const midX = (prev.x + target.x) / 2;
        const midY = (prev.y + target.y) / 2;
        // Still not teleported onto the centerline in a single burst
        expect(Math.hypot(car.transform.x - midX, car.transform.y - midY)).toBeGreaterThan(40);
    });

    it('should retarget nearest segment when needsRetarget is set', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        car.ai.pathName = 'EW_0_E';
        car.ai.targetIndex = 1;
        car.ai.needsRetarget = true;
        const y = Waypoints.paths.EW_0_E[0].y;
        car.transform.x = 1800;
        car.transform.y = y + 200;

        TrafficSystem.update(0.016);

        expect(car.ai.needsRetarget).toBe(false);
        expect(car.ai.recovering).toBe(true);
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

    it('should trigger collision reaction (dampen & recover) on overlap with building', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        car.ai.pathName = 'EW_0_E';
        car.ai.targetIndex = 1;
        car.ai.driftTimer = 0;
        car.ai.recovering = false;
        car.ai.vx = 100;
        car.ai.vy = 0;
        const y = Waypoints.paths.EW_0_E[0].y;
        car.transform.x = 1000;
        car.transform.y = y;
        car.transform.angle = 0;
        car.transform.width = 90;
        car.transform.height = 45;
        car.ai.currentSpeed = 100;

        World.buildings.push({ x: 1020, y: y - 40, w: 80, h: 80 });

        TrafficSystem.update(0.1);

        expect(car.ai.currentSpeed).toBeLessThan(100);
        expect(car.physics.velX).toBe(0);
        expect(car.ai.recovering).toBe(true);
    });

    it('should trigger collision reaction (dampen & push) on overlap with another car', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        car.ai.pathName = 'EW_0_E';
        car.ai.targetIndex = 1;
        car.ai.driftTimer = 0;
        car.ai.recovering = false;
        car.ai.vx = 100;
        car.ai.vy = 0;
        const y = Waypoints.paths.EW_0_E[0].y;
        car.transform.x = 1000;
        car.transform.y = y;
        car.transform.angle = 0;
        car.transform.width = 90;
        car.transform.height = 45;
        car.ai.currentSpeed = 100;

        const otherCar = {
            type: 'car',
            transform: { x: 1040, y: y, width: 90, height: 45 }
        };
        World.entities.push(otherCar);

        const originalX = car.transform.x;

        TrafficSystem.update(0.1);

        expect(car.ai.currentSpeed).toBeLessThan(100);
        expect(car.physics.velX).toBe(0);
        expect(car.transform.x).toBeLessThan(originalX);
    });

    it('should start a drift with some probability and then recover', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        car.ai.driftTimer = 0;
        car.ai.recovering = false;

        const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
        TrafficSystem.updateDrift(car, 1.0, 10); // on-path latDist
        rand.mockRestore();

        expect(car.ai.driftTimer).toBeGreaterThan(0);
        expect(car.ai.driftAngle).not.toBe(0);

        car.ai.driftTimer = 0.05;
        TrafficSystem.updateDrift(car, 0.1, 10);
        expect(car.ai.driftTimer).toBe(0);
        expect(car.ai.recovering).toBe(true);
    });

    it('should clear recovering once close enough to the path', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        car.ai.driftTimer = 0;
        car.ai.recovering = true;

        TrafficSystem.updateDrift(car, 0.1, 10); // latDist under RECOVER_DONE_DIST
        expect(car.ai.recovering).toBe(false);
    });

    it('should apply velocity inertia instead of instant direction change', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        car.ai.vx = 200;
        car.ai.vy = 0;
        car.ai.currentSpeed = 200;
        car.transform.angle = 0;

        TrafficSystem.applyVelocityInertia(car, 200, 0.05);
        // After pointing would change, inertia keeps some of previous vx
        car.transform.angle = Math.PI / 2;
        TrafficSystem.applyVelocityInertia(car, 200, 0.05);

        expect(car.ai.vx).toBeGreaterThan(0); // still has forward remnant
        expect(car.ai.vy).toBeGreaterThan(0); // starting to pick up new axis
    });
});
