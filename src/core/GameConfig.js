/**
 * Central numeric tunables (magic numbers).
 */
import { WorldMetrics } from '../world/WorldMetrics.js';

// Real-world 100 km/h top-speed cap for the player's car. WorldMetrics.SCALE_FACTOR
// (0.1) means 1 px = 0.1 m, so 1 m/s = 10 px/s. Every other vehicle speed below
// (traffic cruise, police chase) is scaled by the same ratio against the old,
// unrealistic 500 px/s (180 km/h) tuning, so acceleration/handling feel — and how
// fast traffic/police are relative to the player — stays the same; only the
// ceiling moved. VehiclePhysicsSystem.js's steering-speed fractions read this
// same maxSpeed at runtime, so they track it automatically.
const VEHICLE_MAX_SPEED_KMH = 100;
const VEHICLE_MAX_SPEED = (VEHICLE_MAX_SPEED_KMH / 3.6) / WorldMetrics.SCALE_FACTOR; // ≈ 222.2 px/s
const PREV_VEHICLE_MAX_SPEED = 500; // the old (180 km/h) tuning this replaces
const VEHICLE_SPEED_SCALE = VEHICLE_MAX_SPEED / PREV_VEHICLE_MAX_SPEED;

export const GameConfig = {
    SPAWN: {
        PLAYER_X: 1100,
        PLAYER_Y: 1100,
        CAR_X: 1100,
        CAR_Y: 1220 // within enter range (VEHICLE_RADIUS=150)
    },
    VEHICLE: {
        MAX_SPEED_KMH: VEHICLE_MAX_SPEED_KMH,
        MAX_SPEED: VEHICLE_MAX_SPEED,
        SPEED_SCALE: VEHICLE_SPEED_SCALE
    },
    TRAFFIC: {
        MAX_CARS: 8,
        SPAWN_DISTANCE: 500,
        DESPAWN_DISTANCE: 2000,
        BASE_SPEED: 150 * VEHICLE_SPEED_SCALE,
        SPEED_VARIANCE: 100 * VEHICLE_SPEED_SCALE
    },
    AI: {
        GUNSHOT_HEARING_RANGE: 600,
        EXPLOSION_DEFAULT_RADIUS: 1000
    },
    INTERACTION: {
        VEHICLE_RADIUS: 150,
        NPC_PUSH_FORCE: 30
    },
    POLICE: {
        SPAWN_DISTANCE: 700,
        MAX_SPEED: 420 * VEHICLE_SPEED_SCALE,
        ACCELERATION: 380 * VEHICLE_SPEED_SCALE,
        CATCH_RADIUS: 90,
        STEER_RATE: 2.4,
        VEL_INERTIA: 3.2
    },
    HEALTH: {
        MAX: 100,
        VEHICLE_HIT_DAMAGE: 25,
        GUNSHOT_DAMAGE: 34,
        GUNSHOT_HIT_RADIUS: 150,
        EXPLOSION_MAX_DAMAGE: 100
    }
};
