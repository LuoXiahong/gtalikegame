/**
 * On-foot player movement from keyboard input.
 */
import { InputSystem } from '../input/InputManager.js';

// Base speed is 100 px/s, so this lands sprinting exactly on RUN_SPEED (220)
// from CharacterAnimationSystem — sprinting reads as a full run, not a fast walk.
export const SPRINT_MULT = 2.2;

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
                const speed = entity.physics.speed * (InputSystem.keys.sprint ? SPRINT_MULT : 1);
                entity.physics.velX += intentX * speed * dt;
                entity.physics.velY += intentY * speed * dt;
            } else {
                // Extra hard stop when keys are released (game-like snap).
                entity.physics.velX *= 0.3;
                entity.physics.velY *= 0.3;
            }
        }
    }
};
