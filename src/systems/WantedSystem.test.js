import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WantedSystem } from './WantedSystem.js';
import { PoliceSystem } from './PoliceSystem.js';
import { EventBus } from '../core/EventBus.js';
import { Time } from '../core/Time.js';

describe('WantedSystem', () => {
    beforeEach(() => {
        // Reset EventBus
        EventBus.listeners = {};
        Time.time = 0;
        PoliceSystem.isActive = false;
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

    it('should increase stars on gunshot', () => {
        EventBus.emit('gunshot', { x: 0, y: 0 });

        expect(WantedSystem.stars).toBe(1);
        expect(WantedSystem.timer).toBe(WantedSystem.resetTime);
    });

    it('should increase stars on explosion', () => {
        EventBus.emit('explosion', { x: 0, y: 0, radius: 100 });

        expect(WantedSystem.stars).toBe(1);
        expect(WantedSystem.timer).toBe(WantedSystem.resetTime);
    });

    it('should not decay timer while police chase is active', () => {
        EventBus.emit('npc_hit', {}); // stars = 1
        PoliceSystem.isActive = true;

        WantedSystem.update(WantedSystem.resetTime + 5);

        expect(WantedSystem.stars).toBe(1);
        expect(WantedSystem.timer).toBe(WantedSystem.resetTime);
    });

    it('should resume decaying once police chase ends', () => {
        EventBus.emit('npc_hit', {}); // stars = 1
        PoliceSystem.isActive = true;
        WantedSystem.update(WantedSystem.resetTime + 5);
        expect(WantedSystem.stars).toBe(1);

        PoliceSystem.isActive = false;
        WantedSystem.update(WantedSystem.resetTime + 0.1);

        expect(WantedSystem.stars).toBe(0);
    });

    it('should reset state correctly', () => {
        WantedSystem.stars = 3;
        WantedSystem.timer = 5;
        const spy = vi.spyOn(EventBus, 'emit');
        WantedSystem.reset();
        expect(WantedSystem.stars).toBe(0);
        expect(WantedSystem.timer).toBe(0);
        expect(spy).toHaveBeenCalledWith('wanted_reset');
    });
});
