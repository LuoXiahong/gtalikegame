/**
 * CORE: KATALOG ZDARZEŃ (Events)
 * Słownik wszystkich zdarzeń emitowanych w systemie.
 */
export const EVENTS = {
    // Cykl życia i stan
    STATE_CHANGE: 'state_change',

    // Interakcja z pojazdami
    ENTER_VEHICLE: 'enter_vehicle',
    EXIT_VEHICLE: 'exit_vehicle',
    VEHICLE_ENTERED: 'vehicle_entered',
    VEHICLE_EXITED: 'vehicle_exited',

    // Walka i zdarzenia w świecie
    GUNSHOT: 'gunshot',
    EXPLOSION: 'explosion',
    NPC_HIT: 'npc_hit',
    PLAYER_NEAR_NPC: 'player_near_npc',
    PLAYER_NEAR_CAR: 'player_near_car',

    // UI i Misje
    UI_SHOW_DIALOGUE: 'ui_show_dialogue',
    UI_SHOW_ACTION_HINT: 'ui_show_action_hint',
    MISSION_UPDATE: 'mission_update',
    SPEED_UPDATE: 'speed_update',
    WANTED_LEVEL_CHANGE: 'wanted_level_change',
    WANTED_RESET: 'wanted_reset',

    // Audio
    AUDIO_PLAY: 'audio_play'
};
