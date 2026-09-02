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

/** Pin a car onto lane edge `index -> index + 1`, with no lane jitter, for determinism. */
function bindToLane(car, laneName, index) {
    const lane = Waypoints.lanes[laneName];
    car.ai.fromNode = lane[index];
    car.ai.node = lane[index + 1];
    car.ai.laneOffset = 0;
    car.ai.needsRetarget = false;
}

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
        expect(Math.abs(car.physics.velX) + Math.abs(car.physics.velY)).toBeGreaterThan(0);
    });

    it('should stop car when obstacle is ahead', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1); // spawn
        const car = World.getEntitiesByType('car')[0];

        // Deterministic lane + heading so the obstacle stays in the forward sensor cone
        bindToLane(car, 'EW_0_E', 0);
        const y = Waypoints.paths.EW_0_E[0].y;
        car.transform.x = 1000;
        car.transform.y = y;
        car.transform.angle = 0;
        car.ai.vx = 120;
        car.ai.vy = 0;
        car.ai.currentSpeed = 120;
        car.ai.maxSpeed = 120;

        const obstacle = new Entity('obs', 'player', car.transform.x + 90, car.transform.y);
        World.entities.push(obstacle);

        for (let i = 0; i < 40; i++) TrafficSystem.update(0.1);

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
        const colors = ['#1a1a1a', '#3a2f2c', '#262b2e', '#22262e', '#a8a49c', '#332e29'];
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

    it('should spawn cars bound to a lane edge with a small lane bias', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.despawnRadius = 5000;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        const from = Waypoints.getNode(car.ai.fromNode);
        const target = Waypoints.getNode(car.ai.node);
        expect(from).not.toBeNull();
        expect(target).not.toBeNull();
        expect(Waypoints.getSuccessors(car.ai.fromNode)).toContain(car.ai.node);
        // Personal lane jitter is small — the car still sits on its own lane
        expect(Math.abs(car.ai.laneOffset)).toBeLessThanOrEqual(6);
        const { latDist } = TrafficSystem.projectOnSegment(car, from, target);
        expect(latDist).toBeLessThan(1);
    });

    it('should steer toward its target node', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        const target = Waypoints.getNode(car.ai.node);
        // Point away from target so steering has work to do
        car.transform.angle = Math.atan2(target.y - car.transform.y, target.x - car.transform.x) + 1.0;
        const angleBefore = car.transform.angle;

        TrafficSystem.update(0.05);

        const desired = Math.atan2(target.y - car.transform.y, target.x - car.transform.x);
        const errBefore = Math.abs(Math.atan2(Math.sin(desired - angleBefore), Math.cos(desired - angleBefore)));
        const errAfter = Math.abs(Math.atan2(Math.sin(desired - car.transform.angle), Math.cos(desired - car.transform.angle)));
        expect(errAfter).toBeLessThan(errBefore);
    });

    it('should advance onto a successor of the reached node, never a U-turn', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        bindToLane(car, 'NS_0_S', 0);

        for (let i = 0; i < 200; i++) {
            const from = Waypoints.getNode(car.ai.fromNode);
            const reached = car.ai.node;
            TrafficSystem.advanceNode(car);

            expect(car.ai.fromNode).toBe(reached);
            expect(Waypoints.getSuccessors(reached)).toContain(car.ai.node);

            // Outgoing leg never reverses the incoming one
            const node = Waypoints.getNode(reached);
            const next = Waypoints.getNode(car.ai.node);
            const inLen = Math.hypot(node.x - from.x, node.y - from.y);
            const outLen = Math.hypot(next.x - node.x, next.y - node.y);
            const dot = ((node.x - from.x) / inLen) * ((next.x - node.x) / outLen)
                + ((node.y - from.y) / inLen) * ((next.y - node.y) / outLen);
            expect(dot).toBeGreaterThan(-0.5);
        }
    });

    it('should turn onto the cross street sometimes and mostly go straight', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        const lane = Waypoints.lanes.NS_0_S;
        let straight = 0;
        let turned = 0;

        for (let i = 0; i < 400; i++) {
            bindToLane(car, 'NS_0_S', 0);
            const options = Waypoints.turnOptions(lane[1], lane[0]);
            TrafficSystem.advanceNode(car);
            if (car.ai.node === options.straight) straight++;
            else turned++;
        }

        expect(turned).toBeGreaterThan(0);
        expect(straight).toBeGreaterThan(turned);
    });

    it('should hand a car at the city edge to the opposite lane instead of reversing', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        const lane = Waypoints.lanes.NS_0_S;
        const deadEnd = Waypoints.getNode(lane[lane.length - 1]);
        car.ai.fromNode = lane[lane.length - 2];
        car.ai.node = lane[lane.length - 1];
        car.ai.laneOffset = 0;
        car.transform.x = deadEnd.x;
        car.transform.y = deadEnd.y;

        TrafficSystem.update(0.016);

        expect(car.ai.node).toBe(Waypoints.lanes.NS_0_N[0]);
        // No teleport — the car is still at the map edge where it arrived
        expect(Math.hypot(car.transform.x - deadEnd.x, car.transform.y - deadEnd.y)).toBeLessThan(30);
    });

    it('should seek back toward path when far off (no teleport)', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];
        bindToLane(car, 'NS_0_S', 0);
        const prev = Waypoints.getNode(car.ai.fromNode);
        const target = Waypoints.getNode(car.ai.node);

        car.transform.x = (prev.x + target.x) / 2 + 150;
        car.transform.y = (prev.y + target.y) / 2 + 150;
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

        const y = Waypoints.paths.EW_0_E[0].y;
        car.ai.needsRetarget = true;
        car.ai.laneOffset = 0;
        // Mid-block, so the nearest lane is unambiguously the eastbound one
        car.transform.x = 1400;
        car.transform.y = y + 200;
        car.transform.angle = 0; // heading east

        TrafficSystem.update(0.016);

        expect(car.ai.needsRetarget).toBe(false);
        expect(car.ai.recovering).toBe(true);
        // Rebound to an eastbound edge — the lane that matches where it points
        const from = Waypoints.getNode(car.ai.fromNode);
        const target = Waypoints.getNode(car.ai.node);
        expect(target.x).toBeGreaterThan(from.x);
    });
    it('should reduce speed gradually as obstacle approaches (braking lerp)', () => {
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

        bindToLane(car, 'EW_0_E', 0);
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

        bindToLane(car, 'EW_0_E', 0);
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
        // Soft MTV separation away from the other car — not a large teleport
        expect(car.transform.x).toBeLessThan(originalX);
        expect(originalX - car.transform.x).toBeLessThanOrEqual(2.5 + 1e-6);
    });

    it('should brake without teleporting when only the next step would hit another car', () => {
        TrafficSystem.maxCars = 1;
        TrafficSystem.spawnRadius = 0;
        TrafficSystem.update(0.1);
        const car = World.getEntitiesByType('car')[0];

        bindToLane(car, 'EW_0_E', 0);
        car.ai.vx = 200;
        car.ai.vy = 0;
        const y = Waypoints.paths.EW_0_E[0].y;
        car.transform.x = 1000;
        car.transform.y = y;
        car.transform.angle = 0;
        car.transform.width = 40;
        car.transform.height = 40;
        car.ai.currentSpeed = 200;
        car.ai.maxSpeed = 200;

        // Close ahead but not overlapping yet; next step at high speed would collide
        World.entities.push({
            type: 'car',
            transform: { x: 1045, y: y, width: 40, height: 40 }
        });

        const originalX = car.transform.x;
        const originalY = car.transform.y;
        TrafficSystem.update(0.05);

        expect(car.ai.currentSpeed).toBeLessThan(200);
        expect(Math.hypot(car.transform.x - originalX, car.transform.y - originalY)).toBeLessThan(1);
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
