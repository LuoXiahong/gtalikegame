import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { InputSystem } from '../input/InputManager.js';
import { World } from './World.js';
import { frameBlend } from '../core/MathUtils.js';

/**
 * Owns all camera state derived from the controlled entity — the 2D
 * screen-offset both renderers used to compute independently, plus the
 * 3D-only isometric zoom and speed look-ahead that used to live inside
 * RenderSystem3D itself (reading InputSystem directly from the render loop).
 * Both renderers now only read fields here; neither computes camera logic
 * or touches input (CLAUDE.md rule #5 — renderers stay gameplay-oblivious).
 */

// Speed-based 3D camera dynamics (T21 — Speed Zoom / Look-ahead). Constants
// are tuned per 60fps frame; frameBlend() rescales them to the actual
// elapsed dt so the feel doesn't depend on frame rate.
const SPEED_REF = 300;        // physics.speed (px/s) at which effects fully ramp up
const ZOOM_SMOOTHING = 0.05;  // lerp factor/frame for zoom-out
const ZOOM_OUT_MAX = 0.2;     // max fractional zoom-out at SPEED_REF
const LOOK_AHEAD_MAX = 90;    // world px the focus shifts ahead at SPEED_REF
const LOOK_AHEAD_SMOOTHING = 0.04;

// 2D screen-offset follow. Higher = snappier.
const FOLLOW_SMOOTHING = 6.0;

/**
 * 3D zoom steps cycled by Z, ordered wide → tight. 2.0 is the default, with
 * a wider and a tighter step around it.
 */
export const ZOOM_LEVELS = [1.0, 2.0, 3.0];
export const DEFAULT_ZOOM_INDEX = 1;

// Matches GameConfig.SPAWN.PLAYER_X/Y — sane focus before the first entity spawns.
const DEFAULT_FOCUS = 1100;

export const Camera = {
    // 2D screen-offset (ctx.translate convention): width/2 - focus.x
    x: 0,
    y: 0,
    width: 800,
    height: 600,

    // World-space point the 3D camera looks at (controlled entity + look-ahead).
    focusX: DEFAULT_FOCUS,
    focusY: DEFAULT_FOCUS,

    // 3D-only: isometric zoom and speed look-ahead.
    zoomIndex: DEFAULT_ZOOM_INDEX,
    zoom: ZOOM_LEVELS[DEFAULT_ZOOM_INDEX],
    lookAheadX: 0,
    lookAheadY: 0,

    _needsSnap: false,

    init() {
        EventBus.on(EVENTS.VEHICLE_ENTERED, () => {
            this._needsSnap = true;
        });
        EventBus.on(EVENTS.VEHICLE_EXITED, () => {
            this._needsSnap = true;
        });
    },

    /**
     * Advances all camera state for one tick. Call once per frame, before
     * either renderer reads Camera.* fields. No-ops if nothing is controlled
     * yet (e.g. before the first spawn).
     * @param {number} dt - elapsed seconds this tick
     * @param {{ freezeZoomAndLookAhead?: boolean }} [opts] - freeze the 3D
     *   zoom/look-ahead smoothing (screenshot mode needs a static, un-animated
     *   camera so captures are deterministic regardless of frame timing).
     *   Position tracking (2D follow, 3D base focus) is never frozen.
     */
    update(dt, { freezeZoomAndLookAhead = false } = {}) {
        const controlled = World.getControlled();
        if (!controlled || !controlled.transform) return;

        // --- 2D screen-offset follow ---
        const targetX = this.width / 2 - controlled.transform.x;
        const targetY = this.height / 2 - controlled.transform.y;
        if (this._needsSnap) {
            this.x = targetX;
            this.y = targetY;
            this._needsSnap = false;
        } else {
            this.x += (targetX - this.x) * Math.min(1, FOLLOW_SMOOTHING * dt);
            this.y += (targetY - this.y) * Math.min(1, FOLLOW_SMOOTHING * dt);
        }

        // --- 3D zoom (speed-based zoom-out) ---
        if (InputSystem.consumeZoomToggle()) {
            this.zoomIndex = (this.zoomIndex + 1) % ZOOM_LEVELS.length;
        }

        const isCar = controlled.physics && controlled.type === 'car';
        const speed = isCar ? Math.abs(controlled.physics.speed || 0) : 0;
        const speedRatio = Math.min(speed / SPEED_REF, 1.0);

        if (!freezeZoomAndLookAhead) {
            const baseZoom = ZOOM_LEVELS[this.zoomIndex] ?? ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
            const targetZoom = baseZoom * (1.0 - ZOOM_OUT_MAX * speedRatio);
            this.zoom += (targetZoom - this.zoom) * frameBlend(ZOOM_SMOOTHING, dt);
        }

        // --- 3D speed look-ahead ---
        // Squared ratio keeps it subtle at low/mid speed and only pronounced near top speed.
        let targetLookAheadX = 0;
        let targetLookAheadY = 0;
        if (isCar) {
            const signedSpeed = controlled.physics.speed || 0;
            const lookAheadRatio = Math.min(Math.abs(signedSpeed) / SPEED_REF, 1.0) ** 2;
            const dir = Math.sign(signedSpeed);
            targetLookAheadX = Math.cos(controlled.transform.angle) * LOOK_AHEAD_MAX * lookAheadRatio * dir;
            targetLookAheadY = Math.sin(controlled.transform.angle) * LOOK_AHEAD_MAX * lookAheadRatio * dir;
        }
        if (!freezeZoomAndLookAhead) {
            const blend = frameBlend(LOOK_AHEAD_SMOOTHING, dt);
            this.lookAheadX += (targetLookAheadX - this.lookAheadX) * blend;
            this.lookAheadY += (targetLookAheadY - this.lookAheadY) * blend;
        }

        this.focusX = controlled.transform.x + this.lookAheadX;
        this.focusY = controlled.transform.y + this.lookAheadY;
    }
};
