import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerMovementSystem, SPRINT_MULT } from './PlayerMovementSystem.js';
import { MovementSystem } from './MovementSystem.js';
import { InputSystem } from '../input/InputManager.js';
import { World } from '../world/World.js';

vi.mock('../input/InputManager.js', () => ({
    InputSystem: {
        keys: { up: false, down: false, left: false, right: false, sprint: false }
    }
}));

vi.mock('../world/World.js', () => ({
    World: { width: 100000, height: 100000, entities: [] }
}));

describe('PlayerMovementSystem', () => {
    let mockPlayer;

    beforeEach(() => {
        mockPlayer = {
            id: 'p1',
            type: 'player',
            transform: { x: 100, y: 100, angle: 0 },
            physics: { velX: 0, velY: 0, walkSpeed: 100, friction: 1 }
        };
        
        // Reset inputs
        InputSystem.keys = { up: false, down: false, left: false, right: false, sprint: false };
    });

    it('should apply velocity when UP is pressed', () => {
        InputSystem.keys.up = true;
        // angle = 0, cos(0)=1. velX = 1 * 100 * 0.1 = 10
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

    it('should scale speed by SPRINT_MULT while sprinting', () => {
        InputSystem.keys.up = true;
        InputSystem.keys.sprint = true;

        PlayerMovementSystem.update(0.1, mockPlayer);

        expect(mockPlayer.physics.velX).toBeCloseTo(10 * SPRINT_MULT);
    });

    it('true sprint speed is exactly walkSpeed*SPRINT_MULT, any frame rate', () => {
        // velX is assigned fresh each frame as walkSpeed*SPRINT_MULT*dt, so
        // true speed (velX/dt) lands there immediately — and stays there
        // regardless of frame rate, unlike an accumulate-then-decay loop.
        InputSystem.keys.up = true;
        InputSystem.keys.sprint = true;
        const dt = 1 / 60;

        PlayerMovementSystem.update(dt, mockPlayer);

        expect(mockPlayer.physics.velX / dt).toBeCloseTo(mockPlayer.physics.walkSpeed * SPRINT_MULT, 5);
    });

    it('true speed stays walkSpeed regardless of frame rate (no accumulation feedback)', () => {
        InputSystem.keys.up = true;

        for (const dt of [1 / 30, 1 / 60, 1 / 144, 1 / 240]) {
            mockPlayer.physics.velX = 0;
            mockPlayer.physics.velY = 0;
            PlayerMovementSystem.update(dt, mockPlayer);
            expect(mockPlayer.physics.velX / dt).toBeCloseTo(100, 5);
        }
    });

    it('should not sprint without the sprint key', () => {
        InputSystem.keys.up = true;

        PlayerMovementSystem.update(0.1, mockPlayer);

        expect(mockPlayer.physics.velX).toBeCloseTo(10);
    });

    it('should apply extra deceleration when no keys are pressed', () => {
        mockPlayer.physics.velX = 20;
        mockPlayer.physics.velY = 20;
        // dt = 1/60 is the frame rate the 0.3 hard-stop decay is tuned for.
        PlayerMovementSystem.update(1 / 60, mockPlayer);
        expect(mockPlayer.physics.velX).toBe(6); // 20 * 0.3
        expect(mockPlayer.physics.velY).toBe(6);
    });

    // --- REGRESSION ---

    it('[REGRESSION] real-world walking speed (through MovementSystem too) is frame-rate independent', () => {
        // The isolated PlayerMovementSystem tests above ("true speed stays walkSpeed
        // regardless of frame rate") passed even with the bug this guards against —
        // they never run MovementSystem.update(), which is where the real damage
        // happened. MovementSystem.update()'s `velX *= decayFactor(friction, dt)` was
        // applied on top of PlayerMovementSystem's already-dt-scaled velX every single
        // frame, not just while coasting to a stop, because friction was 0.5 instead of
        // 1. decayFactor scales correctly for a value that persists between frames, but
        // this velX is recreated from scratch every frame — stacking a second,
        // uncancelled dt-dependent factor on top gave real speed = walkSpeed *
        // friction^(60*dt): walkSpeed*0.5 at 60fps, walkSpeed*0.25 at 30fps (2x slower),
        // matching the reported symptom exactly. Runs a full second of ticks at three
        // frame rates and compares net distance traveled, which is what a player
        // actually experiences — not just the value of one field after one call.
        InputSystem.keys.up = true;
        const distances = {};

        for (const fps of [30, 60, 144]) {
            const dt = 1 / fps;
            const player = {
                id: 'p1',
                type: 'player',
                transform: { x: 50000, y: 50000, angle: 0, width: 20, height: 20 },
                physics: { velX: 0, velY: 0, walkSpeed: 100, friction: 1 },
            };
            World.entities = [player];
            const startX = player.transform.x;

            // Fixed step count rather than accumulating `t += dt` — float drift on the
            // loop condition can add or drop a step and swamp the effect under test.
            for (let i = 0; i < fps; i++) {
                PlayerMovementSystem.update(dt, player);
                MovementSystem.update(dt);
            }

            distances[fps] = player.transform.x - startX;
        }

        expect(distances[30]).toBeCloseTo(distances[60], 0);
        expect(distances[60]).toBeCloseTo(distances[144], 0);
        // Sanity: roughly walkSpeed (100 px/s) over the one second simulated, not half
        // or a quarter of it.
        expect(distances[60]).toBeGreaterThan(90);
    });
});
