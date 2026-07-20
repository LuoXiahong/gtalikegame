/**
 * Testy: I18n
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('I18n', () => {
    let I18n;
    let EventBus;
    let dom;

    beforeEach(async () => {
        dom = new JSDOM('<!DOCTYPE html><html lang="pl"><body></body></html>', {
            url: 'http://localhost/',
        });
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;

        vi.resetModules();
        ({ EventBus } = await import('../core/EventBus.js'));
        EventBus.clear();
        ({ I18n } = await import('./I18n.js'));
        I18n.init('pl');
    });

    afterEach(() => {
        if (EventBus) EventBus.clear();
        delete globalThis.window;
        delete globalThis.document;
    });

    it('defaults to Polish and translates keys', () => {
        expect(I18n.getLocale()).toBe('pl');
        expect(I18n.t('options.title')).toBe('Opcje');
        expect(I18n.t('mission.findNpc')).toBe('Misja: Znajdź NPC');
    });

    it('interpolates placeholders', () => {
        expect(I18n.t('mission.goToCarTimed', { s: 12 })).toBe('Misja: Idź do auta (12s)');
    });

    it('switches locale and emits locale_change', () => {
        const spy = vi.fn();
        EventBus.on('locale_change', spy);

        expect(I18n.setLocale('en')).toBe(true);
        expect(I18n.getLocale()).toBe('en');
        expect(I18n.t('options.title')).toBe('Options');
        expect(document.documentElement.lang).toBe('en');
        expect(spy).toHaveBeenCalledWith({ locale: 'en' });
    });

    it('rejects unsupported locales and no-ops on same locale', () => {
        expect(I18n.setLocale('xx')).toBe(false);
        expect(I18n.setLocale('pl')).toBe(false);
        expect(I18n.getLocale()).toBe('pl');
    });

    it('exposes five supported locales with native names', () => {
        const locales = I18n.getSupportedLocales();
        expect(locales).toEqual(['pl', 'en', 'de', 'es', 'fr']);
        expect(I18n.getLocaleLabel('de')).toBe('Deutsch');
    });

    it('falls back to key when missing', () => {
        expect(I18n.t('missing.key.xyz')).toBe('missing.key.xyz');
    });
});
