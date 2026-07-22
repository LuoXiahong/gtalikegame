/**
 * OptionsOverlay — language, controls, AI debug, time of day, retro film (open with O).
 * Game-menu layout: wide panel + tabs (General / World / Film).
 */
import { RetroFilmSettings, RETRO_PARAM_KEYS } from '../systems/RetroFilmSettings.js';
import { TimeOfDaySettings } from '../systems/TimeOfDaySettings.js';
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

const TIME_PRESET_IDS = [
    { id: 'day', labelKey: 'options.time.day' },
    { id: 'dusk', labelKey: 'options.time.dusk' },
    { id: 'night', labelKey: 'options.time.night' },
];

const WEATHER_PRESET_IDS = [
    { id: 'clear', labelKey: 'options.weather.clear' },
    { id: 'rain', labelKey: 'options.weather.rain' },
];

const TAB_IDS = [
    { id: 'general', labelKey: 'options.tab.general' },
    { id: 'world', labelKey: 'options.tab.world' },
    { id: 'film', labelKey: 'options.tab.film' },
];

const CSS = `
#optionsBackdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9100;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s ease;
}
#optionsBackdrop.visible {
    opacity: 1;
    pointer-events: all;
}
#optionsPanel {
    background: #0c0e14;
    border: 3px solid #c9a45c;
    box-shadow:
        0 0 0 2px #1a1408,
        0 18px 0 rgba(0, 0, 0, 0.55),
        inset 0 0 0 1px rgba(255, 220, 140, 0.12);
    padding: 0;
    width: min(720px, 94vw);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    transform: scale(0.96) translateY(10px);
    transition: transform 0.18s ease;
    font-family: 'Yomogi', cursive;
    color: #f0e6d2;
}
#optionsBackdrop.visible #optionsPanel {
    transform: scale(1) translateY(0);
}
#optionsHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px 10px;
    background: linear-gradient(180deg, #1a1520 0%, #0c0e14 100%);
    border-bottom: 2px solid rgba(201, 164, 92, 0.45);
}
#optionsTitle {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #f5e6c8;
    margin: 0;
    text-shadow: 2px 2px 0 #000;
}
#optionsTabs {
    display: flex;
    gap: 6px;
    padding: 10px 14px 0;
    background: #080a10;
    border-bottom: 2px solid rgba(201, 164, 92, 0.35);
}
.options-tab {
    flex: 1;
    font-family: inherit;
    font-size: 14px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 10px 8px 12px;
    border: 2px solid rgba(201, 164, 92, 0.35);
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    background: #12151e;
    color: rgba(240, 230, 210, 0.45);
    cursor: pointer;
    text-shadow: 1px 1px 0 #000;
}
.options-tab:hover {
    color: #f5e6c8;
    border-color: rgba(201, 164, 92, 0.7);
}
.options-tab.active {
    background: #0c0e14;
    color: #f5e6c8;
    border-color: #c9a45c;
    box-shadow: inset 0 -2px 0 #0c0e14;
    position: relative;
    z-index: 1;
    margin-bottom: -2px;
}
#optionsBody {
    padding: 18px 20px 12px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}
.options-pane {
    display: none;
}
.options-pane.active {
    display: block;
}
.options-section {
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #c9a45c;
    margin: 16px 0 10px 0;
    text-shadow: 1px 1px 0 #000;
}
.options-section:first-child {
    margin-top: 0;
}
.options-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.08);
}
.options-toggle-row label {
    font-size: 15px;
    color: #f0e6d2;
    line-height: 1.35;
    cursor: pointer;
}
.options-toggle-hint {
    display: block;
    font-size: 12px;
    font-weight: 400;
    color: rgba(240, 230, 210, 0.4);
    margin-top: 3px;
    letter-spacing: 0.02em;
}
.options-toggle-row input[type=checkbox] {
    appearance: none;
    -webkit-appearance: none;
    width: 52px;
    height: 28px;
    flex-shrink: 0;
    border: 2px solid #c9a45c;
    background: #1a1408;
    position: relative;
    cursor: pointer;
    box-shadow: inset 0 2px 0 rgba(0,0,0,0.45);
}
.options-toggle-row input[type=checkbox]::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #6a5a3a;
    transition: left 0.12s ease, background 0.12s ease;
}
.options-toggle-row input[type=checkbox]:checked {
    background: #3a2e14;
}
.options-toggle-row input[type=checkbox]:checked::after {
    left: 26px;
    background: #e0b978;
}
.options-control {
    margin-bottom: 14px;
}
.options-control label {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    color: rgba(240, 230, 210, 0.85);
    margin-bottom: 6px;
}
.options-control .val {
    color: #e0b978;
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: right;
    text-shadow: 1px 1px 0 #000;
}
.options-control input[type=range] {
    width: 100%;
    height: 10px;
    appearance: none;
    -webkit-appearance: none;
    background: #1a1408;
    border: 2px solid rgba(201, 164, 92, 0.55);
    outline: none;
}
.options-control input[type=range]::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 22px;
    background: #e0b978;
    border: 2px solid #1a1408;
    cursor: pointer;
    box-shadow: 2px 2px 0 #000;
}
.options-control input[type=range]::-moz-range-thumb {
    width: 18px;
    height: 22px;
    background: #e0b978;
    border: 2px solid #1a1408;
    cursor: pointer;
    box-shadow: 2px 2px 0 #000;
}
.options-presets {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 8px;
    margin-top: 4px;
}
.options-presets button {
    font-family: inherit;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 12px 8px;
    border: 2px solid rgba(201, 164, 92, 0.5);
    background: #141820;
    color: #f0e6d2;
    cursor: pointer;
    text-shadow: 1px 1px 0 #000;
}
.options-presets button:hover {
    border-color: #e0b978;
    color: #e0b978;
    background: #1a1520;
}
.options-presets button.active {
    background: #3a2e14;
    border-color: #e0b978;
    color: #f5e6c8;
    box-shadow: inset 0 0 0 1px rgba(224, 185, 120, 0.35);
}
#opt_locale {
    width: 100%;
    font-family: inherit;
    font-size: 15px;
    padding: 12px 14px;
    border: 2px solid rgba(201, 164, 92, 0.55);
    background: #141820;
    color: #f0e6d2;
    margin-bottom: 4px;
    cursor: pointer;
}
#opt_locale:focus {
    outline: none;
    border-color: #e0b978;
}
#optionsHint {
    margin: 0;
    padding: 12px 18px 14px;
    text-align: center;
    font-size: 13px;
    letter-spacing: 0.06em;
    color: rgba(240, 230, 210, 0.35);
    border-top: 2px solid rgba(201, 164, 92, 0.25);
    background: #080a10;
}
`;

export const OptionsOverlay = {
    _backdrop: null,
    _visible: false,
    _activeTab: 'general',
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
    _tabBtns: null,
    _panes: null,
    _presetBtns: null,
    _timePresetBtns: null,
    _weatherPresetBtns: null,
    _sliderLabelEls: null,

    init() {
        UISettings.init();
        RetroFilmSettings.init();
        TimeOfDaySettings.init();
        I18n.init(UISettings.getLocale());

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const backdrop = document.createElement('div');
        backdrop.id = 'optionsBackdrop';

        const panel = document.createElement('div');
        panel.id = 'optionsPanel';

        const header = document.createElement('div');
        header.id = 'optionsHeader';

        const title = document.createElement('div');
        title.id = 'optionsTitle';
        this._titleEl = title;
        header.appendChild(title);

        const tabsBar = document.createElement('div');
        tabsBar.id = 'optionsTabs';
        this._tabBtns = [];
        TAB_IDS.forEach(({ id, labelKey }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'options-tab' + (id === this._activeTab ? ' active' : '');
            btn.dataset.tab = id;
            btn.dataset.labelKey = labelKey;
            btn.addEventListener('click', () => this.setTab(id));
            tabsBar.appendChild(btn);
            this._tabBtns.push(btn);
        });

        const body = document.createElement('div');
        body.id = 'optionsBody';

        this._sectionEls = {};
        this._labelEls = {};
        this._panes = {};

        // --- Tab: General ---
        const generalPane = document.createElement('div');
        generalPane.className = 'options-pane active';
        generalPane.dataset.pane = 'general';
        this._panes.general = generalPane;

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
            UISettings.setDebugAI(this._debugAIEl.checked);
            EventBus.emit('ui_settings_change', {
                debugAI: RenderSystem.debugAI,
            });
        });

        generalPane.appendChild(langSection);
        generalPane.appendChild(localeSelect);
        generalPane.appendChild(controlsSection);
        generalPane.appendChild(controlsToggle);
        generalPane.appendChild(devSection);
        generalPane.appendChild(debugToggle);

        // --- Tab: World ---
        const worldPane = document.createElement('div');
        worldPane.className = 'options-pane';
        worldPane.dataset.pane = 'world';
        this._panes.world = worldPane;

        const timeSection = document.createElement('div');
        timeSection.className = 'options-section';
        this._sectionEls.time = timeSection;

        const timePresets = document.createElement('div');
        timePresets.className = 'options-presets';
        this._timePresetBtns = [];
        TIME_PRESET_IDS.forEach(({ id, labelKey }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.preset = id;
            btn.dataset.labelKey = labelKey;
            btn.addEventListener('click', () => {
                TimeOfDaySettings.applyPreset(id);
                this._syncTimePresetButtons();
            });
            timePresets.appendChild(btn);
            this._timePresetBtns.push(btn);
        });

        const weatherSection = document.createElement('div');
        weatherSection.className = 'options-section';
        this._sectionEls.weather = weatherSection;

        const weatherPresets = document.createElement('div');
        weatherPresets.className = 'options-presets';
        this._weatherPresetBtns = [];
        WEATHER_PRESET_IDS.forEach(({ id, labelKey }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.weather = id;
            btn.dataset.labelKey = labelKey;
            btn.addEventListener('click', () => {
                TimeOfDaySettings.applyWeather(id);
                this._syncWeatherPresetButtons();
            });
            weatherPresets.appendChild(btn);
            this._weatherPresetBtns.push(btn);
        });

        worldPane.appendChild(timeSection);
        worldPane.appendChild(timePresets);
        worldPane.appendChild(weatherSection);
        worldPane.appendChild(weatherPresets);

        // --- Tab: Film ---
        const filmPane = document.createElement('div');
        filmPane.className = 'options-pane';
        filmPane.dataset.pane = 'film';
        this._panes.film = filmPane;

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

        filmPane.appendChild(filmSection);
        filmPane.appendChild(toggleRow);

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
            filmPane.appendChild(wrap);
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
        filmPane.appendChild(presets);

        body.appendChild(generalPane);
        body.appendChild(worldPane);
        body.appendChild(filmPane);

        const hint = document.createElement('div');
        hint.id = 'optionsHint';
        this._hintEl = hint;

        panel.appendChild(header);
        panel.appendChild(tabsBar);
        panel.appendChild(body);
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

    setTab(tabId) {
        if (!this._panes[tabId]) return;
        this._activeTab = tabId;
        Object.entries(this._panes).forEach(([id, pane]) => {
            pane.classList.toggle('active', id === tabId);
        });
        (this._tabBtns || []).forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
    },

    applyLabels() {
        if (this._titleEl) this._titleEl.textContent = I18n.t('options.title');
        if (this._hintEl) this._hintEl.textContent = I18n.t('options.closeHint');
        if (this._sectionEls.language) this._sectionEls.language.textContent = I18n.t('options.section.language');
        if (this._sectionEls.controls) this._sectionEls.controls.textContent = I18n.t('options.section.controls');
        if (this._sectionEls.dev) this._sectionEls.dev.textContent = I18n.t('options.section.dev');
        if (this._sectionEls.time) this._sectionEls.time.textContent = I18n.t('options.time.title');
        if (this._sectionEls.weather) this._sectionEls.weather.textContent = I18n.t('options.weather.title');
        if (this._sectionEls.film) this._sectionEls.film.textContent = I18n.t('options.section.film');

        (this._tabBtns || []).forEach((btn) => {
            btn.textContent = I18n.t(btn.dataset.labelKey);
        });

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
        (this._timePresetBtns || []).forEach((btn) => {
            btn.textContent = I18n.t(btn.dataset.labelKey);
        });
        (this._weatherPresetBtns || []).forEach((btn) => {
            btn.textContent = I18n.t(btn.dataset.labelKey);
        });
        this._syncTimePresetButtons();
        this._syncWeatherPresetButtons();
        if (this._localeEl) {
            this._localeEl.value = I18n.getLocale();
        }
    },

    _syncTimePresetButtons() {
        (this._timePresetBtns || []).forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.preset === TimeOfDaySettings.current);
        });
    },

    _syncWeatherPresetButtons() {
        (this._weatherPresetBtns || []).forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.weather === TimeOfDaySettings.weather);
        });
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
