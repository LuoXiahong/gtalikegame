/**
 * WORLD: Waypoints
 * Sieć punktów definiujących ścieżki ruchu ulicznego.
 */
export const Waypoints = {
    paths: {
        // Pionowe (Północ-Południe)
        NORTH_SOUTH: [
            { x: 1550, y: 0 },
            { x: 1550, y: 3000 }
        ],
        SOUTH_NORTH: [
            { x: 1450, y: 3000 },
            { x: 1450, y: 0 }
        ],
        // Poziome (Zachód-Wschód)
        WEST_EAST: [
            { x: 0, y: 1550 },
            { x: 3000, y: 1550 }
        ],
        EAST_WEST: [
            { x: 3000, y: 1450 },
            { x: 0, y: 1450 }
        ]
    }
};
