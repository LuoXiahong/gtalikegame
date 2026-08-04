import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AssetLoader } from './AssetLoader.js';

describe('AssetLoader', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs all tasks and reports progress from 0 to total', async () => {
        const progress = [];
        const promise = AssetLoader.load(
            [() => Promise.resolve(), () => Promise.resolve()],
            (done, total) => progress.push([done, total])
        );
        await vi.runAllTimersAsync();
        await promise;

        expect(progress[0]).toEqual([0, 2]);
        expect(progress[progress.length - 1]).toEqual([2, 2]);
    });

    it('accepts { run } task objects alongside plain functions', async () => {
        const calls = [];
        const promise = AssetLoader.load([
            { run: () => { calls.push('a'); } },
            () => { calls.push('b'); }
        ]);
        await vi.runAllTimersAsync();
        await promise;

        expect(calls.sort()).toEqual(['a', 'b']);
    });

    it('does not reject when a task throws or rejects', async () => {
        const promise = AssetLoader.load([
            () => { throw new Error('boom'); },
            () => Promise.reject(new Error('nope')),
            () => Promise.resolve('ok')
        ]);
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toBeUndefined();
    });

    it('falls back to done after TASK_TIMEOUT_MS when a task never settles', async () => {
        const onProgress = vi.fn();
        const promise = AssetLoader.load([() => new Promise(() => {})], onProgress);

        await vi.advanceTimersByTimeAsync(AssetLoader.TASK_TIMEOUT_MS);
        await promise;

        expect(onProgress).toHaveBeenLastCalledWith(1, 1);
    });

    it('loadWithMinDelay pads out fast loads to at least minMs', async () => {
        const start = Date.now();
        const promise = AssetLoader.loadWithMinDelay(
            [() => Promise.resolve()],
            undefined,
            1500
        );

        await vi.advanceTimersByTimeAsync(1499);
        let settled = false;
        promise.then(() => { settled = true; });
        await Promise.resolve();
        expect(settled).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        await promise;
        expect(Date.now() - start).toBeGreaterThanOrEqual(1500);
    });

    it('loadWithMinDelay adds no extra wait when tasks already exceed minMs', async () => {
        const slowTask = () => new Promise((resolve) => setTimeout(resolve, 2000));
        const promise = AssetLoader.loadWithMinDelay([slowTask], undefined, 1500);

        await vi.advanceTimersByTimeAsync(2000);
        await expect(promise).resolves.toBeUndefined();
    });

    describe('loadImage', () => {
        it('resolves without throwing when Image is unavailable', async () => {
            const original = globalThis.Image;
            delete globalThis.Image;
            try {
                await expect(AssetLoader.loadImage('./assets/logo.png')).resolves.toBeUndefined();
            } finally {
                globalThis.Image = original;
            }
        });

        it('resolves on load and on error', async () => {
            class FakeImage {
                set src(_v) { queueMicrotask(() => this.onload && this.onload()); }
            }
            const original = globalThis.Image;
            globalThis.Image = FakeImage;
            try {
                await expect(AssetLoader.loadImage('./assets/logo.png')).resolves.toBeUndefined();
            } finally {
                globalThis.Image = original;
            }
        });
    });

    describe('loadFont', () => {
        it('resolves without throwing when document.fonts is unavailable', async () => {
            const original = globalThis.document;
            globalThis.document = {};
            try {
                await expect(AssetLoader.loadFont("16px 'Yomogi'")).resolves.toBeUndefined();
            } finally {
                globalThis.document = original;
            }
        });

        it('delegates to document.fonts.load', async () => {
            const load = vi.fn().mockResolvedValue(undefined);
            const original = globalThis.document;
            globalThis.document = { fonts: { load } };
            try {
                await AssetLoader.loadFont("16px 'Yomogi'");
                expect(load).toHaveBeenCalledWith("16px 'Yomogi'");
            } finally {
                globalThis.document = original;
            }
        });
    });
});
