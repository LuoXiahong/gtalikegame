/**
 * Frame timing (delta in seconds, FPS-independent).
 */
export const Time = {
    delta: 0,
    time: 0,
    lastFrame: performance.now(),

    update(currentTime) {
        // Seconds between frames (gameplay independent of FPS)
        this.delta = (currentTime - this.lastFrame) / 1000;
        this.lastFrame = currentTime;

        // Cap spike after tab background / resume
        if (this.delta > 0.1) this.delta = 0.1;

        this.time += this.delta;
    }
};
