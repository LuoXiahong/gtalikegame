/**
 * System audio (AudioSystem)
 * Zero logiki gameplay w audio.
 */
import { EventBus } from '../core/EventBus.js';

export const AudioSystem = {
    sounds: {},

    init() {
        this.sounds['step'] = new Audio('https://actions.google.com/sounds/v1/foley/footstep_on_wood.ogg');
        this.sounds['beep'] = new Audio('https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg');
        this.sounds['gunshot'] = new Audio('https://actions.google.com/sounds/v1/weapons/firearm_shot.ogg');
        this.sounds['explosion'] = new Audio('https://actions.google.com/sounds/v1/foley/explosion.ogg');

        EventBus.on('audio_play', (name) => {
            if (this.sounds[name]) {
                this.sounds[name].currentTime = 0;
                this.sounds[name].volume = 0.3;
                this.sounds[name].play().catch(e => { });
            }
        });
    }
};
