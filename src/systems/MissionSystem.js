/**
 * Mission flow: event-driven stages plus update loop for timers/zones.
 */
import { EventBus } from '../core/EventBus.js';
import { GameState, GAME_STATES } from '../core/GameState.js';
import { World } from '../world/World.js';
import { I18n } from '../i18n/I18n.js';

export const MissionSystem = {
    stage: 0,
    timer: 0,
    timerActive: false,
    targetLocation: null,
    _hurryActive: false,

    init() {
        this.reset();
        if (this._onNearNpc) EventBus.off('player_near_npc', this._onNearNpc);
        if (this._onNearCar) EventBus.off('player_near_car', this._onNearCar);
        if (this._onLocale) EventBus.off('locale_change', this._onLocale);

        this._onNearNpc = () => {
            if (this.stage === 0) {
                this.stage = 1;
                this.timer = 45;
                this.timerActive = true;
                this._hurryActive = false;
                this.publishMissionText();
                EventBus.emit('audio_play', 'beep');
            }
        };
        EventBus.on('player_near_npc', this._onNearNpc);

        this._onNearCar = () => {
            if (this.stage === 1) {
                this.stage = 2;
                this.timer = 60;
                this.timerActive = true;
                this._hurryActive = false;
                this.targetLocation = { x: 3000, y: 3000, radius: 150 };
                this.publishMissionText();
                EventBus.emit('audio_play', 'beep');
            }
        };
        EventBus.on('player_near_car', this._onNearCar);

        this._onLocale = () => this.publishMissionText();
        EventBus.on('locale_change', this._onLocale);

        setTimeout(() => this.publishMissionText(), 100);
    },

    reset() {
        this.stage = 0;
        this.timer = 0;
        this.timerActive = false;
        this.targetLocation = null;
        this._hurryActive = false;
    },

    /** Mission text for current stage / timer / locale. */
    getMissionText() {
        if (this._hurryActive) return I18n.t('mission.hurry');
        if (this.stage === 0) return I18n.t('mission.findNpc');
        if (this.stage === 1) {
            if (this.timerActive) {
                return I18n.t('mission.goToCarTimed', { s: Math.ceil(this.timer) });
            }
            return I18n.t('mission.goToCar');
        }
        if (this.stage === 2) {
            if (this.timerActive) {
                return I18n.t('mission.deliverTimed', { s: Math.ceil(this.timer) });
            }
            return I18n.t('mission.deliver');
        }
        if (this.stage >= 3) return I18n.t('mission.complete');
        return '';
    },

    publishMissionText() {
        EventBus.emit('mission_update', this.getMissionText());
    },

    update(dt) {
        if (!this.timerActive) return;

        this.timer -= dt;

        if (this.timer <= 0) {
            // Pressure: escalate wanted level
            EventBus.emit('npc_hit'); // Trigger WantedSystem incident
            this.timer = 10; // Repeat pressure every 10s
            this._hurryActive = true;
            this.publishMissionText();
        } else {
            this._hurryActive = false;
            this.publishMissionText();
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
                    this._hurryActive = false;
                    this.targetLocation = null;
                    this.publishMissionText();
                    EventBus.emit('audio_play', 'success');
                    GameState.setState(GAME_STATES.MISSION_PASSED);
                }
            }
        }
    }
};
