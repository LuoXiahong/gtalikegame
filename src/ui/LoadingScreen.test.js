import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('LoadingScreen', () => {
    let LoadingScreen;
    let dom;

    beforeEach(async () => {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="gameContainer"></div></body></html>', {
            url: 'http://localhost/',
        });
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;

        vi.resetModules();
        ({ LoadingScreen } = await import('./LoadingScreen.js'));
        LoadingScreen._el = null;
        LoadingScreen._fillEl = null;
        LoadingScreen._percentEl = null;
    });

    afterEach(() => {
        delete globalThis.window;
        delete globalThis.document;
    });

    it('starts hidden and shows the translated loading label', () => {
        LoadingScreen.init();
        expect(LoadingScreen.isVisible()).toBe(false);
        expect(document.getElementById('loadingScreen').textContent).toContain('LOADING');
    });

    it('becomes visible on show() and reflects progress in the bar and label', () => {
        LoadingScreen.init();
        LoadingScreen.show();
        expect(LoadingScreen.isVisible()).toBe(true);

        LoadingScreen.setProgress(0.5);
        const fill = document.querySelector('#loadingScreen .loadingFill');
        const percent = document.querySelector('#loadingScreen .loadingPercent');
        expect(fill.style.width).toBe('50%');
        expect(percent.textContent).toBe('50%');
    });

    it('clamps progress to [0, 1]', () => {
        LoadingScreen.init();
        LoadingScreen.setProgress(2);
        expect(document.querySelector('#loadingScreen .loadingFill').style.width).toBe('100%');

        LoadingScreen.setProgress(-1);
        expect(document.querySelector('#loadingScreen .loadingFill').style.width).toBe('0%');
    });

    it('hides on hide()', () => {
        LoadingScreen.init();
        LoadingScreen.show();
        LoadingScreen.hide();
        expect(LoadingScreen.isVisible()).toBe(false);
    });

    it('is idempotent across repeated init() calls', () => {
        LoadingScreen.init();
        LoadingScreen.init();
        expect(document.querySelectorAll('#loadingScreen').length).toBe(1);
    });
});
