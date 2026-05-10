/**
 * System fizyki podstawowej (MovementSystem)
 * Odpowiada za: całkowanie prędkości do pozycji, tarcie, granice świata.
 * NIE zajmuje się wejściem (Input) - od tego są systemy dedykowane.
 */
import { World } from '../world/World.js';

export const MovementSystem = {
    update(dt) {
        // Aplikacja tarcia i aktualizacja pozycji dla wszystkich encji z komponentem fizyki
        World.entities.forEach(entity => {
            if (entity.physics) {
                // Tarcie (friction)
                entity.physics.velX *= entity.physics.friction;
                entity.physics.velY *= entity.physics.friction;

                // Zatrzymanie mikro-ruchów (optymalizacja)
                if (Math.abs(entity.physics.velX) < 0.1) entity.physics.velX = 0;
                if (Math.abs(entity.physics.velY) < 0.1) entity.physics.velY = 0;

                // Aktualizacja pozycji
                entity.transform.x += entity.physics.velX;
                entity.transform.y += entity.physics.velY;

                // Granice świata
                if (entity.transform.x < 0) { 
                    entity.transform.x = 0; 
                    entity.physics.velX = 0; 
                }
                if (entity.transform.x > World.width) { 
                    entity.transform.x = World.width; 
                    entity.physics.velX = 0; 
                }
                if (entity.transform.y < 0) { 
                    entity.transform.y = 0; 
                    entity.physics.velY = 0; 
                }
                if (entity.transform.y > World.height) { 
                    entity.transform.y = World.height; 
                    entity.physics.velY = 0; 
                }
            }
        });
    }
};
