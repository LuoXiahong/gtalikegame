import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeOfDaySettings, TIME_PRESETS } from './TimeOfDaySettings.js';
import { EventBus } from '../core/EventBus.js';

describe('TimeOfDaySettings', () => {
    beforeEach(() => {
        EventBus.clear();
        TimeOfDaySettings.reset();
        try {
            localStorage.removeItem('lowge_time_of_day');
            localStorage.removeItem('lowge_weather');
        } catch {
            /* ignore */
        }
    });

    it('defaults to night + rain', () => {
        expect(TimeOfDaySettings.current).toBe('night');
        expect(TimeOfDaySettings.weather).toBe('rain');
        expect(TimeOfDaySettings.get()).toBe(TIME_PRESETS.night);
        expect(TimeOfDaySettings.get().streetLightMultiplier).toBe(2.2);
        expect(TimeOfDaySettings.get().grading.desaturation).toBeCloseTo(0.74);
        expect(TimeOfDaySettings.get().rim.intensity).toBeCloseTo(0.45);
        expect(TimeOfDaySettings.isRaining()).toBe(true);
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

    it('fogAtZoom scales near/far mildly with zoom', () => {
        const fog = TIME_PRESETS.dusk.fog;
        expect(TimeOfDaySettings.fogAtZoom(fog, 1)).toEqual({
            color: fog.color,
            near: 60,
            far: 220,
        });
        // strength 0.05 → zoom 2 → factor 1.05
        expect(TimeOfDaySettings.fogAtZoom(fog, 2).near).toBeCloseTo(63);
        expect(TimeOfDaySettings.fogAtZoom(fog, 2).far).toBeCloseTo(231);
        // zoom 0.5 → factor 0.975
        expect(TimeOfDaySettings.fogAtZoom(fog, 0.5).near).toBeCloseTo(58.5);
        expect(TimeOfDaySettings.fogAtZoom(fog, 0.5).far).toBeCloseTo(214.5);
    });

    it('applyWeather changes weather and emits weather_change', () => {
        const spy = vi.fn();
        EventBus.on('weather_change', spy);

        expect(TimeOfDaySettings.applyWeather('rain')).toBe(true);
        expect(TimeOfDaySettings.weather).toBe('rain');
        expect(TimeOfDaySettings.isRaining()).toBe(true);
        expect(spy).toHaveBeenCalledWith('rain');

        expect(TimeOfDaySettings.applyWeather('clear')).toBe(true);
        expect(TimeOfDaySettings.weather).toBe('clear');
        expect(spy).toHaveBeenCalledWith('clear');
    });

    it('rejects unknown weather without changing state', () => {
        const spy = vi.fn();
        EventBus.on('weather_change', spy);
        TimeOfDaySettings.weather = 'clear';

        expect(TimeOfDaySettings.applyWeather('snow')).toBe(false);
        expect(TimeOfDaySettings.weather).toBe('clear');
        expect(spy).not.toHaveBeenCalled();
    });

    it('persists and restores weather from localStorage via init', () => {
        TimeOfDaySettings.applyWeather('rain');
        TimeOfDaySettings.weather = 'clear';
        TimeOfDaySettings.init();
        expect(TimeOfDaySettings.weather).toBe('rain');
    });
});
