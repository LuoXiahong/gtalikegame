/**
 * System AI (AISystem)
 * NPC: state machine, decyzje
 */
import { World } from '../world/World.js';

export const AISystem = {
    update(dt) {
        const npcs = World.getEntitiesByType('npc');

        npcs.forEach(npc => {
            npc.ai.timer -= dt;

            if (npc.ai.timer <= 0) {
                // FSM: Zmiana stanu
                if (Math.random() < 0.45) {
                    npc.ai.state = 'idle';
                    npc.ai.timer = 1 + Math.random() * 2; // Timer w sekundach
                    npc.physics.velX = 0;
                    npc.physics.velY = 0;
                } else {
                    npc.ai.state = 'walk';
                    npc.transform.angle = Math.random() * Math.PI * 2;
                    npc.ai.timer = 2 + Math.random() * 3;

                    npc.physics.velX = Math.cos(npc.transform.angle) * npc.physics.speed * dt;
                    npc.physics.velY = Math.sin(npc.transform.angle) * npc.physics.speed * dt;
                }
            }

            // Animacja proceduralna (odseparowana od rendera)
            if (npc.ai.state === 'walk') {
                npc.visual.walkCycle += 10 * dt;
            } else {
                npc.visual.walkCycle = 0;
            }
        });
    }
};
