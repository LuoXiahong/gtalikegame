import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WantedSystem } from './WantedSystem.js';
import { EventBus } from '../core/EventBus.js';
import { Time } from '../core/Time.js';

describe('WantedSystem', () => {
    beforeEach(() => {
        // Reset EventBus
        EventBus.listeners = {};
        Time.time = 0;
        WantedSystem.init();
    });

    it('should increase stars on incident', () => {
        let emittedStars = -1;
        EventBus.on('wanted_level_change', (data) => {
            emittedStars = data.stars;
        });

        EventBus.emit('npc_hit', {});

        expect(WantedSystem.stars).toBe(1);
        expect(emittedStars).toBe(1);
        expect(WantedSystem.timer).toBe(WantedSystem.resetTime);
    });

    it('should debounce incidents', () => {
        EventBus.emit('npc_hit', {});
        Time.time = 0.5; // less than 1.0 sec
        EventBus.emit('npc_hit', {});
        
        expect(WantedSystem.stars).toBe(1);
    });

    it('should decrease stars over time', () => {
        EventBus.emit('npc_hit', {}); // stars = 1
        expect(WantedSystem.stars).toBe(1);

        WantedSystem.update(WantedSystem.resetTime + 0.1); // passes reset time

        expect(WantedSystem.stars).toBe(0);
    });

    it('should cap at max stars', () => {
        for (let i = 0; i < 10; i++) {
            Time.time = i * 2.0;
            EventBus.emit('npc_hit', {});
        }
        expect(WantedSystem.stars).toBe(WantedSystem.maxStars);
    });
});
