/**
 * UI: OptionsOverlay
 * Panel opcji (sterowanie + efekt retro). Otwierany klawiszem O.
 */
import { RetroFilmSettings, RETRO_PARAM_KEYS } from '../systems/RetroFilmSettings.js';
import { EventBus } from '../core/EventBus.js';
import { UISettings } from './UISettings.js';

const SLIDERS = [
    { key: 'intensity', label: 'Intensywność', min: 0, max: 100 },
    { key: 'vignette', label: 'Winietowanie', min: 0, max: 100 },
    { key: 'flicker', label: 'Migotanie', min: 0, max: 100 },
    { key: 'jitter', label: 'Drganie klatki', min: 0, max: 100 },
    { key: 'scratches', label: 'Rysy / paski', min: 0, max: 100 },
    { key: 'grain', label: 'Ziarno', min: 0, max: 100 },
    { key: 'dust', label: 'Włókna (bez płatków)', min: 0, max: 100 },
    { key: 'sepia', label: 'Sepia', min: 0, max: 100 },
    { key: 'contrast', label: 'Kontrast', min: -50, max: 100 },
];

const PRESETS = [
    { id: 'off', label: 'Wyłączony' },
    { id: 'subtle', label: 'Subtelny' },
    { id: 'classic', label: 'Klasyczny' },
    { id: 'ruined', label: 'Zniszczona taśma' },
];

const CSS = `
#optionsBackdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9100;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.22s ease;
}
#optionsBackdrop.visible {
    opacity: 1;
    pointer-events: all;
}
#optionsPanel {
    background: rgba(15, 17, 25, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
    padding: 24px 28px 28px;
    width: min(420px, 92vw);
    max-height: 88vh;
    overflow-y: auto;
    transform: scale(0.92) translateY(12px);
    transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    font-family: system-ui, -apple-system, sans-serif;
    color: #e8eaf0;
}
#optionsBackdrop.visible #optionsPanel {
    transform: scale(1) translateY(0);
}
#optionsTitle {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
    margin: 0 0 16px 0;
}
#optionsTitle::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, #e0b978, #b8925a);
    margin-right: 8px;
    vertical-align: middle;
}
.options-section {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin: 18px 0 10px 0;
}
.options-section:first-of-type {
    margin-top: 0;
}
.options-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.options-toggle-row label {
    font-size: 14px;
    color: rgba(255,255,255,0.85);
    line-height: 1.35;
}
.options-toggle-hint {
    display: block;
    font-size: 11px;
    font-weight: 400;
    color: rgba(255,255,255,0.35);
    margin-top: 2px;
}
.options-control {
    margin-bottom: 12px;
}
.options-control label {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: rgba(255,255,255,0.75);
    margin-bottom: 4px;
}
.options-control .val {
    color: #e0b978;
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
}
.options-control input[type=range] {
    width: 100%;
    accent-color: #b8925a;
}
.options-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
}
.options-presets button {
    flex: 1;
    min-width: 90px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 8px 6px;
    border-radius: 6px;
    border: 1px solid rgba(184,146,90,0.45);
    background: rgba(255,255,255,0.05);
    color: #e8eaf0;
    cursor: pointer;
}
.options-presets button:hover {
    border-color: #e0b978;
    color: #e0b978;
}
#optionsHint {
    margin-top: 16px;
    text-align: center;
    font-size: 12px;
    color: rgba(255,255,255,0.3);
}
`;

export const OptionsOverlay = {
    _backdrop: null,
    _visible: false,
    _valueEls: null,
    _rangeEls: null,
    _enabledEl: null,
    _onScreenControlsEl: null,

    init() {
        UISettings.init();

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const backdrop = document.createElement('div');
        backdrop.id = 'optionsBackdrop';

        const panel = document.createElement('div');
        panel.id = 'optionsPanel';

        const title = document.createElement('div');
        title.id = 'optionsTitle';
        title.textContent = 'Opcje';

        // --- Sterowanie ---
        const controlsSection = document.createElement('div');
        controlsSection.className = 'options-section';
        controlsSection.textContent = 'Sterowanie';

        const controlsToggle = document.createElement('div');
        controlsToggle.className = 'options-toggle-row';
        controlsToggle.innerHTML = `
            <label for="opt_onscreen_controls">
                Przyciski WASD / F na ekranie
                <span class="options-toggle-hint">Domyślnie wyłączone na desktopie</span>
            </label>
            <input type="checkbox" id="opt_onscreen_controls" />
        `;
        this._onScreenControlsEl = controlsToggle.querySelector('#opt_onscreen_controls');
        this._onScreenControlsEl.checked = UISettings.getOnScreenControls();
        this._onScreenControlsEl.addEventListener('change', () => {
            UISettings.setOnScreenControls(this._onScreenControlsEl.checked);
            EventBus.emit('ui_settings_change', {
                showOnScreenControls: UISettings.showOnScreenControls,
            });
        });

        // --- Retro ---
        const filmSection = document.createElement('div');
        filmSection.className = 'options-section';
        filmSection.textContent = 'Efekt taśmy filmowej';

        const toggleRow = document.createElement('div');
        toggleRow.className = 'options-toggle-row';
        toggleRow.innerHTML = `
            <label for="opt_enabled">Włącz efekt</label>
            <input type="checkbox" id="opt_enabled" />
        `;
        this._enabledEl = toggleRow.querySelector('#opt_enabled');
        this._enabledEl.checked = RetroFilmSettings.enabled;
        this._enabledEl.addEventListener('change', () => {
            RetroFilmSettings.set('enabled', this._enabledEl.checked);
            this._notifyRetro();
        });

        panel.appendChild(title);
        panel.appendChild(controlsSection);
        panel.appendChild(controlsToggle);
        panel.appendChild(filmSection);
        panel.appendChild(toggleRow);

        this._valueEls = {};
        this._rangeEls = {};

        SLIDERS.forEach(({ key, label, min, max }) => {
            const wrap = document.createElement('div');
            wrap.className = 'options-control';
            wrap.innerHTML = `
                <label>${label} <span class="val" id="opt_v_${key}">${RetroFilmSettings.get(key)}</span></label>
                <input type="range" id="opt_${key}" min="${min}" max="${max}" value="${RetroFilmSettings.get(key)}" />
            `;
            const range = wrap.querySelector(`#opt_${key}`);
            const valEl = wrap.querySelector(`#opt_v_${key}`);
            this._rangeEls[key] = range;
            this._valueEls[key] = valEl;
            range.addEventListener('input', () => {
                RetroFilmSettings.set(key, range.value);
                valEl.textContent = String(RetroFilmSettings.get(key));
                if (key === 'intensity' && Number(range.value) === 0) {
                    RetroFilmSettings.set('enabled', false);
                    this._enabledEl.checked = false;
                } else if (key === 'intensity' && Number(range.value) > 0 && !RetroFilmSettings.enabled) {
                    RetroFilmSettings.set('enabled', true);
                    this._enabledEl.checked = true;
                }
                this._notifyRetro();
            });
            panel.appendChild(wrap);
        });

        const presets = document.createElement('div');
        presets.className = 'options-presets';
        PRESETS.forEach(({ id, label }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.dataset.preset = id;
            btn.addEventListener('click', () => {
                RetroFilmSettings.applyPreset(id);
                this.syncFromSettings();
                this._notifyRetro();
            });
            presets.appendChild(btn);
        });
        panel.appendChild(presets);

        const hint = document.createElement('div');
        hint.id = 'optionsHint';
        hint.textContent = 'Naciśnij O lub Esc aby zamknąć';
        panel.appendChild(hint);

        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);
        this._backdrop = backdrop;

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this.hide();
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyO' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const tag = (e.target && e.target.tagName) || '';
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this._visible) {
                e.preventDefault();
                this.hide();
            }
        });
    },

    syncFromSettings() {
        if (this._onScreenControlsEl) {
            this._onScreenControlsEl.checked = UISettings.getOnScreenControls();
        }
        if (this._enabledEl) {
            this._enabledEl.checked = RetroFilmSettings.enabled;
        }
        RETRO_PARAM_KEYS.forEach((key) => {
            const v = RetroFilmSettings.get(key);
            if (this._rangeEls[key]) this._rangeEls[key].value = String(v);
            if (this._valueEls[key]) this._valueEls[key].textContent = String(v);
        });
    },

    _notifyRetro() {
        EventBus.emit('retro_settings_change', RetroFilmSettings.toJSON());
    },

    show() {
        if (this._visible) return;
        this.syncFromSettings();
        this._visible = true;
        requestAnimationFrame(() => {
            this._backdrop.classList.add('visible');
        });
    },

    hide() {
        if (!this._visible) return;
        this._visible = false;
        this._backdrop.classList.remove('visible');
    },

    toggle() {
        if (this._visible) this.hide();
        else this.show();
    },

    isVisible() {
        return this._visible;
    },
};
