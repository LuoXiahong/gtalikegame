import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VehiclePhysicsSystem } from './VehiclePhysicsSystem.js';
import { InputSystem } from '../input/InputManager.js';

vi.mock('../input/InputManager.js', () => ({
    InputSystem: {
        keys: { up: false, down: false, left: false, right: false }
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
                steeringPower: 2.5,
                velX: 0,
                velY: 0
            }
        };
        InputSystem.keys.up = false;
        InputSystem.keys.down = false;
        InputSystem.keys.left = false;
        InputSystem.keys.right = false;
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
        // speed = (100 - 40) * 0.92 = 55.2
        expect(mockCar.physics.speed).toBeLessThan(90);
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
        
        // 1. Przyspieszanie od zera
        mockCar.physics.speed = 0;
        VehiclePhysicsSystem.update(0.1, mockCar);
        const accelAtZero = mockCar.physics.speed;
        
        // 2. Przyspieszanie od wyższej prędkości
        mockCar.physics.speed = 300; // Połowa maxSpeed
        VehiclePhysicsSystem.update(0.1, mockCar);
        const accelAtHigh = mockCar.physics.speed - 300;
        
        expect(accelAtHigh).toBeLessThan(accelAtZero);
    });
});
