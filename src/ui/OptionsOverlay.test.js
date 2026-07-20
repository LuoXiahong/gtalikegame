/**
 * Testy: OptionsOverlay
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('OptionsOverlay', () => {
    let OptionsOverlay;
    let RetroFilmSettings;
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
        EventBus.clear();
        RetroFilmSettings.reset();

        ({ OptionsOverlay } = await import('./OptionsOverlay.js'));
        OptionsOverlay.init();
    });

    afterEach(() => {
        if (EventBus) EventBus.clear();
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.localStorage;
        delete globalThis.HTMLElement;
        delete globalThis.Event;
        delete globalThis.KeyboardEvent;
        delete globalThis.requestAnimationFrame;
    });

    it('should mount backdrop and panel into the DOM', () => {
        expect(document.getElementById('optionsBackdrop')).toBeTruthy();
        expect(document.getElementById('optionsPanel')).toBeTruthy();
        expect(document.getElementById('opt_onscreen_controls')).toBeTruthy();
        expect(document.getElementById('opt_enabled')).toBeTruthy();
        expect(document.getElementById('opt_intensity')).toBeTruthy();
        expect(document.getElementById('opt_sepia')).toBeTruthy();
    });

    it('should toggle on-screen controls and emit ui_settings_change', async () => {
        const { UISettings } = await import('./UISettings.js');
        UISettings.reset();

        const spy = vi.fn();
        EventBus.on('ui_settings_change', spy);

        const toggle = document.getElementById('opt_onscreen_controls');
        expect(toggle.checked).toBe(false);

        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(UISettings.showOnScreenControls).toBe(true);
        expect(spy).toHaveBeenCalled();
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
