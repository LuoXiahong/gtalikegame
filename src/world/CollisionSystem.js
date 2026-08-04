/**
 * Collision resolution for controlled entity, buildings, cars, and NPCs.
 * Controlled-entity vs building uses oriented (OBB/SAT) overlap so a rotated
 * car's actual footprint is tested, not its axis-aligned bounding box.
 */
import { World } from './World.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { EventBus } from '../core/EventBus.js';

export const CollisionSystem = {
    checkAABB(r1, r2) {
        // r1: center + width/height; r2: top-left + w/h
        return r1.x - r1.width / 2 < r2.x + r2.w &&
            r1.x + r1.width / 2 > r2.x &&
            r1.y - r1.height / 2 < r2.y + r2.h &&
            r1.y + r1.height / 2 > r2.y;
    },

    // Unit axes of a (possibly rotated) box: forward/right for a car, identity for angle 0.
    getAxes(angle) {
        const c = Math.cos(angle || 0);
        const s = Math.sin(angle || 0);
        return [{ x: c, y: s }, { x: -s, y: c }];
    },

    // Half-extent of a box projected onto a unit axis.
    projectRadius(box, axis) {
        const [u, v] = this.getAxes(box.angle);
        return Math.abs(u.x * axis.x + u.y * axis.y) * box.hw +
            Math.abs(v.x * axis.x + v.y * axis.y) * box.hh;
    },

    // Separating Axis Theorem for two (optionally rotated) boxes.
    // Returns the minimum translation vector { axis, overlap } (axis points from A to B), or null if not overlapping.
    satMTV(boxA, boxB) {
        const axes = [...this.getAxes(boxA.angle), ...this.getAxes(boxB.angle)];
        const dx = boxB.cx - boxA.cx;
        const dy = boxB.cy - boxA.cy;

        let minOverlap = Infinity;
        let minAxis = null;

        for (const axis of axes) {
            const rA = this.projectRadius(boxA, axis);
            const rB = this.projectRadius(boxB, axis);
            const dist = dx * axis.x + dy * axis.y;
            const overlap = rA + rB - Math.abs(dist);

            if (overlap <= 0) return null;

            if (overlap < minOverlap) {
                minOverlap = overlap;
                minAxis = dist < 0 ? { x: -axis.x, y: -axis.y } : axis;
            }
        }

        return { axis: minAxis, overlap: minOverlap };
    },

    update() {
        const players = World.getEntitiesByType('player');
        if (players.length === 0) return;
        const p = players[0];

        const controlled = VehicleSystem.getControlledEntity();

        if (controlled) {
            const ent = controlled.transform;
            const boxA = { cx: ent.x, cy: ent.y, hw: ent.width / 2, hh: ent.height / 2, angle: ent.angle };

            World.buildings.forEach(b => {
                const boxB = { cx: b.x + b.w / 2, cy: b.y + b.h / 2, hw: b.w / 2, hh: b.h / 2, angle: 0 };

                const mtv = this.satMTV(boxA, boxB);
                if (mtv) {
                    const { axis, overlap } = mtv;
                    ent.x -= axis.x * overlap;
                    ent.y -= axis.y * overlap;
                    boxA.cx = ent.x;
                    boxA.cy = ent.y;

                    if (controlled.physics) {
                        // Cancel only the velocity component driving into the wall; keep any tangential slide.
                        const vDotN = controlled.physics.velX * axis.x + controlled.physics.velY * axis.y;
                        controlled.physics.velX -= vDotN * axis.x;
                        controlled.physics.velY -= vDotN * axis.y;

                        // Also kill scalar drive speed, otherwise VehiclePhysicsSystem's drift
                        // inertia rebuilds the cancelled velocity from pre-impact speed next tick.
                        if (controlled.physics.speed !== undefined) {
                            controlled.physics.speed = 0;
                        }
                    }
                }
            });
        }

        // On-foot player vs empty cars only
        if (controlled && controlled.type === 'player') {
            const cars = World.getEntitiesByType('car');
            const len = cars.length;
            for (let i = 0; i < len; i++) {
                const car = cars[i];
                if (car.occupied) continue;

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
            }
        }

        // Driving: OBB/SAT collision against other cars (parked or traffic-driven)
        if (controlled && controlled.type === 'car') {
            const ent = controlled.transform;
            const boxA = { cx: ent.x, cy: ent.y, hw: ent.width / 2, hh: ent.height / 2, angle: ent.angle };

            World.getEntitiesByType('car').forEach(other => {
                if (other === controlled) return;

                const ot = other.transform;
                const boxB = { cx: ot.x, cy: ot.y, hw: ot.width / 2, hh: ot.height / 2, angle: ot.angle };

                const mtv = this.satMTV(boxA, boxB);
                if (!mtv) return;

                const { axis, overlap } = mtv;

                // Split the correction: half stops the player's car, half shoves the other car aside.
                ent.x -= axis.x * overlap * 0.5;
                ent.y -= axis.y * overlap * 0.5;
                boxA.cx = ent.x;
                boxA.cy = ent.y;

                ot.x += axis.x * overlap * 0.5;
                ot.y += axis.y * overlap * 0.5;

                if (controlled.physics) {
                    const vDotN = controlled.physics.velX * axis.x + controlled.physics.velY * axis.y;
                    controlled.physics.velX -= vDotN * axis.x;
                    controlled.physics.velY -= vDotN * axis.y;

                    if (controlled.physics.speed !== undefined) {
                        controlled.physics.speed = 0;
                    }
                }
            });
        }

        // Driving: knock NPCs when speed > 10
        if (controlled && controlled.type === 'car') {
            const npcs = World.getEntitiesByType('npc');
            const len = npcs.length;
            for (let i = 0; i < len; i++) {
                const npc = npcs[i];

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
                        
                        npc.transform.x += (dx / dist) * 30;
                        npc.transform.y += (dy / dist) * 30;
                        
                        controlled.physics.speed *= 0.8;
                        
                        EventBus.emit('npc_hit', { npc, car: controlled });
                    }
                }
            }
        }
    }
};
