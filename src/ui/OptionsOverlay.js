/**
 * UI: OptionsOverlay
 * Jedno okno opcji: język, sterowanie, debug AI, efekt retro. Otwierane klawiszem O.
 */
import { RetroFilmSettings, RETRO_PARAM_KEYS } from '../systems/RetroFilmSettings.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { EventBus } from '../core/EventBus.js';
import { UISettings } from './UISettings.js';
import { I18n } from '../i18n/I18n.js';

const SLIDER_KEYS = [
    { key: 'intensity', labelKey: 'options.film.intensity', min: 0, max: 100 },
    { key: 'vignette', labelKey: 'options.film.vignette', min: 0, max: 100 },
    { key: 'flicker', labelKey: 'options.film.flicker', min: 0, max: 100 },
    { key: 'jitter', labelKey: 'options.film.jitter', min: 0, max: 100 },
    { key: 'scratches', labelKey: 'options.film.scratches', min: 0, max: 100 },
    { key: 'grain', labelKey: 'options.film.grain', min: 0, max: 100 },
    { key: 'dust', labelKey: 'options.film.dust', min: 0, max: 100 },
    { key: 'sepia', labelKey: 'options.film.sepia', min: 0, max: 100 },
    { key: 'contrast', labelKey: 'options.film.contrast', min: -50, max: 100 },
];

const PRESET_IDS = [
    { id: 'off', labelKey: 'options.preset.off' },
    { id: 'subtle', labelKey: 'options.preset.subtle' },
    { id: 'classic', labelKey: 'options.preset.classic' },
    { id: 'ruined', labelKey: 'options.preset.ruined' },
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
#opt_locale {
    width: 100%;
    font-size: 14px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(0,0,0,0.35);
    color: #e8eaf0;
    margin-bottom: 4px;
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
    _debugAIEl: null,
    _localeEl: null,
    _titleEl: null,
    _hintEl: null,
    _sectionEls: null,
    _labelEls: null,
    _presetBtns: null,
    _sliderLabelEls: null,

    init() {
        UISettings.init();
        I18n.init(UISettings.getLocale());

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const backdrop = document.createElement('div');
        backdrop.id = 'optionsBackdrop';

        const panel = document.createElement('div');
        panel.id = 'optionsPanel';

        const title = document.createElement('div');
        title.id = 'optionsTitle';
        this._titleEl = title;

        this._sectionEls = {};
        this._labelEls = {};

        // --- Language ---
        const langSection = document.createElement('div');
        langSection.className = 'options-section';
        this._sectionEls.language = langSection;

        const localeSelect = document.createElement('select');
        localeSelect.id = 'opt_locale';
        I18n.getSupportedLocales().forEach((code) => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = I18n.getLocaleLabel(code);
            localeSelect.appendChild(opt);
        });
        localeSelect.value = I18n.getLocale();
        localeSelect.addEventListener('change', () => {
            const code = localeSelect.value;
            if (UISettings.setLocale(code)) {
                I18n.setLocale(code);
            }
        });
        this._localeEl = localeSelect;

        // --- Controls ---
        const controlsSection = document.createElement('div');
        controlsSection.className = 'options-section';
        this._sectionEls.controls = controlsSection;

        const controlsToggle = document.createElement('div');
        controlsToggle.className = 'options-toggle-row';
        controlsToggle.innerHTML = `
            <label for="opt_onscreen_controls">
                <span data-i18n-label="onscreen"></span>
                <span class="options-toggle-hint" data-i18n-hint="onscreen"></span>
            </label>
            <input type="checkbox" id="opt_onscreen_controls" />
        `;
        this._onScreenControlsEl = controlsToggle.querySelector('#opt_onscreen_controls');
        this._labelEls.onscreen = controlsToggle.querySelector('[data-i18n-label="onscreen"]');
        this._labelEls.onscreenHint = controlsToggle.querySelector('[data-i18n-hint="onscreen"]');
        this._onScreenControlsEl.checked = UISettings.getOnScreenControls();
        this._onScreenControlsEl.addEventListener('change', () => {
            UISettings.setOnScreenControls(this._onScreenControlsEl.checked);
            EventBus.emit('ui_settings_change', {
                showOnScreenControls: UISettings.showOnScreenControls,
            });
        });

        // --- Dev ---
        const devSection = document.createElement('div');
        devSection.className = 'options-section';
        this._sectionEls.dev = devSection;

        const debugToggle = document.createElement('div');
        debugToggle.className = 'options-toggle-row';
        debugToggle.innerHTML = `
            <label for="opt_debug_ai">
                <span data-i18n-label="debugAI"></span>
                <span class="options-toggle-hint" data-i18n-hint="debugAI"></span>
            </label>
            <input type="checkbox" id="opt_debug_ai" />
        `;
        this._debugAIEl = debugToggle.querySelector('#opt_debug_ai');
        this._labelEls.debugAI = debugToggle.querySelector('[data-i18n-label="debugAI"]');
        this._labelEls.debugAIHint = debugToggle.querySelector('[data-i18n-hint="debugAI"]');
        this._debugAIEl.checked = Boolean(RenderSystem.debugAI);
        this._debugAIEl.addEventListener('change', () => {
            RenderSystem.debugAI = this._debugAIEl.checked;
            EventBus.emit('ui_settings_change', {
                debugAI: RenderSystem.debugAI,
            });
        });

        // --- Retro ---
        const filmSection = document.createElement('div');
        filmSection.className = 'options-section';
        this._sectionEls.film = filmSection;

        const toggleRow = document.createElement('div');
        toggleRow.className = 'options-toggle-row';
        toggleRow.innerHTML = `
            <label for="opt_enabled"><span data-i18n-label="filmEnable"></span></label>
            <input type="checkbox" id="opt_enabled" />
        `;
        this._enabledEl = toggleRow.querySelector('#opt_enabled');
        this._labelEls.filmEnable = toggleRow.querySelector('[data-i18n-label="filmEnable"]');
        this._enabledEl.checked = RetroFilmSettings.enabled;
        this._enabledEl.addEventListener('change', () => {
            RetroFilmSettings.set('enabled', this._enabledEl.checked);
            this._notifyRetro();
        });

        panel.appendChild(title);
        panel.appendChild(langSection);
        panel.appendChild(localeSelect);
        panel.appendChild(controlsSection);
        panel.appendChild(controlsToggle);
        panel.appendChild(devSection);
        panel.appendChild(debugToggle);
        panel.appendChild(filmSection);
        panel.appendChild(toggleRow);

        this._valueEls = {};
        this._rangeEls = {};
        this._sliderLabelEls = {};

        SLIDER_KEYS.forEach(({ key, labelKey, min, max }) => {
            const wrap = document.createElement('div');
            wrap.className = 'options-control';
            wrap.innerHTML = `
                <label><span data-slider-label="${key}"></span> <span class="val" id="opt_v_${key}">${RetroFilmSettings.get(key)}</span></label>
                <input type="range" id="opt_${key}" min="${min}" max="${max}" value="${RetroFilmSettings.get(key)}" />
            `;
            const range = wrap.querySelector(`#opt_${key}`);
            const valEl = wrap.querySelector(`#opt_v_${key}`);
            const labelSpan = wrap.querySelector(`[data-slider-label="${key}"]`);
            this._rangeEls[key] = range;
            this._valueEls[key] = valEl;
            this._sliderLabelEls[key] = { el: labelSpan, labelKey };
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
        this._presetBtns = [];
        PRESET_IDS.forEach(({ id, labelKey }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.preset = id;
            btn.dataset.labelKey = labelKey;
            btn.addEventListener('click', () => {
                RetroFilmSettings.applyPreset(id);
                this.syncFromSettings();
                this._notifyRetro();
            });
            presets.appendChild(btn);
            this._presetBtns.push(btn);
        });
        panel.appendChild(presets);

        const hint = document.createElement('div');
        hint.id = 'optionsHint';
        this._hintEl = hint;
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
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this._visible) {
                e.preventDefault();
                this.hide();
            }
        });

        EventBus.on('locale_change', () => this.applyLabels());
        this.applyLabels();
    },

    applyLabels() {
        if (this._titleEl) this._titleEl.textContent = I18n.t('options.title');
        if (this._hintEl) this._hintEl.textContent = I18n.t('options.closeHint');
        if (this._sectionEls.language) this._sectionEls.language.textContent = I18n.t('options.section.language');
        if (this._sectionEls.controls) this._sectionEls.controls.textContent = I18n.t('options.section.controls');
        if (this._sectionEls.dev) this._sectionEls.dev.textContent = I18n.t('options.section.dev');
        if (this._sectionEls.film) this._sectionEls.film.textContent = I18n.t('options.section.film');

        if (this._labelEls.onscreen) this._labelEls.onscreen.textContent = I18n.t('options.onscreen');
        if (this._labelEls.onscreenHint) this._labelEls.onscreenHint.textContent = I18n.t('options.onscreen.hint');
        if (this._labelEls.debugAI) this._labelEls.debugAI.textContent = I18n.t('options.debugAI');
        if (this._labelEls.debugAIHint) this._labelEls.debugAIHint.textContent = I18n.t('options.debugAI.hint');
        if (this._labelEls.filmEnable) this._labelEls.filmEnable.textContent = I18n.t('options.film.enable');

        Object.values(this._sliderLabelEls || {}).forEach(({ el, labelKey }) => {
            if (el) el.textContent = I18n.t(labelKey);
        });
        (this._presetBtns || []).forEach((btn) => {
            btn.textContent = I18n.t(btn.dataset.labelKey);
        });
        if (this._localeEl) {
            this._localeEl.value = I18n.getLocale();
        }
    },

    syncFromSettings() {
        if (this._onScreenControlsEl) {
            this._onScreenControlsEl.checked = UISettings.getOnScreenControls();
        }
        if (this._debugAIEl) {
            this._debugAIEl.checked = Boolean(RenderSystem.debugAI);
        }
        if (this._localeEl) {
            this._localeEl.value = I18n.getLocale();
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
        this.applyLabels();
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
