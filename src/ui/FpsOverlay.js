/**
 * FpsOverlay — optional on-screen FPS readout (dev/UX).
 * Visibility driven by UISettings.showFps (default OFF).
 */
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { UISettings } from './UISettings.js';

const CSS = `
#fpsOverlay {
    position: absolute;
    bottom: 48px;
    left: 14px;
    z-index: 14;
    pointer-events: none;
    display: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(230, 235, 240, 0.92);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
    background: rgba(0, 0, 0, 0.45);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.12);
}
#fpsOverlay.active {
    display: block;
}
`;

export const FpsOverlay = {
    _el: null,
    _smoothed: 60,
    _accum: 0,
    _frames: 0,

    init() {
        if (this._el) return;

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'fpsOverlay';
        el.setAttribute('aria-live', 'polite');
        el.textContent = '— FPS';

        const root = document.getElementById('gameContainer') || document.body;
        root.appendChild(el);
        this._el = el;

        this.setVisible(UISettings.getShowFps());
        EventBus.on(EVENTS.UI_SETTINGS_CHANGE, ({ showFps } = {}) => {
            if (typeof showFps === 'boolean') {
                this.setVisible(showFps);
            }
        });
    },

    setVisible(on) {
        if (!this._el) return;
        this._el.classList.toggle('active', Boolean(on));
        if (!on) {
            this._accum = 0;
            this._frames = 0;
        }
    },

    isVisible() {
        return Boolean(this._el?.classList.contains('active'));
    },

    /**
     * @param {number} dtSeconds frame delta from Time.delta
     */
    update(dtSeconds) {
        if (!this.isVisible() || !this._el) return;
        const dt = Math.max(Number(dtSeconds) || 0, 1 / 1000);
        const instant = 1 / dt;
        this._smoothed += (instant - this._smoothed) * 0.12;
        this._accum += dt;
        this._frames += 1;
        // Refresh label ~4×/s to avoid DOM thrash
        if (this._accum >= 0.25) {
            const fps = Math.round(this._smoothed);
            this._el.textContent = `${fps} FPS`;
            this._accum = 0;
            this._frames = 0;
        }
    },
};
