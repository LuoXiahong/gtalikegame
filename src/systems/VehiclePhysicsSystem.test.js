import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VehiclePhysicsSystem } from './VehiclePhysicsSystem.js';
import { InputSystem } from '../input/InputManager.js';

vi.mock('../input/InputManager.js', () => ({
    InputSystem: {
        keys: { up: false, down: false, left: false, right: false, handbrake: false }
    }
}));

describe('VehiclePhysicsSystem', () => {
    let mockCar;

    beforeEach(() => {
        mockCar = {
            type: 'car',
            transform: { x: 0, y: 0, angle: 0 },
            physics: {
                speed: 0,
                maxSpeed: 600,
                acceleration: 400,
                rollingResistance: 0.98,
                brakingFriction: 0.92,
                brakeForce: 800,
                steeringPower: 2.5,
                velX: 0,
                velY: 0
            }
        };
        InputSystem.keys.up = false;
        InputSystem.keys.down = false;
        InputSystem.keys.left = false;
        InputSystem.keys.right = false;
        InputSystem.keys.handbrake = false;
    });

    it('should accelerate when UP is pressed', () => {
        InputSystem.keys.up = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        expect(mockCar.physics.speed).toBeGreaterThan(0);
        expect(mockCar.physics.velX).toBeGreaterThan(0);
    });

    it('should slow down due to rolling resistance when no input', () => {
        mockCar.physics.speed = 100;
        VehiclePhysicsSystem.update(0.1, mockCar);
        // rollingResistance is 0.98, so 100 * 0.98 = 98
        expect(mockCar.physics.speed).toBeCloseTo(98);
    });

    it('should steer when moving', () => {
        mockCar.physics.speed = 100;
        InputSystem.keys.right = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        expect(mockCar.transform.angle).toBeGreaterThan(0);
    });

    it('should NOT steer when stationary', () => {
        mockCar.physics.speed = 0;
        InputSystem.keys.right = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        expect(mockCar.transform.angle).toBe(0);
    });

    it('should brake faster when DOWN is pressed while moving forward', () => {
        mockCar.physics.speed = 100;
        InputSystem.keys.down = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        // speed = 100 - 800 * 0.1 = 20
        expect(mockCar.physics.speed).toBeCloseTo(20);
    });

    it('should brake to a full stop when speed is lower than deceleration step', () => {
        mockCar.physics.speed = 50;
        InputSystem.keys.down = true;
        VehiclePhysicsSystem.update(0.1, mockCar); // brakeDecel is 80, so it stops
        expect(mockCar.physics.speed).toBe(0);
    });

    it('should cap max speed', () => {
        mockCar.physics.speed = 600;
        InputSystem.keys.up = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        expect(mockCar.physics.speed).toBe(600);
    });

    it('should steer in reverse in opposite direction', () => {
        mockCar.physics.speed = -100;
        InputSystem.keys.right = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        // speed < 0, steerDir = 1, reverseFactor = -1
        // angle += 1 * 2.5 * factor * -1 * 0.1
        expect(mockCar.transform.angle).toBeLessThan(0);
    });

    it('should accelerate slower at higher speeds due to acceleration curve', () => {
        InputSystem.keys.up = true;
        
        // 1. Accelerate from standstill
        mockCar.physics.speed = 0;
        VehiclePhysicsSystem.update(0.1, mockCar);
        const accelAtZero = mockCar.physics.speed;
        
        // 2. Accelerate from higher speed
        mockCar.physics.speed = 300; // half maxSpeed
        VehiclePhysicsSystem.update(0.1, mockCar);
        const accelAtHigh = mockCar.physics.speed - 300;
        
        expect(accelAtHigh).toBeLessThan(accelAtZero);
    });

    it('should reduce traction (drift) when handbraking through a turn', () => {
        mockCar.physics.speed = 200;
        InputSystem.keys.right = true;
        InputSystem.keys.handbrake = true;
        VehiclePhysicsSystem.update(0.1, mockCar);

        // With low drift inertia the velocity vector lags well behind the new heading —
        // it should NOT have caught up to cos/sin(angle)*moveStep the way normal grip would.
        const moveStep = mockCar.physics.speed * 0.1;
        const fullyGrippedVelX = Math.cos(mockCar.transform.angle) * moveStep;
        expect(mockCar.physics.velX).toBeLessThan(fullyGrippedVelX);
        expect(mockCar.physics.velX).toBeGreaterThan(0);
    });

    it('should steer tighter when handbraking than with normal grip', () => {
        mockCar.physics.speed = 200;
        InputSystem.keys.right = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        const normalAngle = mockCar.transform.angle;

        mockCar.transform.angle = 0;
        mockCar.physics.speed = 200;
        InputSystem.keys.handbrake = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        const handbrakeAngle = mockCar.transform.angle;

        expect(handbrakeAngle).toBeGreaterThan(normalAngle);
    });

    it('should scrub off speed while handbraking', () => {
        mockCar.physics.speed = 200;
        InputSystem.keys.handbrake = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        // no throttle input → rolling resistance (0.98) AND handbrake decay (0.985) both apply
        expect(mockCar.physics.speed).toBeCloseTo(200 * 0.98 * 0.985);
    });

    it('should not apply handbrake drift/steer effects when nearly stationary', () => {
        mockCar.physics.speed = 3;
        InputSystem.keys.right = true;
        InputSystem.keys.handbrake = true;
        VehiclePhysicsSystem.update(0.1, mockCar);
        expect(mockCar.transform.angle).toBe(0);
    });
});
