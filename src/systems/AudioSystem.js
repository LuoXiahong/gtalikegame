/**
 * System audio (AudioSystem)
 * Zero logiki gameplay w audio.
 */
import { EventBus } from '../core/EventBus.js';

export const AudioSystem = {
    sounds: {},

    init() {
        this.reset();
        if (this._onAudioPlay) EventBus.off('audio_play', this._onAudioPlay);

        // Bezpieczne tworzenie Audio, gdy wspierane
        if (typeof Audio !== 'undefined') {
            this.sounds['step'] = new Audio('https://actions.google.com/sounds/v1/foley/footstep_on_wood.ogg');
            this.sounds['beep'] = new Audio('https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg');
            this.sounds['gunshot'] = new Audio('https://actions.google.com/sounds/v1/weapons/firearm_shot.ogg');
            this.sounds['explosion'] = new Audio('https://actions.google.com/sounds/v1/foley/explosion.ogg');
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
        EventBus.on('audio_play', this._onAudioPlay);
    },

    reset() {
        this.sounds = {};
    }
};
