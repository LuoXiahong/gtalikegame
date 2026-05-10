import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';

export const AISystem = {
    init() {
        EventBus.on('gunshot', (data) => {
            const npcs = World.getEntitiesByType('npc');
            npcs.forEach(npc => {
                const dx = npc.transform.x - data.x;
                const dy = npc.transform.y - data.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 600) { // Zasięg słuchu/strachu
                    npc.ai.state = 'flee';
                    npc.ai.timer = 5 + Math.random() * 3; // Ucieczka przez kilka sekund
                    // Ustawienie kąta ucieczki (od gracza)
                    npc.transform.angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
                }
            });
        });

        EventBus.on('explosion', (data) => {
            const npcs = World.getEntitiesByType('npc');
            npcs.forEach(npc => {
                const dx = npc.transform.x - data.x;
                const dy = npc.transform.y - data.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const radius = data.radius || 1000;
                if (dist < radius) {
                    npc.ai.state = 'flee';
                    npc.ai.timer = 8 + Math.random() * 5; // Dłuższy strach po wybuchu
                    npc.transform.angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
                }
            });
        });
    },

    update(dt) {
        const npcs = World.getEntitiesByType('npc');

        npcs.forEach(npc => {
            npc.ai.timer -= dt;

            if (npc.ai.timer <= 0) {
                // FSM: Zmiana stanu (powrót do normalności po ucieczce lub zmiana idle/walk)
                if (Math.random() < 0.45) {
                    npc.ai.state = 'idle';
                    npc.ai.timer = 1 + Math.random() * 2;
                    npc.physics.velX = 0;
                    npc.physics.velY = 0;
                } else {
                    npc.ai.state = 'walk';
                    npc.transform.angle = Math.random() * Math.PI * 2;
                    npc.ai.timer = 2 + Math.random() * 3;
                }
            }

            // Logika ruchu zależna od stanu
            if (npc.ai.state === 'walk') {
                npc.physics.velX = Math.cos(npc.transform.angle) * npc.physics.speed * dt;
                npc.physics.velY = Math.sin(npc.transform.angle) * npc.physics.speed * dt;
                npc.visual.walkCycle += 10 * dt;
            } else if (npc.ai.state === 'flee') {
                // Szybszy bieg w stanie flee
                const fleeSpeed = npc.physics.speed * 2.5;
                npc.physics.velX = Math.cos(npc.transform.angle) * fleeSpeed * dt;
                npc.physics.velY = Math.sin(npc.transform.angle) * fleeSpeed * dt;
                npc.visual.walkCycle += 20 * dt;
            } else {
                npc.physics.velX = 0;
                npc.physics.velY = 0;
                npc.visual.walkCycle = 0;
            }
        });
    }
};
