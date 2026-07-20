import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeOfDaySettings, TIME_PRESETS } from './TimeOfDaySettings.js';
import { EventBus } from '../core/EventBus.js';

describe('TimeOfDaySettings', () => {
    beforeEach(() => {
        EventBus.clear();
        TimeOfDaySettings.reset();
        try {
            localStorage.removeItem('lowge_time_of_day');
        } catch {
            /* ignore */
        }
    });

    it('defaults to dusk preset', () => {
        expect(TimeOfDaySettings.current).toBe('dusk');
        expect(TimeOfDaySettings.get()).toBe(TIME_PRESETS.dusk);
        expect(TimeOfDaySettings.get().streetLightMultiplier).toBe(0.6);
    });

    it('applyPreset changes current and emits time_of_day_change', () => {
        const spy = vi.fn();
        EventBus.on('time_of_day_change', spy);

        expect(TimeOfDaySettings.applyPreset('night')).toBe(true);
        expect(TimeOfDaySettings.current).toBe('night');
        expect(TimeOfDaySettings.get()).toBe(TIME_PRESETS.night);
        expect(spy).toHaveBeenCalledWith('night');

        expect(TimeOfDaySettings.applyPreset('day')).toBe(true);
        expect(TimeOfDaySettings.current).toBe('day');
        expect(spy).toHaveBeenCalledWith('day');
    });

    it('rejects unknown presets without changing state', () => {
        const spy = vi.fn();
        EventBus.on('time_of_day_change', spy);
        TimeOfDaySettings.current = 'dusk';

        expect(TimeOfDaySettings.applyPreset('noon')).toBe(false);
        expect(TimeOfDaySettings.current).toBe('dusk');
        expect(spy).not.toHaveBeenCalled();
    });

    it('persists and restores from localStorage via init', () => {
        TimeOfDaySettings.applyPreset('night');
        TimeOfDaySettings.current = 'dusk';
        TimeOfDaySettings.init();
        expect(TimeOfDaySettings.current).toBe('night');
    });
});
