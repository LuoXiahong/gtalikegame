import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('OptionsOverlay', () => {
    let OptionsOverlay;
    let RetroFilmSettings;
    let TimeOfDaySettings;
    let RenderSystem;
    let UISettings;
    let I18n;
    let EventBus;
    let dom;

    beforeEach(async () => {
        dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
            url: 'http://localhost/',
            pretendToBeVisual: true,
        });
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.localStorage = dom.window.localStorage;
        globalThis.HTMLElement = dom.window.HTMLElement;
        globalThis.Event = dom.window.Event;
        globalThis.KeyboardEvent = dom.window.KeyboardEvent;
        globalThis.requestAnimationFrame = (cb) => {
            cb();
            return 1;
        };

        vi.resetModules();
        ({ EventBus } = await import('../core/EventBus.js'));
        ({ RetroFilmSettings } = await import('../systems/RetroFilmSettings.js'));
        ({ TimeOfDaySettings } = await import('../systems/TimeOfDaySettings.js'));
        ({ RenderSystem } = await import('../systems/RenderSystem.js'));
        ({ UISettings } = await import('./UISettings.js'));
        ({ I18n } = await import('../i18n/I18n.js'));
        EventBus.clear();
        RetroFilmSettings.reset();
        TimeOfDaySettings.reset();
        UISettings.reset();
        RenderSystem.debugAI = false;
        I18n.init('pl');

        ({ OptionsOverlay } = await import('./OptionsOverlay.js'));
        OptionsOverlay.init();
    });

    afterEach(() => {
        if (EventBus) EventBus.clear();
        if (UISettings) UISettings.reset();
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.localStorage;
        delete globalThis.HTMLElement;
        delete globalThis.Event;
        delete globalThis.KeyboardEvent;
        delete globalThis.requestAnimationFrame;
    });

    it('should mount unified options: language, controls, debug, film', () => {
        expect(document.getElementById('optionsBackdrop')).toBeTruthy();
        expect(document.getElementById('optionsPanel')).toBeTruthy();
        expect(document.getElementById('opt_locale')).toBeTruthy();
        expect(document.getElementById('opt_onscreen_controls')).toBeTruthy();
        expect(document.getElementById('opt_debug_ai')).toBeTruthy();
        expect(document.getElementById('opt_enabled')).toBeTruthy();
        expect(document.getElementById('opt_intensity')).toBeTruthy();
        expect(document.getElementById('opt_sepia')).toBeTruthy();
        const locale = document.getElementById('opt_locale');
        expect([...locale.options].map((o) => o.value)).toEqual(['pl', 'en', 'de', 'es', 'fr']);
    });

    it('should toggle on-screen controls and emit ui_settings_change', () => {
        const spy = vi.fn();
        EventBus.on('ui_settings_change', spy);

        const toggle = document.getElementById('opt_onscreen_controls');
        expect(toggle.checked).toBe(false);

        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(UISettings.showOnScreenControls).toBe(true);
        expect(spy).toHaveBeenCalled();
    });

    it('should toggle AI debug mode from options', () => {
        const toggle = document.getElementById('opt_debug_ai');
        expect(toggle.checked).toBe(false);
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        expect(RenderSystem.debugAI).toBe(true);
    });

    it('should change language, persist and emit locale_change', () => {
        // OptionsOverlay.init() syncs I18n to UISettings (default en) — start from pl
        UISettings.setLocale('pl');
        I18n.setLocale('pl');
        document.getElementById('opt_locale').value = 'pl';

        const spy = vi.fn();
        EventBus.on('locale_change', spy);

        const select = document.getElementById('opt_locale');
        select.value = 'en';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(I18n.getLocale()).toBe('en');
        expect(UISettings.getLocale()).toBe('en');
        expect(document.getElementById('optionsTitle').textContent).toBe('Options');
        expect(spy).toHaveBeenCalledWith({ locale: 'en' });
    });

    it('should toggle visibility with show/hide', () => {
        expect(OptionsOverlay.isVisible()).toBe(false);
        OptionsOverlay.show();
        expect(OptionsOverlay.isVisible()).toBe(true);
        expect(document.getElementById('optionsBackdrop').classList.contains('visible')).toBe(true);
        OptionsOverlay.hide();
        expect(OptionsOverlay.isVisible()).toBe(false);
    });

    it('should update RetroFilmSettings when slider moves', () => {
        const grain = document.getElementById('opt_grain');
        grain.value = '12';
        grain.dispatchEvent(new Event('input', { bubbles: true }));
        expect(RetroFilmSettings.grain).toBe(12);
        expect(document.getElementById('opt_v_grain').textContent).toBe('12');
    });

    it('should disable effect via checkbox and emit event', () => {
        const spy = vi.fn();
        EventBus.on('retro_settings_change', spy);

        const enabled = document.getElementById('opt_enabled');
        enabled.checked = false;
        enabled.dispatchEvent(new Event('change', { bubbles: true }));

        expect(RetroFilmSettings.enabled).toBe(false);
        expect(RetroFilmSettings.isActive()).toBe(false);
        expect(spy).toHaveBeenCalled();
    });

    it('should switch time of day presets and mark active button', () => {
        const spy = vi.fn();
        EventBus.on('time_of_day_change', spy);

        const nightBtn = [...document.querySelectorAll('.options-presets button')]
            .find((b) => b.dataset.preset === 'night');
        expect(nightBtn).toBeDefined();
        nightBtn.click();

        expect(TimeOfDaySettings.current).toBe('night');
        expect(spy).toHaveBeenCalledWith('night');
        expect(nightBtn.classList.contains('active')).toBe(true);
    });

    it('should switch weather presets and mark active button', () => {
        const spy = vi.fn();
        EventBus.on('weather_change', spy);

        const rainBtn = [...document.querySelectorAll('.options-presets button')]
            .find((b) => b.dataset.weather === 'rain');
        expect(rainBtn).toBeDefined();
        rainBtn.click();

        expect(TimeOfDaySettings.weather).toBe('rain');
        expect(spy).toHaveBeenCalledWith('rain');
        expect(rainBtn.classList.contains('active')).toBe(true);
    });

    it('should apply off preset from button', () => {
        const btn = document.querySelector('[data-preset="off"]');
        expect(btn).toBeTruthy();
        btn.click();
        expect(RetroFilmSettings.enabled).toBe(false);
        expect(RetroFilmSettings.intensity).toBe(0);
        expect(document.getElementById('opt_enabled').checked).toBe(false);
        expect(document.getElementById('opt_intensity').value).toBe('0');
    });

    it('should open on KeyO', () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            code: 'KeyO',
            key: 'o',
            bubbles: true,
        }));
        expect(OptionsOverlay.isVisible()).toBe(true);
    });
});
