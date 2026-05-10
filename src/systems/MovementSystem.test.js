import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementSystem } from './MovementSystem.js';
import { World } from '../world/World.js';

// Mockowanie zależności
vi.mock('../world/World.js', () => ({
    World: {
        width: 1000,
        height: 1000,
        entities: []
    }
}));

describe('MovementSystem', () => {
    let mockEntity;

    beforeEach(() => {
        mockEntity = {
            id: 'e1',
            transform: { x: 100, y: 100, angle: 0 },
            physics: { velX: 0, velY: 0, friction: 0.5 }
        };
        
        World.entities = [mockEntity];
    });

    it('should update position based on velocity', () => {
        mockEntity.physics.velX = 10;
        mockEntity.physics.velY = 5;
        // Friction 0.5: 10*0.5 = 5, 5*0.5 = 2.5
        // x = 100 + 5 = 105, y = 100 + 2.5 = 102.5
        MovementSystem.update(0.1);
        
        expect(mockEntity.transform.x).toBe(105);
        expect(mockEntity.transform.y).toBe(102.5);
    });

    it('should stop movement if velocity falls below threshold', () => {
        mockEntity.physics.velX = 0.15;
        MovementSystem.update(0.1); // 0.15 * 0.5 = 0.075 < 0.1
        
        expect(mockEntity.physics.velX).toBe(0);
    });

    it('should respect world boundaries', () => {
        mockEntity.transform.x = 5;
        mockEntity.physics.velX = -10;
        MovementSystem.update(0.1); // 5 - 5 = 0 (boundary)
        
        expect(mockEntity.transform.x).toBe(0);
        
        mockEntity.transform.x = 995;
        mockEntity.physics.velX = 10;
        MovementSystem.update(0.1); // 995 + 5 = 1000 (boundary)
        expect(mockEntity.transform.x).toBe(1000);
    });
});
