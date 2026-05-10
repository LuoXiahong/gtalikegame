/**
 * WORLD: Decals
 * Statyczne dekoracje podłoża (pasy, przejścia, ślady).
 */
export const Decals = {
    items: [],

    init() {
        // Przejścia dla pieszych wokół głównego skrzyżowania
        const mid = 1500;
        const roadWidth = 200;
        const offset = roadWidth / 2 + 50;

        this.items = [
            // Poziome przejścia
            { x: mid, y: mid - offset, w: 180, h: 80, type: 'crosswalk' },
            { x: mid, y: mid + offset, w: 180, h: 80, type: 'crosswalk' },
            // Pionowe przejścia
            { x: mid - offset, y: mid, w: 80, h: 180, type: 'crosswalk' },
            { x: mid + offset, y: mid, w: 80, h: 180, type: 'crosswalk' }
        ];

        // Pasy ruchu (przerywane)
        for (let y = 100; y < 3000; y += 200) {
            if (Math.abs(y - mid) > offset + 100) {
                this.items.push({ x: mid + 5, y: y, w: 4, h: 60, type: 'lane' });
            }
        }
        for (let x = 100; x < 3000; x += 200) {
            if (Math.abs(x - mid) > offset + 100) {
                this.items.push({ x: x, y: mid + 5, w: 60, h: 4, type: 'lane' });
            }
        }
    }
};
