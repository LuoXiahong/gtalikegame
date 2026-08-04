/**
 * AssetLoader — runs asset/config boot tasks in parallel, reports progress,
 * and (optionally) enforces a minimum wall-clock display time for the
 * loading screen so fast loads don't flash by unnoticed.
 */
export const AssetLoader = {
    MIN_DISPLAY_MS: 1500,
    TASK_TIMEOUT_MS: 5000,

    /**
     * @param {Array<Function|{run: Function}>} tasks
     * @param {(done: number, total: number) => void} [onProgress]
     */
    async load(tasks, onProgress) {
        const total = tasks.length;
        let done = 0;
        if (onProgress) onProgress(done, total);

        await Promise.all(tasks.map((task) =>
            this._runTask(task).finally(() => {
                done += 1;
                if (onProgress) onProgress(done, total);
            })
        ));
    },

    /**
     * Same as `load`, but pads the total wall-clock time up to `minMs` so
     * the loading screen stays visible for at least that long.
     */
    async loadWithMinDelay(tasks, onProgress, minMs = this.MIN_DISPLAY_MS) {
        const start = Date.now();
        await this.load(tasks, onProgress);
        const remaining = minMs - (Date.now() - start);
        if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
        }
    },

    // A stuck/slow task (e.g. a network image that never fires onload)
    // must not block boot forever — fall back to "done" after a timeout.
    _runTask(task) {
        const run = typeof task === 'function' ? task : task.run;
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, this.TASK_TIMEOUT_MS);
            Promise.resolve().then(run).then(
                () => { clearTimeout(timer); resolve(); },
                () => { clearTimeout(timer); resolve(); }
            );
        });
    },

    loadImage(src) {
        return new Promise((resolve) => {
            if (typeof Image === 'undefined') { resolve(); return; }
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
        });
    },

    loadFont(fontSpec) {
        if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function') {
            return Promise.resolve();
        }
        return document.fonts.load(fontSpec).catch(() => {});
    }
};
