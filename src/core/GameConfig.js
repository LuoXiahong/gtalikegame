/**
 * CORE: KONFIGURACJA GRY (GameConfig)
 * Centralny punkt konfiguracji wartości liczbowych (magic numbers).
 */
export const GameConfig = {
    SPAWN: {
        PLAYER_X: 1100,
        PLAYER_Y: 1100
    },
    TRAFFIC: {
        MAX_CARS: 8,
        SPAWN_DISTANCE: 1000,
        DESPAWN_DISTANCE: 1400,
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
        SPAWN_DISTANCE: 1000,
        MAX_SPEED: 650,
        ACCELERATION: 500
    }
};
