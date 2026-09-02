/**
 * PoliceSystem — chase with steering + velocity inertia (no instant snap / “flying”).
 */
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { GameState, GAME_STATES } from '../core/GameState.js';
import { GameConfig } from '../core/GameConfig.js';
import { Waypoints } from '../world/Waypoints.js';
import { Car } from '../entities/Car.js';

function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

export const PoliceSystem = {
    policeCars: [],
    spawnDistance: GameConfig.POLICE.SPAWN_DISTANCE,
    catchRadius: GameConfig.POLICE.CATCH_RADIUS,
    isActive: false,

    init() {
        this.reset();
        if (this._onWantedChange) EventBus.off(EVENTS.WANTED_LEVEL_CHANGE, this._onWantedChange);
        if (this._onWantedReset) EventBus.off(EVENTS.WANTED_RESET, this._onWantedReset);

        this._onWantedChange = ({ stars }) => {
            if (stars >= 2) {
                this.isActive = true;
            } else {
                this.isActive = false;
                this.despawnAll();
            }
        };
        EventBus.on(EVENTS.WANTED_LEVEL_CHANGE, this._onWantedChange);

        this._onWantedReset = () => {
            this.isActive = false;
            this.despawnAll();
        };
        EventBus.on(EVENTS.WANTED_RESET, this._onWantedReset);
    },

    reset() {
        this.despawnAll();
        this.policeCars = [];
        this.isActive = false;
        this.spawnDistance = GameConfig.POLICE.SPAWN_DISTANCE;
        this.catchRadius = GameConfig.POLICE.CATCH_RADIUS;
    },

    /**
     * Spawn on a road waypoint in a ring around the player (not in buildings / mid-air weirdness).
     */
    findRoadSpawnNear(target) {
        const minD = this.spawnDistance * 0.7;
        const maxD = this.spawnDistance * 1.3;
        const candidates = [];

        for (const path of Object.values(Waypoints.paths)) {
            for (let i = 0; i < path.length - 1; i++) {
                const a = path[i];
                const b = path[i + 1];
                // Lanes are segmented at intersections — sample by length so the short
                // intersection stubs don't outweigh open road.
                const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 60));
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const x = a.x + (b.x - a.x) * t;
                    const y = a.y + (b.y - a.y) * t;
                    const dist = Math.hypot(x - target.transform.x, y - target.transform.y);
                    if (dist >= minD && dist <= maxD) {
                        candidates.push({ x, y });
                    }
                }
            }
        }

        if (candidates.length > 0) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        // Fallback: offset along a street axis
        const angle = Math.random() * Math.PI * 2;
        return {
            x: target.transform.x + Math.cos(angle) * this.spawnDistance,
            y: target.transform.y + Math.sin(angle) * this.spawnDistance
        };
    },

    spawnPoliceIfNeeded() {
        if (this.policeCars.length === 0) {
            const target = World.getControlled() || World.getEntitiesByType('player')[0];
            if (!target) return;

            const pos = this.findRoadSpawnNear(target);
            const policeCar = new Car('police_' + Date.now(), pos.x, pos.y, '#2980b9');
            policeCar.isPolice = true;
            policeCar.physics.maxSpeed = GameConfig.POLICE.MAX_SPEED;
            policeCar.physics.acceleration = GameConfig.POLICE.ACCELERATION;
            policeCar.physics.speed = 0;
            policeCar.ai = {
                type: 'police',
                vx: 0,
                vy: 0
            };

            const dx = target.transform.x - pos.x;
            const dy = target.transform.y - pos.y;
            policeCar.transform.angle = Math.atan2(dy, dx);

            World.addEntity(policeCar);
            this.policeCars.push(policeCar);
        }
    },

    despawnAll() {
        this.policeCars.forEach(car => {
            World.removeEntity(car.id);
        });
        this.policeCars = [];
    },

    cleanUpDestroyedCars() {
        this.policeCars = this.policeCars.filter(car => World.entities.includes(car));
    },

    arrestPlayer() {
        this.isActive = false;
        this.despawnAll();
        GameState.setState(GAME_STATES.WASTED);
    },

    update(dt) {
        if (!this.isActive) return;

        this.cleanUpDestroyedCars();
        this.spawnPoliceIfNeeded();

        const target = World.getControlled() || World.getEntitiesByType('player')[0];
        if (!target) return;

        const steerRate = GameConfig.POLICE.STEER_RATE;
        const velInertia = GameConfig.POLICE.VEL_INERTIA;

        for (const policeCar of this.policeCars) {
            if (!World.entities.includes(policeCar)) continue;

            const dx = target.transform.x - policeCar.transform.x;
            const dy = target.transform.y - policeCar.transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.catchRadius) {
                this.arrestPlayer();
                return;
            }

            // Soft steer toward player
            const desiredAngle = Math.atan2(dy, dx);
            let diff = wrapAngle(desiredAngle - policeCar.transform.angle);
            const maxStep = steerRate * dt;
            diff = clamp(diff, -maxStep, maxStep);
            policeCar.transform.angle = wrapAngle(policeCar.transform.angle + diff);

            // Accelerate scalar speed
            const p = policeCar.physics;
            if (p.speed < p.maxSpeed) {
                p.speed += p.acceleration * dt;
            }
            if (p.speed > p.maxSpeed) p.speed = p.maxSpeed;

            // Slow a bit while turning hard
            const turnFactor = 1 - Math.min(Math.abs(diff) / (maxStep || 1), 1) * 0.35;
            const cruise = p.speed * turnFactor;

            if (!policeCar.ai) policeCar.ai = { type: 'police', vx: 0, vy: 0 };
            const desiredVx = Math.cos(policeCar.transform.angle) * cruise;
            const desiredVy = Math.sin(policeCar.transform.angle) * cruise;
            const blend = 1 - Math.exp(-velInertia * dt);
            policeCar.ai.vx += (desiredVx - policeCar.ai.vx) * blend;
            policeCar.ai.vy += (desiredVy - policeCar.ai.vy) * blend;

            p.velX = policeCar.ai.vx * dt;
            p.velY = policeCar.ai.vy * dt;
        }
    }
};
