/**
 * Catalog of events emitted on the EventBus.
 */
export const EVENTS = {
    // Lifecycle / state
    STATE_CHANGE: 'state_change',

    // Vehicles
    ENTER_VEHICLE: 'enter_vehicle',
    EXIT_VEHICLE: 'exit_vehicle',
    VEHICLE_ENTERED: 'vehicle_entered',
    VEHICLE_EXITED: 'vehicle_exited',

    // Combat / world
    GUNSHOT: 'gunshot',
    EXPLOSION: 'explosion',
    NPC_HIT: 'npc_hit',
    PLAYER_NEAR_NPC: 'player_near_npc',
    PLAYER_NEAR_CAR: 'player_near_car',

    // Health / damage
    HEALTH_CHANGE: 'health_change',
    PLAYER_KNOCKOUT: 'player_knockout',
    NPC_KNOCKOUT: 'npc_knockout',

    // UI / missions
    UI_SHOW_DIALOGUE: 'ui_show_dialogue',
    UI_SHOW_ACTION_HINT: 'ui_show_action_hint',
    MISSION_UPDATE: 'mission_update',
    SPEED_UPDATE: 'speed_update',
    WANTED_LEVEL_CHANGE: 'wanted_level_change',
    WANTED_RESET: 'wanted_reset',

    // Audio
    AUDIO_PLAY: 'audio_play',

    // Restart
    GAME_RESTART: 'game_restart',

    // Locale / settings
    LOCALE_CHANGE: 'locale_change',
    UI_SETTINGS_CHANGE: 'ui_settings_change',
    RETRO_SETTINGS_CHANGE: 'retro_settings_change',
    WEATHER_CHANGE: 'weather_change',
    TIME_OF_DAY_CHANGE: 'time_of_day_change',
};
