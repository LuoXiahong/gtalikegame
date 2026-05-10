/**
 * System misji (MissionSystem)
 * Event-driven + update loop for timers and zones
 */
import { EventBus } from '../core/EventBus.js';
import { World } from '../world/World.js';

export const MissionSystem = {
    stage: 0,
    timer: 0,
    timerActive: false,
    targetLocation: null,

    init() {
        this.stage = 0;
        this.timer = 0;
        this.timerActive = false;
        this.targetLocation = null;

        EventBus.on('player_near_npc', () => {
            if (this.stage === 0) {
                this.stage = 1;
                this.timer = 45;
                this.timerActive = true;
                EventBus.emit('mission_update', 'Mission: Go to Car');
                EventBus.emit('audio_play', 'beep');
            }
        });

        EventBus.on('player_near_car', () => {
            if (this.stage === 1) {
                this.stage = 2;
                this.timer = 60;
                this.timerActive = true;
                this.targetLocation = { x: 3000, y: 3000, radius: 150 };
                EventBus.emit('mission_update', 'Mission: Deliver Car to Safehouse');
                EventBus.emit('audio_play', 'beep');
            }
        });

        // Stan początkowy
        setTimeout(() => EventBus.emit('mission_update', 'Mission: Find NPC'), 100);
    },

    update(dt) {
        if (!this.timerActive) return;

        this.timer -= dt;

        if (this.timer <= 0) {
            // Pressure: escalate wanted level
            EventBus.emit('npc_hit'); // Trigger WantedSystem incident
            this.timer = 10; // Repeat pressure every 10s
            EventBus.emit('mission_update', 'HURRY UP! Police is coming!');
        } else {
            const timeStr = Math.ceil(this.timer);
            let msg = '';
            if (this.stage === 1) msg = `Mission: Go to Car (${timeStr}s)`;
            if (this.stage === 2) msg = `Mission: Deliver Car (${timeStr}s)`;
            if (msg) EventBus.emit('mission_update', msg);
        }

        if (this.stage === 2 && this.targetLocation) {
            const players = World.getEntitiesByType('player');
            if (players.length > 0) {
                const p = players[0];
                const dx = p.transform.x - this.targetLocation.x;
                const dy = p.transform.y - this.targetLocation.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < this.targetLocation.radius) {
                    this.stage = 3;
                    this.timerActive = false;
                    this.targetLocation = null;
                    EventBus.emit('mission_update', 'MISSION COMPLETE');
                    EventBus.emit('audio_play', 'success');
                }
            }
        }
    }
};
