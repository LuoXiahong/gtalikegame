/**
 * FilmGateOverlay — film-gate chrome: frame counter + tally lamp (like the HTML demo).
 * Visible while the retro effect is active.
 */
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { RetroFilmSettings } from '../systems/RetroFilmSettings.js';
import { I18n } from '../i18n/I18n.js';

const CSS = `
#filmGateChrome {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 12;
    display: none;
}
#filmGateChrome.active {
    display: block;
}
#filmTally {
    position: absolute;
    top: 14px;
    /* Clear of the sprocket strip (RetroFilmShader "strip" = 0.022 of width) — sits on the visible frame */
    right: calc(2.2% + 14px);
    width: 13px;
    height: 13px;
    border-radius: 50%;
    /* Muted ember — still reads as a tally lamp without out-saturating the scene */
    background: #8c5340;
    box-shadow: 0 0 7px 1px rgba(140, 83, 64, 0.55);
    opacity: 0.7;
}
#filmFrameCounter {
    position: absolute;
    bottom: 8px;
    left: 40px;
    font-family: 'Yomogi', cursive;
    font-size: 10px;
    letter-spacing: 0.15em;
    color: rgba(233, 221, 194, 0.55);
    background: rgba(0, 0, 0, 0.35);
    padding: 2px 6px;
    border-radius: 2px;
}
#gameContainer.retro-film #uiLayer,
#gameContainer.retro-film #mobileHUD {
    filter: sepia(0.22) contrast(1.04) brightness(1.0);
}
/* Keep minimap bezel cool/metallic — don't sepia the chrome ring */
#gameContainer.retro-film #minimap {
    filter: contrast(1.04) brightness(1.02);
}
`;

export const FilmGateOverlay = {
    _root: null,
    _counter: null,
    _tally: null,
    _frame: 0,
    _lastStep: 0,
    _active: false,

    init() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const container = document.getElementById('gameContainer');
        if (!container) return;

        const root = document.createElement('div');
        root.id = 'filmGateChrome';

        const tally = document.createElement('div');
        tally.id = 'filmTally';

        const counter = document.createElement('div');
        counter.id = 'filmFrameCounter';
        this._root = root;
        this._counter = counter;
        this._tally = tally;
        this._updateCounterText();

        root.appendChild(tally);
        root.appendChild(counter);
        container.appendChild(root);

        this.sync();
        EventBus.on(EVENTS.RETRO_SETTINGS_CHANGE, () => this.sync());
        EventBus.on(EVENTS.LOCALE_CHANGE, () => this._updateCounterText());
    },

    _updateCounterText() {
        if (!this._counter) return;
        const prefix = I18n.t('film.frame');
        this._counter.textContent = `${prefix} ${String(this._frame % 1000000).padStart(6, '0')}`;
    },

    sync() {
        this._active = RetroFilmSettings.isActive();
        if (this._root) {
            this._root.classList.toggle('active', this._active);
        }
        const container = document.getElementById('gameContainer');
        if (container) {
            container.classList.toggle('retro-film', this._active);
        }
    },

    /** Call from the game loop (~once per render frame). */
    update(timeMs) {
        if (!this._active) return;
        const interval = 1000 / 18;
        if (timeMs - this._lastStep >= interval) {
            this._lastStep = timeMs;
            this._frame++;
            this._updateCounterText();
            if (this._tally) {
                const flick = 0.5 + Math.random() * 0.5;
                this._tally.style.opacity = String(0.55 + flick * 0.4);
            }
        }
    },
};
