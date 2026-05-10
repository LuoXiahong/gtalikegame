/**
 * CORE: ZARZĄDZANIE CZASEM (Time)
 */
export const Time = {
    delta: 0,
    time: 0,
    lastFrame: performance.now(),

    update(currentTime) {
        // Obliczamy różnicę czasu między klatkami w sekundach (dla płynności niezależnej od FPS)
        this.delta = (currentTime - this.lastFrame) / 1000;
        this.lastFrame = currentTime;

        // Zabezpieczenie przed zbyt dużym skokiem (np. przy powrocie do zakładki)
        if (this.delta > 0.1) this.delta = 0.1;

        this.time += this.delta;
    }
};
