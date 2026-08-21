/**
 * Time-of-day presets — lighting/fog data only (no render logic).
 * Persisted in localStorage; changes emit EventBus 'time_of_day_change'.
 */
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';

const STORAGE_KEY = 'lowge_time_of_day';
const WEATHER_STORAGE_KEY = 'lowge_weather';
const DEFAULT_PRESET = 'night';
const DEFAULT_WEATHER = 'rain';

export const WEATHER_MODES = ['clear', 'rain'];
/** How strongly camera zoom nudges fog distances (1 = full zoom scale). */
export const FOG_ZOOM_STRENGTH = 0.05;

export const TIME_PRESETS = {
    day: {
        ambient: { color: 0x8585a0, intensity: 0.62 },
        hemi: { sky: 0xa4b3c6, ground: 0x8a8078, intensity: 0.72 },
        sun: { color: 0xfff5e6, intensity: 1.35 },
        // scene.environmentIntensity — see note on night preset below.
        envIntensity: 1.0,
        fog: { color: 0x9a9a95, near: 80, far: 260 },
        streetLightMultiplier: 0.0,
        grading: { desaturation: 0.05, tint: 0xffffff },
        rim: { color: 0xa8b8d8, intensity: 0 },
    },
    dusk: {
        ambient: { color: 0x6a6a85, intensity: 0.42 },
        hemi: { sky: 0x7c88a8, ground: 0x5c5248, intensity: 0.5 },
        sun: { color: 0xffb87a, intensity: 0.5 },
        envIntensity: 0.5,
        fog: { color: 0x5c5a62, near: 60, far: 220 },
        streetLightMultiplier: 1.0,
        grading: { desaturation: 0.18, tint: 0xb0bcc8 },
        rim: { color: 0xa8b8d8, intensity: 0.22 },
    },
    night: {
        ambient: { color: 0x1e2230, intensity: 0.10 },
        hemi: { sky: 0x262c40, ground: 0x101218, intensity: 0.12 },
        // Was the key light in name only: at 0.06 it was ~40x weaker than the
        // (undimmed) IBL term below, so no building ever cast a visible shadow no
        // matter how correctly shadowMap/receiveShadow were wired (T26 confirmed
        // the machinery works — this is a budget problem, not a plumbing one).
        sun: { color: 0x7f96c0, intensity: 0.8 },
        // Every material here relies on scene.environment (PMREM) rather than its own
        // material.envMap, so per three.js r184's WebGLRenderer (materials.js: envMap ?
        // material.envMapIntensity : scene.environmentIntensity), the individual
        // envMapIntensity tunables on road/sidewalk/building-pad/facade materials (T18,
        // T25 etc.) are NOT read at all — every one of those materials silently uses this
        // single scene-wide value instead, which defaulted to three's built-in 1.0 and was
        // never set by any preset. That's the actual "budżet bezkierunkowy": a uniform,
        // always-on, full-strength IBL term at night, large enough to swamp the (already
        // very dim) sun above. Dropping it is what lets the sun's shadow read at all.
        //
        // First attempt used 0.12 (near the report's estimate). Looked fine in the scripted
        // screenshot corner, but live play (@user) showed the real cost: the street-light
        // PointLight pool's intensity (STREET_LIGHT_BASE=380 x 1.7 multiplier, tuned back
        // when it had a bright ambient floor to blend into) was never touched by this change,
        // so cutting ambient that far turned each lamp into an isolated blown-white flare in
        // an otherwise near-black frame, and a character standing in that pool lost all
        // shading against it. 0.35 keeps most of the directional win (roof/wall contrast,
        // real blacks between lamps) while leaving enough fill that the mid-street and a
        // character under a lamp both stay legible. Re-tune together with STREET_LIGHT_BASE
        // if this still isn't enough — don't just push this lower again.
        // Sidewalk/building-pad now opt out of this via their own explicit envMap
        // (CityBuilder3D.js) — this only governs materials without one (default
        // MeshStandardMaterial envMapIntensity=1, e.g. NPC/vehicle bodies, lamp glass).
        envIntensity: 0.35,
        // Camera sits ~120 world units from focus (RenderSystem3D.js: distance = 1200*SF),
        // so the previous near=30/far=160 put the camera inside its own fog band: the whole
        // visible ground got a depth-graded veil (far/top of frame ~37 luma, near/bottom
        // ~59, measured on the street-intersection screenshot) instead of just the distant
        // background. Pushed out so top and bottom read the same (~111 luma either way).
        // Kept well short of fully clearing the fog — past ~90/220 road paint and street
        // lamps cross BLOOM_THRESHOLD once unmasked and UnrealBloomPass smears them into
        // large soft blowouts (verified empirically, not just estimated). Recovering the
        // true blacks this trades away needs the directional-shadow/light-budget pass
        // (raport-ref-vs-actual-2026-08-20.md, finding D) — this fix only removes the
        // depth-dependent veil, it doesn't manufacture contrast that isn't there yet.
        fog: { color: 0x0c0e14, near: 50, far: 180 },
        streetLightMultiplier: 1.7,
        // Silver-mono push for ref parity (was 0.74 / warm-gray 0x9aa4b4)
        grading: { desaturation: 0.84, tint: 0x7a8ca0 },
        // Bumped from 0.45 — with a real directional shadow now in the scene, the
        // character needs an actual light catching its silhouette edge to read against
        // the (now genuinely dark) ground, not just a post-process floor (see shadow
        // lift note above — protecting the character is this light's job, not the lift's).
        rim: { color: 0xb0c4e0, intensity: 0.75 },
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
        EventBus.emit(EVENTS.TIME_OF_DAY_CHANGE, this.current);
        return true;
    },

    get() {
        return TIME_PRESETS[this.current];
    },

    applyWeather(name) {
        if (!WEATHER_MODES.includes(name)) return false;
        this.weather = name;
        this._persistWeather();
        EventBus.emit(EVENTS.WEATHER_CHANGE, this.weather);
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
