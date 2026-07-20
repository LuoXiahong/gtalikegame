/**
 * Central numeric tunables (magic numbers).
 */
export const GameConfig = {
    SPAWN: {
        PLAYER_X: 1100,
        PLAYER_Y: 1100,
        CAR_X: 1100,
        CAR_Y: 1220 // within enter range (VEHICLE_RADIUS=150)
    },
    TRAFFIC: {
        MAX_CARS: 8,
        SPAWN_DISTANCE: 500,
        DESPAWN_DISTANCE: 2000,
        BASE_SPEED: 150,
        SPEED_VARIANCE: 100
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
        MAX_SPEED: 420,
        ACCELERATION: 380,
        CATCH_RADIUS: 90,
        STEER_RATE: 2.4,
        VEL_INERTIA: 3.2
    }
};
