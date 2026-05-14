import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioSystem } from './AudioSystem.js';
import { EventBus } from '../core/EventBus.js';

describe('AudioSystem', () => {
    beforeEach(() => {
        EventBus.listeners = {};
        global.Audio = class {
            constructor(url) {
                this.url = url;
                this.currentTime = 0;
                this.volume = 1;
            }
            play() {
                return Promise.resolve();
            }
        };
        AudioSystem.init();
    });

    it('should initialize sounds dictionary', () => {
        expect(AudioSystem.sounds['step']).toBeDefined();
        expect(AudioSystem.sounds['beep']).toBeDefined();
    });

    it('should play sound on audio_play event', () => {
        const sound = AudioSystem.sounds['step'];
        const spy = vi.spyOn(sound, 'play');
        
        EventBus.emit('audio_play', 'step');
        
        expect(spy).toHaveBeenCalled();
        expect(sound.volume).toBe(0.3);
        expect(sound.currentTime).toBe(0);
    });

    it('should reset sounds dictionary correctly', () => {
        AudioSystem.reset();
        expect(Object.keys(AudioSystem.sounds).length).toBe(0);
    });
});
