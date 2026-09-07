/**
 * FilmGateOverlay — film-gate chrome: frame counter + tally lamp (like the HTML demo).
 * Visible while the retro effect is active.
 */
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { RetroFilmSettings } from '../systems/RetroFilmSettings.js';
import { FILM_STRIP_WIDTH } from '../systems/RetroFilmShader.js';
import { TimeOfDaySettings } from '../systems/TimeOfDaySettings.js';
import { I18n } from '../i18n/I18n.js';

/**
 * Static lens-droplet spots (T57) — a handful of fixed positions rather than a
 * simulated trickle: this is a "someone forgot to wipe the lens" cue, not a
 * physically-accurate rain sim, so a few always-there smudges read correctly
 * without any per-frame cost.
 */
const DROPLET_SPOTS = [
    { top: '6%', left: '5%', size: 22 },
    { top: '11%', right: '8%', size: 15 },
    { bottom: '13%', left: '9%', size: 18 },
    { bottom: '8%', right: '6%', size: 27 },
    { top: '42%', left: '2.5%', size: 12 },
];

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
    /* Clears the sprocket strip via --film-strip (0% when the effect is off) */
    right: calc(var(--film-strip, 0%) + 14px);
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
    left: calc(var(--film-strip, 0%) + 14px);
    font-family: 'Yomogi', cursive;
    font-size: 10px;
    letter-spacing: 0.15em;
    /* Was a warm cream (233,221,194) — this sits in #filmGateChrome, a sibling of
       #uiLayer, so the sepia() filter fix never reached it; it needed its own
       neutral color. */
    color: rgba(200, 202, 206, 0.55);
    background: rgba(0, 0, 0, 0.35);
    padding: 2px 6px;
    border-radius: 2px;
}
/* --film-sepia tracks the live RetroFilmSettings preset (0 for noir) instead of a
   fixed value, so the HUD doesn't stay warm when the scene itself isn't. */
#gameContainer.retro-film #uiLayer,
#gameContainer.retro-film #mobileHUD {
    filter: sepia(var(--film-sepia, 0)) contrast(1.04) brightness(1.0);
}
/* Keep minimap bezel cool/metallic — don't sepia the chrome ring */
#gameContainer.retro-film #minimap {
    filter: contrast(1.04) brightness(1.02);
}
#filmLensDroplets {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.6s ease;
}
#filmLensDroplets.active {
    opacity: 1;
}
.filmDroplet {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.4), rgba(200, 212, 230, 0.14) 45%, transparent 72%);
    filter: blur(0.5px);
}
`;

export const FilmGateOverlay = {
    _root: null,
    _counter: null,
    _tally: null,
    _droplets: null,
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

        const droplets = document.createElement('div');
        droplets.id = 'filmLensDroplets';
        for (const spot of DROPLET_SPOTS) {
            const drop = document.createElement('span');
            drop.className = 'filmDroplet';
            drop.style.width = `${spot.size}px`;
            drop.style.height = `${spot.size}px`;
            if (spot.top !== undefined) drop.style.top = spot.top;
            if (spot.bottom !== undefined) drop.style.bottom = spot.bottom;
            if (spot.left !== undefined) drop.style.left = spot.left;
            if (spot.right !== undefined) drop.style.right = spot.right;
            droplets.appendChild(drop);
        }

        this._root = root;
        this._counter = counter;
        this._tally = tally;
        this._droplets = droplets;
        this._updateCounterText();

        root.appendChild(tally);
        root.appendChild(counter);
        root.appendChild(droplets);
        container.appendChild(root);

        this.sync();
        EventBus.on(EVENTS.RETRO_SETTINGS_CHANGE, () => this.sync());
        EventBus.on(EVENTS.WEATHER_CHANGE, () => this.sync());
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
            container.style.setProperty('--film-strip', this._active ? `${FILM_STRIP_WIDTH * 100}%` : '0%');
            container.style.setProperty('--film-sepia', String(RetroFilmSettings.sepia / 100));
        }
        if (this._droplets) {
            this._droplets.classList.toggle('active', this._active && TimeOfDaySettings.isRaining());
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
