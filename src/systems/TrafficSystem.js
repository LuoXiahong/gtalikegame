/**
 * TRAFFIC SYSTEM (TrafficSystem)
 * AI cars walk the Waypoints lane graph node-to-node, choosing straight/right/left at
 * each intersection node, with steering + velocity inertia (no position teleport).
 * Occasional drift steers off-lane; recovery is also seek-based.
 */
import { World } from '../world/World.js';
import { Waypoints } from '../world/Waypoints.js';
import { Car } from '../entities/Car.js';
import { GameConfig } from '../core/GameConfig.js';

const ARRIVAL_RADIUS = 55;
const ON_PATH_DIST = 55;
const SEEK_LOOKAHEAD = 140;

/** Max turn rate (rad/s) — soft steering toward seek point */
const STEER_RATE = 2.2;
/** How fast velocity catches desired heading (higher = snappier) */
const VEL_INERTIA = 3.5;
/** Speed lerp toward target cruise speed */
const SPEED_RESPONSIVENESS = 2.5;

/** Chance per second to start a short off-road wander */
const DRIFT_CHANCE_PER_SEC = 0.10;
const DRIFT_DURATION_MIN = 1.0;
const DRIFT_DURATION_MAX = 2.4;
const DRIFT_ANGLE_MIN = 0.25;
const DRIFT_ANGLE_MAX = 0.5;
const RECOVER_DONE_DIST = 35;
/** Max position correction per frame — avoids visible teleports when cars meet */
const MAX_SEPARATION_PER_FRAME = 2.5;

/** Turn bias per intersection node — a left has to cross oncoming traffic, so it's rarer */
const RIGHT_TURN_CHANCE = 0.22;
const LEFT_TURN_CHANCE = 0.10;
/** Per-car lateral jitter inside its lane (px) — keeps cars off one perfect line */
const LANE_BIAS_MAX = 6;
/** Don't spawn inside the ~70px intersection stubs — only on open road */
const MIN_SPAWN_EDGE_LEN = 100;
/** Cost added to a lane edge that points away from the car's heading, when rebinding */
const RETARGET_HEADING_PENALTY = 120;

function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

/**
 * Minimum translation to separate axis-aligned boxes (centers + half-extents).
 * @returns {{ pushX: number, pushY: number, penetration: number } | null}
 */
function aabbSeparation(ax, ay, ahw, ahh, bx, by, bhw, bhh) {
    const overlapLeft = (ax + ahw) - (bx - bhw);
    const overlapRight = (bx + bhw) - (ax - ahw);
    const overlapTop = (ay + ahh) - (by - bhh);
    const overlapBottom = (by + bhh) - (ay - ahh);
    if (overlapLeft <= 0 || overlapRight <= 0 || overlapTop <= 0 || overlapBottom <= 0) {
        return null;
    }
    const penetration = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
    if (penetration === overlapLeft) return { pushX: -overlapLeft, pushY: 0, penetration };
    if (penetration === overlapRight) return { pushX: overlapRight, pushY: 0, penetration };
    if (penetration === overlapTop) return { pushX: 0, pushY: -overlapTop, penetration };
    return { pushX: 0, pushY: overlapBottom, penetration };
}

/**
 * Soft vehicle separation along center-to-center (avoids vertical "jumps" on same lane).
 * @returns {{ pushX: number, pushY: number } | null}
 */
function radialSeparation(ax, ay, ahw, ahh, bx, by, bhw, bhh) {
    const box = aabbSeparation(ax, ay, ahw, ahh, bx, by, bhw, bhh);
    if (!box) return null;
    const dx = ax - bx;
    const dy = ay - by;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) {
        return { pushX: box.penetration, pushY: 0 };
    }
    return {
        pushX: (dx / dist) * box.penetration,
        pushY: (dy / dist) * box.penetration,
    };
}

function capSeparation(pushX, pushY, maxStep) {
    const mag = Math.hypot(pushX, pushY);
    if (mag <= maxStep || mag < 1e-6) return { pushX, pushY };
    const s = maxStep / mag;
    return { pushX: pushX * s, pushY: pushY * s };
}

export const TrafficSystem = {
    maxCars: GameConfig.TRAFFIC.MAX_CARS,
    spawnRadius: GameConfig.TRAFFIC.SPAWN_DISTANCE,
    despawnRadius: GameConfig.TRAFFIC.DESPAWN_DISTANCE,
    
    update(dt) {
        this.cachedCarsAndPlayers = World.entities.filter(e => e.type === 'car' || e.type === 'player');
        this.cachedCars = World.getEntitiesByType('car');

        const trafficCars = this.cachedCars.filter(c => c.ai && c.ai.type === 'traffic');
        const player = World.getEntitiesByType('player')[0];
        
        trafficCars.forEach(car => {
            if (player && !car.occupied) {
                const dx = car.transform.x - player.transform.x;
                const dy = car.transform.y - player.transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > this.despawnRadius) {
                    World.removeEntity(car.id);
                }
            }
        });
        
        const remainingCars = World.getEntitiesByType('car').filter(c => c.ai && c.ai.type === 'traffic' && !c.occupied);
        
        if (remainingCars.length < this.maxCars) {
            this.spawnRandomCar();
        }
        
        remainingCars.forEach(car => this.updateCar(car, dt));

        this.cachedCarsAndPlayers = null;
        this.cachedCars = null;
    },
    
    spawnRandomCar() {
        const player = World.getEntitiesByType('player')[0];
        const candidate = this.findSpawnCandidate(player);
        if (!candidate) return;

        const { fromNode, node, x, y, angle } = candidate;
        const cruise = GameConfig.TRAFFIC.BASE_SPEED + Math.random() * GameConfig.TRAFFIC.SPEED_VARIANCE;

        // Period body paints: black, burgundy, bottle green, navy, cream, umber —
        // desaturated (was ['#1a1a1a','#5c1a1a','#1a3a2a','#1a2744','#d4c5a9','#3d2e1f'],
        // 4 of 6 saturated enough to stand out against the near-monochrome noir scene).
        // Differentiated by value/slight bias, not hue, same as the building palette.
        const colors = ['#1a1a1a', '#3a2f2c', '#262b2e', '#22262e', '#a8a49c', '#332e29'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const car = new Car(`traffic_${Date.now()}_${Math.random()}`, x, y, color);
        car.transform.angle = angle;
        car.ai = {
            type: 'traffic',
            fromNode,
            node,
            maxSpeed: cruise,
            currentSpeed: cruise * 0.5,
            vx: Math.cos(angle) * cruise * 0.5,
            vy: Math.sin(angle) * cruise * 0.5,
            laneOffset: (Math.random() * 2 - 1) * LANE_BIAS_MAX,
            driftTimer: 0,
            driftAngle: 0,
            recovering: false,
            needsRetarget: false
        };
        car.physics.friction = 1.0;
        World.addEntity(car);
    },

    /**
     * Pick a point along some lane edge inside [spawnRadius, despawn*0.75] of the player.
     * Avoids spawning at map ends that sit right on the despawn edge.
     */
    findSpawnCandidate(player) {
        const minD = this.spawnRadius;
        const maxD = this.despawnRadius * 0.75;
        const inRing = [];
        const fallback = [];

        for (const edge of Waypoints.edges) {
            if (edge.length < MIN_SPAWN_EDGE_LEN) continue;
            const a = Waypoints.nodes[edge.from];
            const b = Waypoints.nodes[edge.to];
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            const steps = Math.max(1, Math.round(edge.length / 60));

            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const x = a.x + (b.x - a.x) * t;
                const y = a.y + (b.y - a.y) * t;
                const entry = { fromNode: edge.from, node: edge.to, x, y, angle, dist: 0 };

                if (player) {
                    entry.dist = Math.hypot(x - player.transform.x, y - player.transform.y);
                    if (entry.dist < minD) continue;
                    fallback.push(entry);
                    if (entry.dist <= maxD) inRing.push(entry);
                } else {
                    inRing.push(entry);
                }
            }
        }

        const pool = inRing.length > 0 ? inRing : fallback;
        if (pool.length === 0) return null;

        // Prefer mid-ring distances when possible
        if (inRing.length > 0) {
            return inRing[Math.floor(Math.random() * inRing.length)];
        }
        fallback.sort((a, b) => a.dist - b.dist);
        return fallback[0];
    },

    /**
     * After player exits a traffic car far from its route — rebind to the nearest lane
     * edge. Heading is scored too, so the car resumes on the lane that matches the way
     * it is actually pointing rather than the geometrically closest opposing lane.
     */
    retargetNearest(car) {
        let bestScore = Infinity;
        let bestLat = Infinity;
        let best = null;
        const cos = Math.cos(car.transform.angle);
        const sin = Math.sin(car.transform.angle);

        for (const edge of Waypoints.edges) {
            const a = Waypoints.nodes[edge.from];
            const b = Waypoints.nodes[edge.to];
            const { latDist } = this.projectOnSegment(car, a, b);
            const len = edge.length || 1;
            const alignment = ((b.x - a.x) / len) * cos + ((b.y - a.y) / len) * sin;
            const score = latDist + RETARGET_HEADING_PENALTY * (1 - alignment) / 2;
            if (score < bestScore) {
                bestScore = score;
                bestLat = latDist;
                best = edge;
            }
        }

        if (best) {
            car.ai.fromNode = best.from;
            car.ai.node = best.to;
        }
        car.ai.recovering = bestLat > ON_PATH_DIST;
        car.ai.driftTimer = 0;
        car.ai.driftAngle = 0;
        car.ai.needsRetarget = false;
    },
    
    computeSpeedMult(car) {
        let speedMult = 1.0;
        const sensorDist = 180;
        const minStopDist = 100;
        
        const sensorDistSq = sensorDist * sensorDist;
        const minStopDistSq = minStopDist * minStopDist;

        const others = this.cachedCarsAndPlayers || World.entities.filter(e => e.type === 'car' || e.type === 'player');
        for (const other of others) {
            if (other === car) continue;
            const odx = other.transform.x - car.transform.x;
            const ody = other.transform.y - car.transform.y;
            const distSq = odx * odx + ody * ody;
            
            if (distSq < sensorDistSq) {
                const angleToOther = Math.atan2(ody, odx);
                let diff = wrapAngle(angleToOther - car.transform.angle);
                
                if (Math.abs(diff) < 0.45) {
                    if (distSq <= minStopDistSq) {
                        speedMult = 0;
                    } else {
                        const distToOther = Math.sqrt(distSq);
                        const factor = (distToOther - minStopDist) / (sensorDist - minStopDist);
                        speedMult = Math.min(speedMult, factor);
                    }
                }
            }
        }
        
        if (World.buildings && World.buildings.length > 0) {
            const cos = Math.cos(car.transform.angle);
            const sin = Math.sin(car.transform.angle);
            
            const sampleDistances = [60, 100, 140, 180];
            for (const dist of sampleDistances) {
                const rx = car.transform.x + cos * dist;
                const ry = car.transform.y + sin * dist;
                
                for (const b of World.buildings) {
                    if (rx >= b.x && rx <= b.x + b.w && ry >= b.y && ry <= b.y + b.h) {
                        if (dist <= minStopDist) {
                            speedMult = 0;
                        } else {
                            const factor = (dist - minStopDist) / (sensorDist - minStopDist);
                            speedMult = Math.min(speedMult, factor);
                        }
                        break;
                    }
                }
                if (speedMult === 0) break;
            }
        }
        
        return speedMult;
    },

    projectOnSegment(car, prevNode, target) {
        const abx = target.x - prevNode.x;
        const aby = target.y - prevNode.y;
        const lenSq = abx * abx + aby * aby || 1;
        const t = Math.max(0, Math.min(1,
            ((car.transform.x - prevNode.x) * abx + (car.transform.y - prevNode.y) * aby) / lenSq
        ));
        const nearX = prevNode.x + abx * t;
        const nearY = prevNode.y + aby * t;
        const ldx = car.transform.x - nearX;
        const ldy = car.transform.y - nearY;
        const latDist = Math.sqrt(ldx * ldx + ldy * ldy);
        return { nearX, nearY, latDist, t, abx, aby, lenSq };
    },

    /**
     * Seek point: if off-path, aim at projection + slight progress; else aim at waypoint with lookahead.
     */
    computeSeekPoint(car, prevNode, target) {
        const { nearX, nearY, latDist, abx, aby, lenSq } = this.projectOnSegment(car, prevNode, target);
        const len = Math.sqrt(lenSq) || 1;
        const dirX = abx / len;
        const dirY = aby / len;

        if (latDist > ON_PATH_DIST || car.ai.recovering) {
            // Get back on road first, then ease toward travel direction
            return {
                x: nearX + dirX * SEEK_LOOKAHEAD * 0.35,
                y: nearY + dirY * SEEK_LOOKAHEAD * 0.35,
                latDist
            };
        }

        // On lane: pursue waypoint, with a lookahead point along the segment
        const toTx = target.x - car.transform.x;
        const toTy = target.y - car.transform.y;
        const toDist = Math.sqrt(toTx * toTx + toTy * toTy) || 1;
        if (toDist > SEEK_LOOKAHEAD) {
            return {
                x: car.transform.x + (toTx / toDist) * SEEK_LOOKAHEAD,
                y: car.transform.y + (toTy / toDist) * SEEK_LOOKAHEAD,
                latDist
            };
        }
        return { x: target.x, y: target.y, latDist };
    },

    updateDrift(car, dt, latDist) {
        if (car.ai.driftTimer === undefined) car.ai.driftTimer = 0;
        if (car.ai.driftAngle === undefined) car.ai.driftAngle = 0;
        if (car.ai.recovering === undefined) car.ai.recovering = false;

        if (car.ai.driftTimer > 0) {
            car.ai.driftTimer -= dt;
            if (car.ai.driftTimer <= 0) {
                car.ai.driftTimer = 0;
                car.ai.driftAngle = 0;
                car.ai.recovering = true;
            }
            return;
        }

        if (car.ai.recovering) {
            if (latDist < RECOVER_DONE_DIST) {
                car.ai.recovering = false;
            }
            return;
        }

        if (latDist < ON_PATH_DIST && Math.random() < DRIFT_CHANCE_PER_SEC * dt) {
            const mag = DRIFT_ANGLE_MIN + Math.random() * (DRIFT_ANGLE_MAX - DRIFT_ANGLE_MIN);
            car.ai.driftAngle = Math.random() < 0.5 ? -mag : mag;
            car.ai.driftTimer = DRIFT_DURATION_MIN + Math.random() * (DRIFT_DURATION_MAX - DRIFT_DURATION_MIN);
        }
    },

    /**
     * Shift the lane edge sideways by the car's own `laneOffset`, so cars sharing a lane
     * don't ride one perfect line. Right-hand normal of (dx, dy) in y-down space: (-dy, dx).
     */
    laneSegment(car, prevNode, target) {
        const bias = car.ai.laneOffset || 0;
        if (!bias) return { prev: prevNode, target };

        const dx = target.x - prevNode.x;
        const dy = target.y - prevNode.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) return { prev: prevNode, target };

        const nx = (-dy / len) * bias;
        const ny = (dx / len) * bias;
        return {
            prev: { x: prevNode.x + nx, y: prevNode.y + ny },
            target: { x: target.x + nx, y: target.y + ny }
        };
    },

    /**
     * Reached the target node — choose the next one. At an intersection node the options
     * are "straight on" and one turn (right at the near node, left at the far one), so a
     * turn is a plain weighted coin flip; dead ends at the city edge offer only the
     * turnaround onto the opposite lane.
     */
    advanceNode(car) {
        const options = Waypoints.turnOptions(car.ai.node, car.ai.fromNode);
        if (options.all.length === 0) return;

        let next = null;
        if (options.right && Math.random() < RIGHT_TURN_CHANCE) {
            next = options.right;
        } else if (options.left && Math.random() < LEFT_TURN_CHANCE) {
            next = options.left;
        }
        if (!next) next = options.straight || options.all[0];

        car.ai.fromNode = car.ai.node;
        car.ai.node = next;
    },

    /**
     * Smoothly rotate toward desired heading (capped turn rate).
     */
    steerToward(car, desiredAngle, dt) {
        let diff = wrapAngle(desiredAngle - car.transform.angle);
        const maxStep = STEER_RATE * dt;
        diff = clamp(diff, -maxStep, maxStep);
        car.transform.angle = wrapAngle(car.transform.angle + diff);
    },

    /**
     * Blend world-space velocity toward desired cruise vector (inertia layer).
     */
    applyVelocityInertia(car, desiredSpeed, dt) {
        if (car.ai.vx === undefined) car.ai.vx = 0;
        if (car.ai.vy === undefined) car.ai.vy = 0;

        const desiredVx = Math.cos(car.transform.angle) * desiredSpeed;
        const desiredVy = Math.sin(car.transform.angle) * desiredSpeed;
        const blend = 1 - Math.exp(-VEL_INERTIA * dt);

        car.ai.vx += (desiredVx - car.ai.vx) * blend;
        car.ai.vy += (desiredVy - car.ai.vy) * blend;
        car.ai.currentSpeed = Math.sqrt(car.ai.vx * car.ai.vx + car.ai.vy * car.ai.vy);

        car.physics.velX = car.ai.vx * dt;
        car.physics.velY = car.ai.vy * dt;
    },

    updateCar(car, dt) {
        if (car.ai.needsRetarget || !Waypoints.getNode(car.ai.node)) {
            this.retargetNearest(car);
        }

        let node = Waypoints.getNode(car.ai.node);
        if (!node) return;
        let from = Waypoints.getNode(car.ai.fromNode) || node;

        const dx = node.x - car.transform.x;
        const dy = node.y - car.transform.y;

        if (Math.sqrt(dx * dx + dy * dy) < ARRIVAL_RADIUS) {
            this.advanceNode(car);
            node = Waypoints.getNode(car.ai.node) || node;
            from = Waypoints.getNode(car.ai.fromNode) || node;
        }

        const { prev: prevNode, target } = this.laneSegment(car, from, node);
        const seek = this.computeSeekPoint(car, prevNode, target);
        this.updateDrift(car, dt, seek.latDist);

        let desiredAngle = Math.atan2(seek.y - car.transform.y, seek.x - car.transform.x);
        if (car.ai.driftTimer > 0) {
            desiredAngle += car.ai.driftAngle;
        }

        this.steerToward(car, desiredAngle, dt);

        const speedMult = this.computeSpeedMult(car);
        const driftSlow = (car.ai.driftTimer > 0 || car.ai.recovering) ? 0.75 : 1.0;
        // Slow down while turning hard (extra inertia feel)
        const turnPenalty = 1 - Math.min(Math.abs(wrapAngle(desiredAngle - car.transform.angle)) / Math.PI, 0.35);
        const cruiseTarget = car.ai.maxSpeed * speedMult * driftSlow * turnPenalty;

        // Ease cruise target into a scalar, then feed inertial velocity
        const speedBlend = 1 - Math.exp(-SPEED_RESPONSIVENESS * dt);
        let approachSpeed = car.ai.currentSpeed + (cruiseTarget - car.ai.currentSpeed) * speedBlend;
        // Hard brake when sensors demand near-stop — still via speed, not teleport
        if (speedMult < 0.15) {
            approachSpeed *= 0.5;
            car.ai.vx *= 0.85;
            car.ai.vy *= 0.85;
            car.ai.currentSpeed *= 0.85;
        }

        // Soft collision: separate only when already overlapping; block step when next pose would hit.
        const nextX = car.transform.x + Math.cos(car.transform.angle) * approachSpeed * dt;
        const nextY = car.transform.y + Math.sin(car.transform.angle) * approachSpeed * dt;

        const hw = car.transform.width / 2;
        const hh = car.transform.height / 2;
        const cx = car.transform.x;
        const cy = car.transform.y;

        let blocked = false;
        let pushX = 0;
        let pushY = 0;

        if (World.buildings && World.buildings.length > 0) {
            for (const b of World.buildings) {
                const bcx = b.x + b.w / 2;
                const bcy = b.y + b.h / 2;
                const bhw = b.w / 2;
                const bhh = b.h / 2;

                const currentSep = aabbSeparation(cx, cy, hw, hh, bcx, bcy, bhw, bhh);
                const nextHit = aabbSeparation(nextX, nextY, hw, hh, bcx, bcy, bhw, bhh);
                if (!currentSep && !nextHit) continue;

                blocked = true;
                car.ai.driftTimer = 0;
                car.ai.driftAngle = 0;
                car.ai.recovering = true;

                if (currentSep) {
                    const capped = capSeparation(currentSep.pushX, currentSep.pushY, MAX_SEPARATION_PER_FRAME);
                    pushX = capped.pushX;
                    pushY = capped.pushY;
                } else {
                    // Approaching wall: nudge gently back toward lane instead of teleporting
                    const { nearX, nearY } = this.projectOnSegment(car, prevNode, target);
                    const bdx = nearX - cx;
                    const bdy = nearY - cy;
                    const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
                    const capped = capSeparation(
                        (bdx / bdist) * MAX_SEPARATION_PER_FRAME,
                        (bdy / bdist) * MAX_SEPARATION_PER_FRAME,
                        MAX_SEPARATION_PER_FRAME
                    );
                    pushX = capped.pushX;
                    pushY = capped.pushY;
                }
                break;
            }
        }

        if (!blocked) {
            const others = this.cachedCarsAndPlayers || World.entities.filter(e => e.type === 'car' || e.type === 'player');
            for (const other of others) {
                if (other === car) continue;
                const ohw = (other.transform.width || 40) / 2;
                const ohh = (other.transform.height || 40) / 2;
                const ox = other.transform.x;
                const oy = other.transform.y;

                const currentSep = radialSeparation(cx, cy, hw, hh, ox, oy, ohw, ohh);
                const nextHit = aabbSeparation(nextX, nextY, hw, hh, ox, oy, ohw, ohh);
                if (!currentSep && !nextHit) continue;

                blocked = true;
                if (currentSep) {
                    const capped = capSeparation(currentSep.pushX, currentSep.pushY, MAX_SEPARATION_PER_FRAME);
                    pushX = capped.pushX;
                    pushY = capped.pushY;
                }
                // Predictive-only hit: no teleport — just brake (handled below)
                break;
            }
        }

        if (blocked) {
            car.ai.vx *= 0.35;
            car.ai.vy *= 0.35;
            car.ai.currentSpeed *= 0.35;
            if (pushX !== 0 || pushY !== 0) {
                car.transform.x += pushX;
                car.transform.y += pushY;
            }
            car.physics.velX = 0;
            car.physics.velY = 0;
        } else {
            this.applyVelocityInertia(car, approachSpeed, dt);
        }
    }
};
