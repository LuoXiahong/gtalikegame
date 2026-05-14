/**
 * System fizyki podstawowej (MovementSystem)
 * Odpowiada za: całkowanie prędkości do pozycji, tarcie, granice świata.
 * NIE zajmuje się wejściem (Input) - od tego są systemy dedykowane.
 */
import { World } from '../world/World.js';

// Minimalny margines od krawędzi świata (50px). Dzięki temu encja,
// która już jest poza granicą, zostaje wciągnięta do środka.
const WORLD_MARGIN = 50;

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

                // Granice świata — minimalny margines WORLD_MARGIN od każdej ściany.
                // Używamy max(hw, WORLD_MARGIN) żeby encja, która jest już poza granicą,
                // została wciągnięta do bezpiecznego obszaru wewnątrz.
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
