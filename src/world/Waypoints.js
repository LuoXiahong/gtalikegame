/**
 * WORLD: Waypoints
 * Sieć punktów definiujących ścieżki ruchu ulicznego.
 * Generowane z WorldGrid — pasy leżą na prawdziwych osiach ulic (1100 / 1800).
 */
import { WorldGrid } from './WorldGrid.js';

const LANE_OFFSET = 35; // odstęp od środka ulicy (STREET_WIDTH=200 → bezpieczny pas)
const PATH_MARGIN = WorldGrid.PADDING + 50; // 550 — zostajemy na asfalcie
const PATH_MAX = 3000 - WorldGrid.PADDING - 50; // 2450

function buildPaths() {
    const centers = WorldGrid.getStreetCenters(); // [1100, 1800]
    const paths = {};

    centers.forEach((cx, i) => {
        // Pionowe: południe (+y) prawym pasem, północ (−y) lewym
        paths[`NS_${i}_S`] = [
            { x: cx + LANE_OFFSET, y: PATH_MARGIN },
            { x: cx + LANE_OFFSET, y: PATH_MAX }
        ];
        paths[`NS_${i}_N`] = [
            { x: cx - LANE_OFFSET, y: PATH_MAX },
            { x: cx - LANE_OFFSET, y: PATH_MARGIN }
        ];
    });

    centers.forEach((cy, i) => {
        // Poziome: wschód (+x) dolnym pasem, zachód (−x) górnym
        paths[`EW_${i}_E`] = [
            { x: PATH_MARGIN, y: cy + LANE_OFFSET },
            { x: PATH_MAX, y: cy + LANE_OFFSET }
        ];
        paths[`EW_${i}_W`] = [
            { x: PATH_MAX, y: cy - LANE_OFFSET },
            { x: PATH_MARGIN, y: cy - LANE_OFFSET }
        ];
    });

    return paths;
}

export const Waypoints = {
    LANE_OFFSET,
    PATH_MARGIN,
    PATH_MAX,
    paths: buildPaths()
};
