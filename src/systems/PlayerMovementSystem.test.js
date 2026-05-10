import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerMovementSystem } from './PlayerMovementSystem.js';
import { InputSystem } from '../input/InputManager.js';

vi.mock('../input/InputManager.js', () => ({
    InputSystem: {
        keys: { up: false, down: false, left: false, right: false }
    }
}));

describe('PlayerMovementSystem', () => {
    let mockPlayer;

    beforeEach(() => {
        mockPlayer = {
            id: 'p1',
            type: 'player',
            transform: { x: 100, y: 100, angle: 0 },
            physics: { velX: 0, velY: 0, speed: 100, friction: 0.5 }
        };
        
        // Reset inputs
        InputSystem.keys = { up: false, down: false, left: false, right: false };
    });

    it('should apply velocity when UP is pressed', () => {
        InputSystem.keys.up = true;
        // angle = 0, cos(0)=1. velX += 1 * 100 * 0.1 = 10
        PlayerMovementSystem.update(0.1, mockPlayer);
        expect(mockPlayer.physics.velX).toBe(10);
    });

    it('should change angle when LEFT or RIGHT is pressed', () => {
        InputSystem.keys.left = true;
        // angle -= 6 * 0.1 = 0.6
        PlayerMovementSystem.update(0.1, mockPlayer);
        expect(mockPlayer.transform.angle).toBeCloseTo(-0.6);
    });

    it('should not update if entity is not a player', () => {
        const mockCar = { type: 'car', transform: { angle: 0 } };
        InputSystem.keys.left = true;
        PlayerMovementSystem.update(0.1, mockCar);
        expect(mockCar.transform.angle).toBe(0);
    });

    it('should apply extra deceleration when no keys are pressed', () => {
        mockPlayer.physics.velX = 20;
        mockPlayer.physics.velY = 20;
        PlayerMovementSystem.update(0.1, mockPlayer);
        expect(mockPlayer.physics.velX).toBe(6); // 20 * 0.3
        expect(mockPlayer.physics.velY).toBe(6);
    });
});
