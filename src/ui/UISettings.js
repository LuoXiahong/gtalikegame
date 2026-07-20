/**
 * UISettings — preferencje warstwy UI (lokalne, niezależne od efektu retro).
 * Przyciski WASD/F: auto (touch = włączone, desktop = wyłączone) lub jawny override.
 * Język: pl | en | de | es | fr.
 */
import { SUPPORTED_LOCALES } from '../i18n/locales.js';

const STORAGE_KEY = 'gtalike_ui_settings';
const DEFAULT_LOCALE = 'pl';

function detectTouchPrimary() {
    if (typeof window === 'undefined') return false;
    try {
        if (window.matchMedia('(pointer: coarse)').matches) return true;
        if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return true;
    } catch {
        /* matchMedia may be unavailable in some test envs */
    }
    return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
}

function normalizeLocale(code) {
    if (!code || typeof code !== 'string') return null;
    const lower = code.toLowerCase().slice(0, 2);
    return SUPPORTED_LOCALES.includes(lower) ? lower : null;
}

export const UISettings = {
    /** @type {boolean|null} null = auto (device default) */
    _onScreenControlsOverride: null,
    /** @type {string} */
    _locale: DEFAULT_LOCALE,

    init() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (typeof data.onScreenControls === 'boolean') {
                this._onScreenControlsOverride = data.onScreenControls;
            }
            const loc = normalizeLocale(data.locale);
            if (loc) this._locale = loc;
        } catch {
            this._onScreenControlsOverride = null;
        }
    },

    /** True when device is likely touch-first (phones / tablets). */
    prefersTouchControls() {
        return detectTouchPrimary();
    },

    /**
     * Effective visibility for on-screen WASD / F buttons.
     * Override wins; otherwise auto: on for touch, off for desktop.
     */
    get showOnScreenControls() {
        if (this._onScreenControlsOverride !== null) {
            return this._onScreenControlsOverride;
        }
        return this.prefersTouchControls();
    },

    /** Checkbox / options value (effective state). */
    getOnScreenControls() {
        return this.showOnScreenControls;
    },

    /**
     * Lock preference (persisted). Pass boolean to force on/off.
     * @param {boolean} enabled
     */
    setOnScreenControls(enabled) {
        this._onScreenControlsOverride = Boolean(enabled);
        this._persist();
    },

    getLocale() {
        return this._locale;
    },

    /**
     * @param {string} code
     * @returns {boolean} true if stored value changed
     */
    setLocale(code) {
        const next = normalizeLocale(code);
        if (!next || next === this._locale) return false;
        this._locale = next;
        this._persist();
        return true;
    },

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                onScreenControls: this._onScreenControlsOverride,
                locale: this._locale,
            }));
        } catch {
            /* private mode / quota — ignore */
        }
    },

    /** Test helper / reset */
    reset() {
        this._onScreenControlsOverride = null;
        this._locale = DEFAULT_LOCALE;
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    },
};
