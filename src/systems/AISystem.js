import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { GameConfig } from '../core/GameConfig.js';
import { PedestrianPaths } from '../world/PedestrianPaths.js';

export const AISystem = {
    init() {
        if (this._onGunshot) EventBus.off(EVENTS.GUNSHOT, this._onGunshot);
        if (this._onExplosion) EventBus.off(EVENTS.EXPLOSION, this._onExplosion);

        this._onGunshot = (data) => {
            const npcs = World.getEntitiesByType('npc');
            npcs.forEach(npc => {
                const dx = npc.transform.x - data.x;
                const dy = npc.transform.y - data.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < GameConfig.AI.GUNSHOT_HEARING_RANGE) {
                    npc.ai.state = 'flee';
                    npc.ai.timer = 5 + Math.random() * 3;
                    npc.ai.returningToSidewalk = false;
                    npc.transform.angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
                }
            });
        };
        EventBus.on(EVENTS.GUNSHOT, this._onGunshot);

        this._onExplosion = (data) => {
            const npcs = World.getEntitiesByType('npc');
            npcs.forEach(npc => {
                const dx = npc.transform.x - data.x;
                const dy = npc.transform.y - data.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const radius = data.radius || GameConfig.AI.EXPLOSION_DEFAULT_RADIUS;
                if (dist < radius) {
                    npc.ai.state = 'flee';
                    npc.ai.timer = 8 + Math.random() * 5;
                    npc.ai.returningToSidewalk = false;
                    npc.transform.angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
                }
            });
        };
        EventBus.on(EVENTS.EXPLOSION, this._onExplosion);
    },

    moveToward(npc, tx, ty, speed, dt) {
        const dx = tx - npc.transform.x;
        const dy = ty - npc.transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        npc.transform.angle = Math.atan2(dy, dx);
        npc.physics.velX = (dx / dist) * speed * dt;
        npc.physics.velY = (dy / dist) * speed * dt;
        npc.visual.walkCycle += (speed > npc.physics.walkSpeed ? 20 : 10) * dt;
        return dist;
    },

    /** Idle only allowed on sidewalk. */
    tryIdle(npc, duration) {
        if (!PedestrianPaths.canStop(npc.transform.x, npc.transform.y)) {
            npc.ai.state = 'walk';
            npc.ai.timer = 0;
            return false;
        }
        npc.ai.state = 'idle';
        npc.ai.timer = duration;
        npc.physics.velX = 0;
        npc.physics.velY = 0;
        npc.visual.walkCycle = 0;
        return true;
    },

    /**
     * Off-sidewalk: keep moving (via waypoints or nearest curb). Never stand still.
     */
    updateMustKeepMoving(npc, dt) {
        const x = npc.transform.x;
        const y = npc.transform.y;
        if (PedestrianPaths.canStop(x, y) && !npc.ai.returningToSidewalk) {
            return false;
        }

        // Next waypoint (e.g. far side of crosswalk) or nearest sidewalk.
        let tx;
        let ty;
        if (npc.ai.waypoints && npc.ai.waypoints.length > 0) {
            const target = npc.ai.waypoints[npc.ai.currentWaypointIndex];
            tx = target.x;
            ty = target.y;
        } else {
            const curb = PedestrianPaths.nearestSidewalkPoint(x, y);
            tx = curb.x;
            ty = curb.y;
        }

        // Slightly faster on road/crosswalk — no stopping there.
        const speed = npc.physics.walkSpeed * (PedestrianPaths.isOnCrosswalk(x, y) ? 1.2 : 1.15);
        const dist = this.moveToward(npc, tx, ty, speed, dt);

        if (dist < 10 && npc.ai.waypoints && npc.ai.waypoints.length > 0) {
            npc.ai.currentWaypointIndex = (npc.ai.currentWaypointIndex + 1) % npc.ai.waypoints.length;
            if (PedestrianPaths.canStop(npc.transform.x, npc.transform.y)) {
                npc.ai.returningToSidewalk = false;
                this.tryIdle(npc, 0.8 + Math.random());
            }
        } else if (PedestrianPaths.canStop(npc.transform.x, npc.transform.y)) {
            npc.ai.returningToSidewalk = false;
        } else {
            npc.ai.returningToSidewalk = true;
            npc.ai.state = 'walk';
        }
        return true;
    },

    update(dt) {
        const npcs = World.getEntitiesByType('npc');

        npcs.forEach(npc => {
            if (!npc.ai) return;

            if (npc.ai.timer > 0) {
                npc.ai.timer -= dt;
            }

            if (npc.ai.timer <= 0) {
                if (npc.ai.state === 'idle') {
                    npc.ai.state = 'walk';
                } else if (npc.ai.state === 'flee') {
                    npc.ai.state = 'walk';
                    npc.ai.returningToSidewalk = true;
                    npc.ai.timer = 0;
                }
            }

            // Hard rule: never idle on road or crosswalk.
            if (npc.ai.state === 'idle' && !PedestrianPaths.canStop(npc.transform.x, npc.transform.y)) {
                npc.ai.state = 'walk';
                npc.ai.returningToSidewalk = true;
            }

            if (npc.ai.state !== 'flee') {
                if (this.updateMustKeepMoving(npc, dt)) {
                    return;
                }
            }

            if (npc.ai.state === 'walk') {
                if (npc.ai.waypoints && npc.ai.waypoints.length > 0) {
                    const target = npc.ai.waypoints[npc.ai.currentWaypointIndex];
                    const dist = this.moveToward(npc, target.x, target.y, npc.physics.walkSpeed, dt);

                    if (dist < 10) {
                        npc.ai.currentWaypointIndex = (npc.ai.currentWaypointIndex + 1) % npc.ai.waypoints.length;
                        this.tryIdle(npc, 1 + Math.random() * 2);
                    }
                } else {
                    if (npc.ai.timer <= 0) {
                        npc.transform.angle = Math.random() * Math.PI * 2;
                        npc.ai.timer = 2 + Math.random() * 3;
                    }
                    npc.physics.velX = Math.cos(npc.transform.angle) * npc.physics.walkSpeed * dt;
                    npc.physics.velY = Math.sin(npc.transform.angle) * npc.physics.walkSpeed * dt;
                    npc.visual.walkCycle += 10 * dt;
                }
            } else if (npc.ai.state === 'flee') {
                // 2.5 deliberately matches PlayerMovementSystem.js's SPRINT_MULT — keeps
                // NPC "fast" movement consistent with the player's, not a coincidence.
                const fleeSpeed = npc.physics.walkSpeed * 2.5;
                if (PedestrianPaths.isOnRoad(npc.transform.x, npc.transform.y)
                    && !PedestrianPaths.isOnCrosswalk(npc.transform.x, npc.transform.y)) {
                    const curb = PedestrianPaths.nearestSidewalkPoint(npc.transform.x, npc.transform.y);
                    const toCurb = Math.atan2(curb.y - npc.transform.y, curb.x - npc.transform.x);
                    let diff = toCurb - npc.transform.angle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    npc.transform.angle += diff * 0.35;
                }
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
