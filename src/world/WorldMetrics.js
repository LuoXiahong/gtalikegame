/**
 * WORLD: WorldMetrics
 * Definiuje stałe fizyczne oraz przeliczniki skali dla całego świata gry.
 * Konwencja: 1 unit Three.js = 1 metr w świecie rzeczywistym (1u = 1m).
 * Przelicznik z przestrzeni 2D (pikselowej) do 3D: SCALE_FACTOR = 0.1.
 */

export const WorldMetrics = {
    // Współczynnik skali do konwersji jednostek 2D na 3D (100px w 2D = 10m w 3D)
    SCALE_FACTOR: 0.1,

    // Chodnik i krawężnik
    SIDEWALK_HEIGHT: 0.15, // m (wysokość krawężnika/chodnika)
    
    // Budynki i kondygnacje
    FLOOR_HEIGHT: 3.0,     // m (wysokość jednego piętra budynku)
    DOOR_HEIGHT: 2.1,      // m (wysokość drzwi parterowych)

    // Ulice i drogi
    LANE_WIDTH: 3.5,       // m (szerokość jednego pasa ruchu)

    // Przechodnie (NPC)
    NPC_HEIGHT: 1.8,       // m (wysokość postaci)
    NPC_WIDTH: 0.6,        // m (szerokość w ramionach)
    NPC_DEPTH: 0.4,        // m (grubość sylwetki)

    // Pojazdy - Type A (Sedan)
    SEDAN: {
        length: 4.5,       // m
        width: 1.8,        // m
        height: 1.4,       // m
        chassisHeightRatio: 0.3 // 30% wysokości to podwozie
    },

    // Pojazdy - Type B (Van)
    VAN: {
        length: 5.5,       // m
        width: 2.2,        // m
        height: 1.8,       // m
        chassisHeightRatio: 0.3 // 30% wysokości to podwozie
    }
};
