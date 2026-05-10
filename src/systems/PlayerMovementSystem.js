/**
 * System ruchu gracza (pieszo)
 */
import { InputSystem } from '../input/InputManager.js';

export const PlayerMovementSystem = {
    update(dt, entity) {
        if (!entity || entity.type !== 'player') return;

        // 1. Obrót
        if (InputSystem.keys.left) entity.transform.angle -= 4 * dt;
        if (InputSystem.keys.right) entity.transform.angle += 4 * dt;

        // 2. Intencja ruchu
        let intentX = 0;
        let intentY = 0;

        if (InputSystem.keys.up) {
            intentX += Math.cos(entity.transform.angle);
            intentY += Math.sin(entity.transform.angle);
        }
        if (InputSystem.keys.down) {
            intentX -= Math.cos(entity.transform.angle);
            intentY -= Math.sin(entity.transform.angle);
        }

        // 3. Aplikacja do fizyki
        if (entity.physics) {
            entity.physics.velX += intentX * entity.physics.speed * dt;
            entity.physics.velY += intentY * entity.physics.speed * dt;
        }
    }
};
