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
                const ent = controlled.transform;
                const hw = ent.width / 2;
                const hh = ent.height / 2;

                if (this.checkAABB(ent, b)) {
                    // Oblicz nakładanie się (overlap) z każdej strony
                    const overlapLeft = (ent.x + hw) - b.x;
                    const overlapRight = (b.x + b.w) - (ent.x - hw);
                    const overlapTop = (ent.y + hh) - b.y;
                    const overlapBottom = (b.y + b.h) - (ent.y - hh);

                    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                    if (minOverlap === overlapLeft) {
                        ent.x -= overlapLeft;
                        if (controlled.physics) controlled.physics.velX = 0;
                    } else if (minOverlap === overlapRight) {
                        ent.x += overlapRight;
                        if (controlled.physics) controlled.physics.velX = 0;
                    } else if (minOverlap === overlapTop) {
                        ent.y -= overlapTop;
                        if (controlled.physics) controlled.physics.velY = 0;
                    } else if (minOverlap === overlapBottom) {
                        ent.y += overlapBottom;
                        if (controlled.physics) controlled.physics.velY = 0;
                    }
                }
            });
        }

        // 2. Kolizje Gracza z Autami (tylko gdy gracz jest pieszo)
        if (controlled && controlled.type === 'player') {
            World.getEntitiesByType('car').forEach(car => {
                if (car.occupied) return;

                const ent = p.transform;
                const hw = ent.width / 2;
                const hh = ent.height / 2;
                
                const b = { 
                    x: car.transform.x - car.transform.width / 2, 
                    y: car.transform.y - car.transform.height / 2, 
                    w: car.transform.width, 
                    h: car.transform.height 
                };

                if (this.checkAABB(ent, b)) {
                    const overlapLeft = (ent.x + hw) - b.x;
                    const overlapRight = (b.x + b.w) - (ent.x - hw);
                    const overlapTop = (ent.y + hh) - b.y;
                    const overlapBottom = (b.y + b.h) - (ent.y - hh);

                    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                    if (minOverlap === overlapLeft) {
                        ent.x -= overlapLeft;
                        p.physics.velX = 0;
                    } else if (minOverlap === overlapRight) {
                        ent.x += overlapRight;
                        p.physics.velX = 0;
                    } else if (minOverlap === overlapTop) {
                        ent.y -= overlapTop;
                        p.physics.velY = 0;
                    } else if (minOverlap === overlapBottom) {
                        ent.y += overlapBottom;
                        p.physics.velY = 0;
                    }
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
                    if (Math.abs(controlled.physics.speed) > 10) {
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
