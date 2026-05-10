/**
 * System ruchu gracza (pieszo)
 */
import { InputSystem } from '../input/InputManager.js';

export const PlayerMovementSystem = {
    update(dt, entity) {
        if (!entity || entity.type !== 'player') return;

        // 1. Obrót (snappier)
        if (InputSystem.keys.left) entity.transform.angle -= 6 * dt;
        if (InputSystem.keys.right) entity.transform.angle += 6 * dt;

        // 2. Intencja ruchu
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

        // 3. Aplikacja do fizyki (Game-like feel)
        if (entity.physics) {
            if (isMoving) {
                // Szybsza akceleracja (zbalansowana)
                entity.physics.velX += intentX * entity.physics.speed * dt;
                entity.physics.velY += intentY * entity.physics.speed * dt;
            } else {
                // Dodatkowe, natychmiastowe hamowanie po puszczeniu klawiszy
                entity.physics.velX *= 0.3;
                entity.physics.velY *= 0.3;
            }
        }
    }
};
