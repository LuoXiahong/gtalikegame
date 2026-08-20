/**
 * On-foot player movement from keyboard input.
 */
import { InputSystem } from '../input/InputManager.js';
import { decayFactor } from '../core/MathUtils.js';

// walkSpeed is 170 px/s, so this lands sprinting at 238 px/s (85.7 km/h) — a
// clear boost over walking but kept under GameConfig.VEHICLE.MAX_SPEED (100 km/h)
// so driving stays the faster way to cover ground.
export const SPRINT_MULT = 1.4;

// Per-frame (60fps-tuned) hard-stop decay applied when movement keys release.
const STOP_DECAY = 0.3;

export const PlayerMovementSystem = {
    update(dt, entity) {
        if (!entity || entity.type !== 'player') return;

        if (InputSystem.keys.left) entity.transform.angle -= 6 * dt;
        if (InputSystem.keys.right) entity.transform.angle += 6 * dt;

        let intentX = 0;
        let intentY = 0;
        let isMoving = false;

        if (InputSystem.keys.up) {
            intentX += Math.cos(entity.transform.angle);
            intentY += Math.sin(entity.transform.angle);
            isMoving = true;
        }
        if (InputSystem.keys.down) {
            intentX -= Math.cos(entity.transform.angle);
            intentY -= Math.sin(entity.transform.angle);
            isMoving = true;
        }

        if (entity.physics) {
            if (isMoving) {
                // `velX`/`velY` are a per-frame displacement (MovementSystem adds them to
                // position as-is, no further `* dt`) — same convention AISystem and
                // VehiclePhysicsSystem use. Assigning fresh each frame (not `+=`) keeps
                // true speed exactly `walkSpeed` regardless of frame rate; accumulating
                // here fed back into MovementSystem's now dt-normalized friction and
                // diverged to unbounded speed at high refresh rates (worse the faster the
                // monitor, worst under sprint) — that was the frame-rate-dependent bug.
                const speed = entity.physics.walkSpeed * (InputSystem.keys.sprint ? SPRINT_MULT : 1);
                entity.physics.velX = intentX * speed * dt;
                entity.physics.velY = intentY * speed * dt;
            } else {
                // Extra hard stop when keys are released (game-like snap).
                const stop = decayFactor(STOP_DECAY, dt);
                entity.physics.velX *= stop;
                entity.physics.velY *= stop;
            }
        }
    }
};
