/**
 * System misji (MissionSystem)
 * Event-driven zamiast ifów w update
 */
import { EventBus } from '../core/EventBus.js';

export const MissionSystem = {
    stage: 0,

    init() {
        EventBus.on('player_near_npc', () => {
            if (this.stage === 0) {
                this.stage = 1;
                EventBus.emit('mission_update', 'Mission: Go to Car');
                EventBus.emit('audio_play', 'beep');
            }
        });

        EventBus.on('player_near_car', () => {
            if (this.stage === 1) {
                this.stage = 2;
                EventBus.emit('mission_update', 'MISSION COMPLETE');
                EventBus.emit('audio_play', 'success');
            }
        });

        // Stan początkowy
        setTimeout(() => EventBus.emit('mission_update', 'Mission: Find NPC'), 100);
    }
};
