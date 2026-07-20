/**
 * RetroFilmSettings — łagodniejsze domyślne wartości (czytelne postacie, jaśniejsze cienie).
 */

export const RETRO_PRESETS = {
    off: {
        enabled: false,
        intensity: 0,
        vignette: 0,
        flicker: 0,
        jitter: 0,
        grain: 0,
        scratches: 0,
        dust: 0,
        sepia: 0,
        contrast: 0,
    },
    subtle: {
        enabled: true,
        intensity: 70,
        vignette: 25,
        flicker: 12,
        jitter: 10,
        grain: 20,
        scratches: 15,
        dust: 0,
        sepia: 22,
        contrast: 8,
    },
    classic: {
        enabled: true,
        intensity: 85,
        vignette: 40,
        flicker: 25,
        jitter: 8,
        grain: 35,
        scratches: 40,
        dust: 0,
        sepia: 35,
        contrast: 15,
    },
    ruined: {
        enabled: true,
        intensity: 95,
        vignette: 55,
        flicker: 45,
        jitter: 45,
        grain: 45,
        scratches: 65,
        dust: 15,
        sepia: 50,
        contrast: 28,
    },
};

const DEFAULTS = { ...RETRO_PRESETS.classic };

export const RETRO_PARAM_KEYS = [
    'intensity',
    'vignette',
    'flicker',
    'jitter',
    'grain',
    'scratches',
    'dust',
    'sepia',
    'contrast',
];

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

export const RetroFilmSettings = {
    enabled: DEFAULTS.enabled,
    intensity: DEFAULTS.intensity,
    vignette: DEFAULTS.vignette,
    flicker: DEFAULTS.flicker,
    jitter: DEFAULTS.jitter,
    grain: DEFAULTS.grain,
    scratches: DEFAULTS.scratches,
    dust: DEFAULTS.dust,
    sepia: DEFAULTS.sepia,
    contrast: DEFAULTS.contrast,

    isActive() {
        return this.enabled === true && this.intensity > 0;
    },

    get(key) {
        return this[key];
    },

    set(key, value) {
        if (key === 'enabled') {
            this.enabled = Boolean(value);
            return;
        }
        if (!RETRO_PARAM_KEYS.includes(key)) return;
        const num = Number(value);
        if (Number.isNaN(num)) return;
        if (key === 'contrast') {
            this.contrast = clamp(num, -50, 100);
        } else {
            this[key] = clamp(num, 0, 100);
        }
    },

    applyPreset(name) {
        const preset = RETRO_PRESETS[name];
        if (!preset) return false;
        this.enabled = preset.enabled;
        RETRO_PARAM_KEYS.forEach((k) => {
            this[k] = preset[k];
        });
        return true;
    },

    applyToUniforms(uniforms) {
        if (!uniforms) return;
        const active = this.isActive();
        const master = active ? this.intensity / 100 : 0;
        const set = (name, v) => {
            if (uniforms[name]) uniforms[name].value = v;
        };
        set('intensity', master);
        set('vignette', this.vignette / 100);
        set('flicker', this.flicker / 100);
        set('jitter', this.jitter / 100);
        set('grain', this.grain / 100);
        set('scratches', this.scratches / 100);
        set('dust', this.dust / 100);
        set('sepia', this.sepia / 100);
        set('contrast', this.contrast / 100);
        set('fps', 18.0);
    },

    toJSON() {
        return {
            enabled: this.enabled,
            intensity: this.intensity,
            vignette: this.vignette,
            flicker: this.flicker,
            jitter: this.jitter,
            grain: this.grain,
            scratches: this.scratches,
            dust: this.dust,
            sepia: this.sepia,
            contrast: this.contrast,
        };
    },

    reset() {
        this.applyPreset('classic');
    },
};
