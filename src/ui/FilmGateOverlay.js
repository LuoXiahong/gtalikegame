/**
 * FilmGateOverlay
 * Ramka kinoskopu: licznik klatek + lampka tally (jak w demo HTML).
 * Widoczna gdy efekt retro jest aktywny.
 */
import { EventBus } from '../core/EventBus.js';
import { RetroFilmSettings } from '../systems/RetroFilmSettings.js';

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
    top: 10px;
    right: 14px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #e2703f;
    box-shadow: 0 0 8px 2px #e2703f;
    opacity: 0.85;
}
#filmFrameCounter {
    position: absolute;
    bottom: 8px;
    left: 40px;
    font-family: 'Jost', system-ui, sans-serif;
    font-size: 10px;
    letter-spacing: 0.15em;
    color: rgba(233, 221, 194, 0.55);
    background: rgba(0, 0, 0, 0.35);
    padding: 2px 6px;
    border-radius: 2px;
}
#gameContainer.retro-film #uiLayer,
#gameContainer.retro-film #mobileHUD,
#gameContainer.retro-film #minimap {
    filter: sepia(0.22) contrast(1.04) brightness(1.0);
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
        counter.textContent = 'KL. 000000';

        root.appendChild(tally);
        root.appendChild(counter);
        container.appendChild(root);

        this._root = root;
        this._counter = counter;
        this._tally = tally;

        this.sync();
        EventBus.on('retro_settings_change', () => this.sync());
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

    /** Wywołuj z pętli gry (~co klatkę renderu). */
    update(timeMs) {
        if (!this._active) return;
        const interval = 1000 / 18;
        if (timeMs - this._lastStep >= interval) {
            this._lastStep = timeMs;
            this._frame++;
            if (this._counter) {
                this._counter.textContent = 'KL. ' + String(this._frame % 1000000).padStart(6, '0');
            }
            if (this._tally) {
                const flick = 0.5 + Math.random() * 0.5;
                this._tally.style.opacity = String(0.55 + flick * 0.4);
            }
        }
    },
};
