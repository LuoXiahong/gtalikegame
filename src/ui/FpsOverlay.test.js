import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('FpsOverlay', () => {
    let FpsOverlay;
    let UISettings;
    let EventBus;
    let dom;

    beforeEach(async () => {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="gameContainer"></div></body></html>', {
            url: 'http://localhost/',
            pretendToBeVisual: true,
        });
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.localStorage = dom.window.localStorage;

        vi.resetModules();
        ({ EventBus } = await import('../core/EventBus.js'));
        EventBus.clear();
        ({ UISettings } = await import('./UISettings.js'));
        UISettings.reset();
        ({ FpsOverlay } = await import('./FpsOverlay.js'));
        // Reset module singleton state between tests
        FpsOverlay._el = null;
        FpsOverlay._smoothed = 60;
        FpsOverlay._accum = 0;
        FpsOverlay._frames = 0;
    });

    afterEach(() => {
        if (UISettings) UISettings.reset();
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.localStorage;
    });

    it('starts hidden by default', () => {
        FpsOverlay.init();
        expect(FpsOverlay.isVisible()).toBe(false);
        expect(document.getElementById('fpsOverlay').classList.contains('active')).toBe(false);
    });

    it('shows and updates label when enabled', () => {
        FpsOverlay.init();
        UISettings.setShowFps(true);
        EventBus.emit('ui_settings_change', { showFps: true });
        expect(FpsOverlay.isVisible()).toBe(true);

        // ~60fps for 0.3s worth of frames → label refresh
        for (let i = 0; i < 20; i++) {
            FpsOverlay.update(1 / 60);
        }
        expect(document.getElementById('fpsOverlay').textContent).toMatch(/\d+\s*FPS/);
    });

    it('hides when toggled off', () => {
        FpsOverlay.init();
        EventBus.emit('ui_settings_change', { showFps: true });
        EventBus.emit('ui_settings_change', { showFps: false });
        expect(FpsOverlay.isVisible()).toBe(false);
    });
});
