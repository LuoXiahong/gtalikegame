/**
 * Integrates velocity into position, applies friction, clamps to world bounds.
 * Does not handle input — dedicated systems own that.
 */
import { World } from '../world/World.js';

// 50px inset from world edges so entities already outside get pulled back in.
const WORLD_MARGIN = 50;

export const MovementSystem = {
    update(dt) {
        World.entities.forEach(entity => {
            if (entity.physics) {
                entity.physics.velX *= entity.physics.friction;
                entity.physics.velY *= entity.physics.friction;

                // Kill micro-velocities to avoid endless tiny drift.
                if (Math.abs(entity.physics.velX) < 0.1) entity.physics.velX = 0;
                if (Math.abs(entity.physics.velY) < 0.1) entity.physics.velY = 0;

                entity.transform.x += entity.physics.velX;
                entity.transform.y += entity.physics.velY;

                // max(half-size, WORLD_MARGIN) so oversized or out-of-bounds entities
                // are pulled into a safe inset rather than stuck outside.
                const hw = Math.max((entity.transform.width  || 0) / 2, WORLD_MARGIN);
                const hh = Math.max((entity.transform.height || 0) / 2, WORLD_MARGIN);

                if (entity.transform.x < hw) {
                    entity.transform.x = hw;
                    if (entity.physics.velX < 0) entity.physics.velX = 0;
                    if (entity.type === 'car' && entity.physics.speed !== undefined) entity.physics.speed = 0;
                }
                if (entity.transform.x > World.width - hw) {
                    entity.transform.x = World.width - hw;
                    if (entity.physics.velX > 0) entity.physics.velX = 0;
                    if (entity.type === 'car' && entity.physics.speed !== undefined) entity.physics.speed = 0;
                }
                if (entity.transform.y < hh) {
                    entity.transform.y = hh;
                    if (entity.physics.velY < 0) entity.physics.velY = 0;
                    if (entity.type === 'car' && entity.physics.speed !== undefined) entity.physics.speed = 0;
                }
                if (entity.transform.y > World.height - hh) {
                    entity.transform.y = World.height - hh;
                    if (entity.physics.velY > 0) entity.physics.velY = 0;
                    if (entity.type === 'car' && entity.physics.speed !== undefined) entity.physics.speed = 0;
                }
            }
        });
    }
};
