/**
 * Time-of-day presets — lighting/fog data only (no render logic).
 * Persisted in localStorage; changes emit EventBus 'time_of_day_change'.
 */
import { EventBus } from '../core/EventBus.js';

const STORAGE_KEY = 'lowge_time_of_day';
const DEFAULT_PRESET = 'dusk';

export const TIME_PRESETS = {
    day: {
        ambient: { color: 0x8585a0, intensity: 0.62 },
        hemi: { sky: 0xa4b3c6, ground: 0x8a8078, intensity: 0.72 },
        sun: { color: 0xfff5e6, intensity: 1.35 },
        fog: { color: 0x9a9a95, near: 80, far: 260 },
        streetLightMultiplier: 0.0,
    },
    dusk: {
        ambient: { color: 0x6a6a85, intensity: 0.42 },
        hemi: { sky: 0x7c88a8, ground: 0x5c5248, intensity: 0.5 },
        sun: { color: 0xffb87a, intensity: 0.9 },
        fog: { color: 0x5c5a62, near: 60, far: 220 },
        streetLightMultiplier: 0.6,
    },
    night: {
        ambient: { color: 0x35354a, intensity: 0.22 },
        hemi: { sky: 0x3c4256, ground: 0x22201c, intensity: 0.28 },
        sun: { color: 0x8ea0c8, intensity: 0.25 },
        fog: { color: 0x1c1c22, near: 40, far: 180 },
        streetLightMultiplier: 1.0,
    },
};

export const TimeOfDaySettings = {
    current: DEFAULT_PRESET,

    init() {
        this._restore();
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

    reset() {
        this.current = DEFAULT_PRESET;
        try {
            localStorage.removeItem(STORAGE_KEY);
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
};
