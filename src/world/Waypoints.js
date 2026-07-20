/**
 * Traffic path network from WorldGrid — lanes sit on real street axes (1100 / 1800).
 */
import { WorldGrid } from './WorldGrid.js';

const LANE_OFFSET = 35; // Offset from street center (STREET_WIDTH=200 → safe lane)
const PATH_MARGIN = WorldGrid.PADDING + 50; // 550 — stay on asphalt
const PATH_MAX = 3000 - WorldGrid.PADDING - 50; // 2450

function buildPaths() {
    const centers = WorldGrid.getStreetCenters(); // [1100, 1800]
    const paths = {};

    centers.forEach((cx, i) => {
        // Vertical: south (+y) right lane, north (−y) left lane
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
        // Horizontal: east (+x) lower lane, west (−x) upper lane
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
