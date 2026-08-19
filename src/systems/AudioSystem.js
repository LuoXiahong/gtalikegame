/**
 * Audio playback only — no gameplay logic.
 */
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';

export const AudioSystem = {
    sounds: {},

    init() {
        this.reset();
        if (this._onAudioPlay) EventBus.off(EVENTS.AUDIO_PLAY, this._onAudioPlay);

        // Skip when Audio API is unavailable (e.g. some test envs)
        if (typeof Audio !== 'undefined') {
            this.sounds['step'] = new Audio('https://actions.google.com/sounds/v1/foley/footstep_on_wood.ogg');
            this.sounds['beep'] = new Audio('https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg');
            this.sounds['gunshot'] = new Audio('https://actions.google.com/sounds/v1/weapons/firearm_shot.ogg');
            this.sounds['explosion'] = new Audio('https://actions.google.com/sounds/v1/foley/explosion.ogg');
            this.sounds['success'] = new Audio('https://actions.google.com/sounds/v1/cartoon/congrats.ogg');
        }

        this._onAudioPlay = (name) => {
            if (this.sounds[name]) {
                this.sounds[name].currentTime = 0;
                this.sounds[name].volume = 0.3;
                if (typeof this.sounds[name].play === 'function') {
                    const p = this.sounds[name].play();
                    if (p && p.catch) p.catch(e => { });
                }
            }
        };
        EventBus.on(EVENTS.AUDIO_PLAY, this._onAudioPlay);
    },

    reset() {
        this.sounds = {};
    }
};
