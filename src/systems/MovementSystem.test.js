import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementSystem } from './MovementSystem.js';
import { World } from '../world/World.js';

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
        // dt = 1/60 is the frame rate `friction` is tuned for, so the decay
        // factor is exactly 0.5: 10*0.5 = 5, 5*0.5 = 2.5
        // x = 100 + 5 = 105, y = 100 + 2.5 = 102.5
        MovementSystem.update(1 / 60);

        expect(mockEntity.transform.x).toBe(105);
        expect(mockEntity.transform.y).toBe(102.5);
    });

    it('should stop movement if velocity falls below threshold', () => {
        mockEntity.physics.velX = 0.15;
        MovementSystem.update(1 / 60); // 0.15 * 0.5 = 0.075 < 0.1

        expect(mockEntity.physics.velX).toBe(0);
    });

    it('[REGRESSION] friction decays the same total fraction whether split into many frames or one', () => {
        // Before this fix, `velX *= friction` applied the same multiplier once
        // per update() call regardless of dt — a tab stall producing one big dt
        // decayed velocity far less than the same wall-clock time spent at a
        // steady frame rate would. Six dt=1/60 updates and one dt=6/60 update
        // must now leave the same velocity behind (position still differs, since
        // it's integrated once per call — that's ordinary step-size behavior,
        // not what this guards against).
        // x/y start away from WORLD_MARGIN so the boundary clamp never fires —
        // this test is only about the friction decay math.
        const stepped = { transform: { x: 500, y: 500 }, physics: { velX: 100, velY: 0, friction: 0.5 } };
        const jumped = { transform: { x: 500, y: 500 }, physics: { velX: 100, velY: 0, friction: 0.5 } };

        World.entities = [stepped];
        for (let i = 0; i < 6; i++) MovementSystem.update(1 / 60);

        World.entities = [jumped];
        MovementSystem.update(6 / 60);

        expect(jumped.physics.velX).toBeCloseTo(stepped.physics.velX, 9);
    });

    it('should respect world boundaries (clamped by WORLD_MARGIN)', () => {
        // Entity width = 20 → hw = 10, but WORLD_MARGIN = 50 takes over
        mockEntity.transform.width = 20;
        mockEntity.transform.height = 20;
        const margin = 50; // WORLD_MARGIN

        mockEntity.transform.x = 5;
        mockEntity.physics.velX = -10;
        MovementSystem.update(0.1);
        expect(mockEntity.transform.x).toBe(margin);
        expect(mockEntity.physics.velX).toBe(0);

        mockEntity.transform.x = 995;
        mockEntity.physics.velX = 10;
        MovementSystem.update(0.1);
        expect(mockEntity.transform.x).toBe(1000 - margin);
        expect(mockEntity.physics.velX).toBe(0);
    });

    it('should reset speed on boundary collision for vehicles', () => {
        mockEntity.type = 'car';
        mockEntity.transform.width = 20;
        mockEntity.transform.height = 20;
        mockEntity.physics.speed = 500;
        mockEntity.transform.x = 2;
        mockEntity.physics.velX = -10;
        MovementSystem.update(0.1);
        expect(mockEntity.physics.speed).toBe(0);
    });

    // --- REGRESSION ---

    it('[REGRESSION] player walkSpeed is untouched after hitting map boundary', () => {
        // On foot, physics.walkSpeed is the base walk speed (e.g. 100) — a separate
        // field from Car's physics.speed, so the boundary clamp's `physics.speed`
        // zeroing can never touch it. Without this the player permanently loses
        // movement after the first wall contact.
        mockEntity.type = 'player';
        mockEntity.transform.width = 20;
        mockEntity.transform.height = 20;
        mockEntity.physics.walkSpeed = 100;

        mockEntity.transform.x = 5;    // past boundary (WORLD_MARGIN = 50)
        mockEntity.physics.velX = -20;
        MovementSystem.update(0.1);

        expect(mockEntity.transform.x).toBe(50);       // clamped to margin
        expect(mockEntity.physics.velX).toBe(0);        // wall-directed velX cleared
        expect(mockEntity.physics.walkSpeed).toBe(100); // walkSpeed kept — player can still walk
    });

    it('[REGRESSION] player can move again after leaving map boundary', () => {
        // Hit wall, then next frame receive velX from input
        mockEntity.type = 'player';
        mockEntity.transform.width = 20;
        mockEntity.transform.height = 20;
        mockEntity.physics.walkSpeed = 100;

        // Frame 1: hit left wall
        mockEntity.transform.x = 5;
        mockEntity.physics.velX = -20;
        MovementSystem.update(0.1);
        expect(mockEntity.transform.x).toBe(50);
        expect(mockEntity.physics.walkSpeed).toBe(100);

        // Frame 2: input gives rightward velocity — player should move
        mockEntity.physics.velX = 10;
        const xBefore = mockEntity.transform.x;
        MovementSystem.update(0.1);
        expect(mockEntity.transform.x).toBeGreaterThan(xBefore);
    });
});
