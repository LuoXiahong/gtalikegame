/**
 * On-foot player movement from keyboard input.
 */
import { InputSystem } from '../input/InputManager.js';

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
                entity.physics.velX += intentX * entity.physics.speed * dt;
                entity.physics.velY += intentY * entity.physics.speed * dt;
            } else {
                // Extra hard stop when keys are released (game-like snap).
                entity.physics.velX *= 0.3;
                entity.physics.velY *= 0.3;
            }
        }
    }
};
