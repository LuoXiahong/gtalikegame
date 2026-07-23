import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenshotCapture } from './ScreenshotCapture.js';

describe('ScreenshotCapture', () => {
    beforeEach(() => {
        ScreenshotCapture._pending = false;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('request marks pending', () => {
        expect(ScreenshotCapture.isPending()).toBe(false);
        ScreenshotCapture.request();
        expect(ScreenshotCapture.isPending()).toBe(true);
    });

    it('flushFromCanvas starts download and clears pending', async () => {
        const container = document.createElement('div');
        container.id = 'gameContainer';
        Object.defineProperty(container, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
        });
        document.body.appendChild(container);

        const click = vi.fn();
        const remove = vi.fn();
        vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
            if (el.tagName === 'A') {
                el.click = click;
                el.remove = remove;
            }
            return el;
        });

        // Minimal PNG 1x1
        const png =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        const canvas = { toDataURL: vi.fn(() => png) };

        // Image loads instantly in jsdom when we stub
        vi.stubGlobal(
            'Image',
            class {
                set src(v) {
                    this._src = v;
                    queueMicrotask(() => this.onload && this.onload());
                }
                get src() {
                    return this._src;
                }
            }
        );

        const composeSpy = vi.spyOn(ScreenshotCapture, '_composeAndDownload').mockResolvedValue(undefined);

        ScreenshotCapture.request();
        expect(ScreenshotCapture.flushFromCanvas(canvas, 'test')).toBe(true);
        expect(ScreenshotCapture.isPending()).toBe(false);
        expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
        expect(composeSpy).toHaveBeenCalled();
        expect(composeSpy.mock.calls[0][1]).toBe(png);
        expect(composeSpy.mock.calls[0][2]).toBe('test');
    });

    it('flushFromCanvas is a no-op when not pending', () => {
        const canvas = { toDataURL: vi.fn(() => 'data:image/png;base64,abc') };
        expect(ScreenshotCapture.flushFromCanvas(canvas)).toBe(false);
        expect(canvas.toDataURL).not.toHaveBeenCalled();
    });

    it('flushFromCanvas clears pending even if canvas is missing', () => {
        ScreenshotCapture.request();
        expect(ScreenshotCapture.flushFromCanvas(null)).toBe(false);
        expect(ScreenshotCapture.isPending()).toBe(false);
    });

    it('_composeAndDownload draws game then downloads', async () => {
        const container = document.createElement('div');
        container.id = 'gameContainer';
        Object.defineProperty(container, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width: 100, height: 75, right: 100, bottom: 75 }),
        });
        document.body.appendChild(container);

        const png =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

        vi.stubGlobal(
            'Image',
            class {
                set src(v) {
                    this._src = v;
                    queueMicrotask(() => this.onload && this.onload());
                }
                get src() {
                    return this._src;
                }
            }
        );

        const click = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);

        const gameCanvas = document.createElement('canvas');
        await ScreenshotCapture._composeAndDownload(gameCanvas, png, 'hud');

        expect(click).toHaveBeenCalled();
        const anchors = [...document.body.querySelectorAll('a[download]')];
        // link may already be removed; click mock proves download fired
        expect(click).toHaveBeenCalledTimes(1);
    });
});
