/**
 * System kolizji (CollisionSystem)
 */
import { World } from './World.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { EventBus } from '../core/EventBus.js';

export const CollisionSystem = {
    checkAABB(r1, r2) {
        // r1: {x, y, width, height}, r2: {x, y, w, h}
        return r1.x - r1.width / 2 < r2.x + r2.w &&
            r1.x + r1.width / 2 > r2.x &&
            r1.y - r1.height / 2 < r2.y + r2.h &&
            r1.y + r1.height / 2 > r2.y;
    },

    update() {
        const players = World.getEntitiesByType('player');
        if (players.length === 0) return;
        const p = players[0];

        const controlled = VehicleSystem.getControlledEntity();

        // 1. Kolizje sterowanego obiektu z Budynkami
        if (controlled) {
            World.buildings.forEach(b => {
                if (this.checkAABB(controlled.transform, b)) {
                    controlled.transform.x -= controlled.physics.velX;
                    controlled.transform.y -= controlled.physics.velY;
                    controlled.physics.velX = 0;
                    controlled.physics.velY = 0;
                }
            });
        }

        // 2. Kolizje Gracza z Autami (tylko gdy gracz jest pieszo)
        if (controlled && controlled.type === 'player') {
            World.getEntitiesByType('car').forEach(car => {
                // Jeśli gracz wsiada, nie blokuj go kolizją
                if (car.occupied) return;

                const carBox = { 
                    x: car.transform.x - car.transform.width / 2, 
                    y: car.transform.y - car.transform.height / 2, 
                    w: car.transform.width, 
                    h: car.transform.height 
                };
                if (this.checkAABB(p.transform, carBox)) {
                    p.transform.x -= p.physics.velX;
                    p.transform.y -= p.physics.velY;
                    p.physics.velX = 0;
                    p.physics.velY = 0;
                }
            });
        }

        // 3. Kolizje sterowanego Auta z NPC
        if (controlled && controlled.type === 'car') {
            World.getEntitiesByType('npc').forEach(npc => {
                const npcBox = {
                    x: npc.transform.x - npc.transform.width / 2,
                    y: npc.transform.y - npc.transform.height / 2,
                    w: npc.transform.width,
                    h: npc.transform.height
                };

                if (this.checkAABB(controlled.transform, npcBox)) {
                    if (Math.abs(controlled.physics.speed) > 20) {
                        const dx = npc.transform.x - controlled.transform.x;
                        const dy = npc.transform.y - controlled.transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        
                        // Odepchnięcie NPC
                        npc.transform.x += (dx / dist) * 30;
                        npc.transform.y += (dy / dist) * 30;
                        
                        // Spowolnienie auta
                        controlled.physics.speed *= 0.8;
                        
                        EventBus.emit('npc_hit', { npc, car: controlled });
                    }
                }
            });
        }
    }
};
