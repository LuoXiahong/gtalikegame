/**
 * Testy: UISettings
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('UISettings', () => {
    let UISettings;
    let dom;

    beforeEach(async () => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'http://localhost/',
            pretendToBeVisual: true,
        });
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.localStorage = dom.window.localStorage;
        globalThis.navigator = dom.window.navigator;

        vi.resetModules();
        ({ UISettings } = await import('./UISettings.js'));
        UISettings.reset();
    });

    afterEach(() => {
        if (UISettings) UISettings.reset();
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.localStorage;
        delete globalThis.navigator;
    });

    it('defaults to hidden on desktop (fine pointer, no coarse)', () => {
        expect(UISettings.showOnScreenControls).toBe(false);
    });

    it('persists explicit on/off override', () => {
        UISettings.setOnScreenControls(true);
        expect(UISettings.showOnScreenControls).toBe(true);
        expect(JSON.parse(localStorage.getItem('gtalike_ui_settings')).onScreenControls).toBe(true);

        UISettings.setOnScreenControls(false);
        expect(UISettings.showOnScreenControls).toBe(false);
    });

    it('reloads override from localStorage on init', async () => {
        localStorage.setItem('gtalike_ui_settings', JSON.stringify({ onScreenControls: true }));
        vi.resetModules();
        ({ UISettings } = await import('./UISettings.js'));
        UISettings.init();
        expect(UISettings.showOnScreenControls).toBe(true);
    });

    it('persists and reloads locale', async () => {
        expect(UISettings.getLocale()).toBe('pl');
        expect(UISettings.setLocale('de')).toBe(true);
        expect(UISettings.getLocale()).toBe('de');
        expect(JSON.parse(localStorage.getItem('gtalike_ui_settings')).locale).toBe('de');

        vi.resetModules();
        ({ UISettings } = await import('./UISettings.js'));
        UISettings.init();
        expect(UISettings.getLocale()).toBe('de');
    });

    it('rejects unsupported locale codes', () => {
        expect(UISettings.setLocale('xx')).toBe(false);
        expect(UISettings.getLocale()).toBe('pl');
    });
});
