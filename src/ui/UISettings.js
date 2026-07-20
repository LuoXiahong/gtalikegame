/**
 * UISettings — preferencje warstwy UI (lokalne, niezależne od efektu retro).
 * Przyciski WASD/F: auto (touch = włączone, desktop = wyłączone) lub jawny override.
 */
const STORAGE_KEY = 'gtalike_ui_settings';

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

export const UISettings = {
    /** @type {boolean|null} null = auto (device default) */
    _onScreenControlsOverride: null,

    init() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (typeof data.onScreenControls === 'boolean') {
                this._onScreenControlsOverride = data.onScreenControls;
            }
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

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                onScreenControls: this._onScreenControlsOverride,
            }));
        } catch {
            /* private mode / quota — ignore */
        }
    },

    /** Test helper / reset */
    reset() {
        this._onScreenControlsOverride = null;
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    },
};
