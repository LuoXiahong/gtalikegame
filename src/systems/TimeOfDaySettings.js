/**
 * Time-of-day presets — lighting/fog data only (no render logic).
 * Persisted in localStorage; changes emit EventBus 'time_of_day_change'.
 */
import { EventBus } from '../core/EventBus.js';

const STORAGE_KEY = 'lowge_time_of_day';
const WEATHER_STORAGE_KEY = 'lowge_weather';
const DEFAULT_PRESET = 'dusk';
const DEFAULT_WEATHER = 'clear';

export const WEATHER_MODES = ['clear', 'rain'];
/** How strongly camera zoom nudges fog distances (1 = full zoom scale). */
export const FOG_ZOOM_STRENGTH = 0.05;

export const TIME_PRESETS = {
    day: {
        ambient: { color: 0x8585a0, intensity: 0.62 },
        hemi: { sky: 0xa4b3c6, ground: 0x8a8078, intensity: 0.72 },
        sun: { color: 0xfff5e6, intensity: 1.35 },
        fog: { color: 0x9a9a95, near: 80, far: 260 },
        streetLightMultiplier: 0.0,
        grading: { desaturation: 0.05, tint: 0xffffff },
        rim: { color: 0xa8b8d8, intensity: 0 },
    },
    dusk: {
        ambient: { color: 0x6a6a85, intensity: 0.42 },
        hemi: { sky: 0x7c88a8, ground: 0x5c5248, intensity: 0.5 },
        sun: { color: 0xffb87a, intensity: 0.5 },
        fog: { color: 0x5c5a62, near: 60, far: 220 },
        streetLightMultiplier: 1.0,
        grading: { desaturation: 0.18, tint: 0xb0bcc8 },
        rim: { color: 0xa8b8d8, intensity: 0.22 },
    },
    night: {
        ambient: { color: 0x252538, intensity: 0.10 },
        hemi: { sky: 0x2a2e42, ground: 0x141210, intensity: 0.12 },
        sun: { color: 0x6a7ba8, intensity: 0.06 },
        fog: { color: 0x0e0e12, near: 30, far: 160 },
        streetLightMultiplier: 3.4,
        grading: { desaturation: 0.42, tint: 0x8ea0c8 },
        rim: { color: 0xb0c4e0, intensity: 0.45 },
    },
};

export const TimeOfDaySettings = {
    current: DEFAULT_PRESET,
    weather: DEFAULT_WEATHER,

    init() {
        this._restore();
        this._restoreWeather();
    },

    applyPreset(name) {
        if (!TIME_PRESETS[name]) return false;
        this.current = name;
        this._persist();
        EventBus.emit('time_of_day_change', this.current);
        return true;
    },

    get() {
        return TIME_PRESETS[this.current];
    },

    applyWeather(name) {
        if (!WEATHER_MODES.includes(name)) return false;
        this.weather = name;
        this._persistWeather();
        EventBus.emit('weather_change', this.weather);
        return true;
    },

    isRaining() {
        return this.weather === 'rain';
    },

    /**
     * Fog near/far are authored at zoom=1. Mildly scale with camera zoom so
     * zooming in pushes fog away and zooming out brings it closer.
     * @param {{ color: number, near: number, far: number }} fog
     * @param {number} zoom
     */
    fogAtZoom(fog = this.get().fog, zoom = 1) {
        const z = Math.max(Number(zoom) || 1, 0.01);
        const factor = 1 + (z - 1) * FOG_ZOOM_STRENGTH;
        return {
            color: fog.color,
            near: fog.near * factor,
            far: fog.far * factor,
        };
    },

    reset() {
        this.current = DEFAULT_PRESET;
        this.weather = DEFAULT_WEATHER;
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(WEATHER_STORAGE_KEY);
        } catch {
            /* ignore */
        }
    },

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, this.current);
        } catch {
            /* private mode / quota — ignore */
        }
    },

    _restore() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && TIME_PRESETS[saved]) {
                this.current = saved;
            }
        } catch {
            /* ignore */
        }
    },

    _persistWeather() {
        try {
            localStorage.setItem(WEATHER_STORAGE_KEY, this.weather);
        } catch {
            /* private mode / quota — ignore */
        }
    },

    _restoreWeather() {
        try {
            const saved = localStorage.getItem(WEATHER_STORAGE_KEY);
            if (saved && WEATHER_MODES.includes(saved)) {
                this.weather = saved;
            }
        } catch {
            /* ignore */
        }
    },
};
