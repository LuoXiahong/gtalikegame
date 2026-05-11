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

                if (dist < 600) { // Gunshot hearing/scare range
                    npc.ai.state = 'flee';
                    npc.ai.timer = 5 + Math.random() * 3; // Flee for a few seconds
                    // Set flee direction away from the source with small random angle variation
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
                    npc.ai.timer = 8 + Math.random() * 5; // Long fear duration after explosion
                    npc.transform.angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
                }
            });
        });
    },

    update(dt) {
        const npcs = World.getEntitiesByType('npc');

        npcs.forEach(npc => {
            if (npc.ai.timer > 0) {
                npc.ai.timer -= dt;
            }

            // FSM state transitions
            if (npc.ai.timer <= 0) {
                if (npc.ai.state === 'idle') {
                    npc.ai.state = 'walk';
                } else if (npc.ai.state === 'flee') {
                    // Rest in idle state for a brief moment after panicking
                    npc.ai.state = 'idle';
                    npc.ai.timer = 1 + Math.random() * 2;
                    npc.physics.velX = 0;
                    npc.physics.velY = 0;
                }
            }

            // Movement logic & behaviors
            if (npc.ai.state === 'walk') {
                if (npc.ai.waypoints && npc.ai.waypoints.length > 0) {
                    const target = npc.ai.waypoints[npc.ai.currentWaypointIndex];
                    const dx = target.x - npc.transform.x;
                    const dy = target.y - npc.transform.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 10) {
                        // Destination reached! Rest in idle before next waypoint
                        npc.ai.state = 'idle';
                        npc.ai.timer = 1 + Math.random() * 2;
                        npc.physics.velX = 0;
                        npc.physics.velY = 0;
                        npc.ai.currentWaypointIndex = (npc.ai.currentWaypointIndex + 1) % npc.ai.waypoints.length;
                    } else {
                        // Move towards the active waypoint
                        npc.transform.angle = Math.atan2(dy, dx);
                        npc.physics.velX = Math.cos(npc.transform.angle) * npc.physics.speed * dt;
                        npc.physics.velY = Math.sin(npc.transform.angle) * npc.physics.speed * dt;
                        npc.visual.walkCycle += 10 * dt;
                    }
                } else {
                    // Fallback random patrol movement if waypoints are not defined
                    if (npc.ai.timer <= 0) {
                        npc.transform.angle = Math.random() * Math.PI * 2;
                        npc.ai.timer = 2 + Math.random() * 3;
                    }
                    npc.physics.velX = Math.cos(npc.transform.angle) * npc.physics.speed * dt;
                    npc.physics.velY = Math.sin(npc.transform.angle) * npc.physics.speed * dt;
                    npc.visual.walkCycle += 10 * dt;
                }
            } else if (npc.ai.state === 'flee') {
                // Sprintflee movement away from threat
                const fleeSpeed = npc.physics.speed * 2.5;
                npc.physics.velX = Math.cos(npc.transform.angle) * fleeSpeed * dt;
                npc.physics.velY = Math.sin(npc.transform.angle) * fleeSpeed * dt;
                npc.visual.walkCycle += 20 * dt;
            } else {
                // Standing idle
                npc.physics.velX = 0;
                npc.physics.velY = 0;
                npc.visual.walkCycle = 0;
            }
        });
    }
};
