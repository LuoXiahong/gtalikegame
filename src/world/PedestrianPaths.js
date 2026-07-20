/**
 * WORLD: PedestrianPaths
 * Pętle po chodnikach, przejścia przez jezdnię (zebry) + reguła: stop tylko na chodniku.
 */
import { WorldGrid } from './WorldGrid.js';
import { Tilemap, TILE_TYPES } from './Tilemap.js';
import { Decals } from './Decals.js';
import { World } from './World.js';

/** Środek pasa chodnika (border bloku ma 100px) */
const SIDEWALK_INSET = 50;

export const PedestrianPaths = {
    SIDEWALK_INSET,

    getSidewalkLoop(row, col) {
        const b = WorldGrid.getBlockBounds(row, col);
        if (!b) return null;
        const i = SIDEWALK_INSET;
        return [
            { x: b.x + i, y: b.y + i },
            { x: b.x + b.w - i, y: b.y + i },
            { x: b.x + b.w - i, y: b.y + b.h - i },
            { x: b.x + i, y: b.y + b.h - i }
        ];
    },

    getAllSidewalkLoops() {
        const loops = [];
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                loops.push({ row: r, col: c, points: this.getSidewalkLoop(r, c) });
            }
        }
        return loops;
    },

    isOnSidewalk(x, y) {
        if (!Tilemap.data || Tilemap.data.length === 0) {
            return this._isInSidewalkRing(x, y);
        }
        return Tilemap.getTileAt(x, y) === TILE_TYPES.SIDEWALK;
    },

    isOnRoad(x, y) {
        if (!Tilemap.data || Tilemap.data.length === 0) {
            return !this._isInSidewalkRing(x, y) && WorldGrid.isPointInAnyBlock(x, y) === false
                && x > WorldGrid.PADDING && y > WorldGrid.PADDING;
        }
        return Tilemap.getTileAt(x, y) === TILE_TYPES.ROAD;
    },

    isOnCrosswalk(x, y) {
        const items = (World.decals && World.decals.items) || Decals.items || [];
        for (const d of items) {
            if (d.type !== 'crosswalk') continue;
            const hw = d.w / 2;
            const hh = d.h / 2;
            if (x >= d.x - hw && x <= d.x + hw && y >= d.y - hh && y <= d.y + hh) {
                return true;
            }
        }
        return false;
    },

    /** Idle / postój dozwolony TYLKO na chodniku — nigdy na jezdni ani na przejściu. */
    canStop(x, y) {
        return this.isOnSidewalk(x, y);
    },

    _isInSidewalkRing(x, y) {
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                if (!b) continue;
                if (x < b.x || x >= b.x + b.w || y < b.y || y >= b.y + b.h) continue;
                const fromLeft = x - b.x;
                const fromRight = b.x + b.w - x;
                const fromTop = y - b.y;
                const fromBottom = b.y + b.h - y;
                const edge = Math.min(fromLeft, fromRight, fromTop, fromBottom);
                if (edge < 100) return true;
            }
        }
        return false;
    },

    nearestSidewalkPoint(x, y) {
        let best = null;
        let bestDist = Infinity;

        const consider = (px, py) => {
            const d = (px - x) * (px - x) + (py - y) * (py - y);
            if (d < bestDist) {
                bestDist = d;
                best = { x: px, y: py };
            }
        };

        this.getAllSidewalkLoops().forEach(({ points }) => {
            for (let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                consider(a.x, a.y);
                for (let s = 1; s <= 3; s++) {
                    const t = s / 4;
                    consider(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
                }
            }
        });

        return best || { x, y };
    },

    /**
     * Trasa przez przejście: róg chodnika A → środek zebvy → róg chodnika B.
     * corner: 0=NW, 1=NE, 2=SE, 3=SW
     */
    getCrossingPath(rowA, colA, rowB, colB, cornerA, cornerB) {
        const loopA = this.getSidewalkLoop(rowA, colA);
        const loopB = this.getSidewalkLoop(rowB, colB);
        if (!loopA || !loopB) return null;
        const a = loopA[cornerA % 4];
        const b = loopB[cornerB % 4];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return [a, mid, b];
    },

    /**
     * Patrol: pętla chodnika + opcjonalne przejście na sąsiedni blok i powrót.
     */
    buildPatrol(row, col, withCrossing = false) {
        const loop = this.getSidewalkLoop(row, col);
        if (!loop) return [];
        if (!withCrossing) return loop.map(p => ({ ...p }));

        // Przejście na wschód lub południe, jeśli istnieje sąsiad
        let cross = null;
        if (col + 1 < WorldGrid.GRID_COLS) {
            // NE → NW sąsiada (przez ulicę pionową)
            cross = this.getCrossingPath(row, col, row, col + 1, 1, 0);
        } else if (row + 1 < WorldGrid.GRID_ROWS) {
            // SE → NE sąsiada (przez ulicę poziomą)
            cross = this.getCrossingPath(row, col, row + 1, col, 2, 1);
        }

        if (!cross) return loop.map(p => ({ ...p }));

        // Pętla lokalna, potem przejście, krótki spacer u sąsiada, powrót
        const neighborLoop = this.getSidewalkLoop(
            col + 1 < WorldGrid.GRID_COLS ? row : row + 1,
            col + 1 < WorldGrid.GRID_COLS ? col + 1 : col
        );
        const back = [...cross].reverse();
        return [
            ...loop.map(p => ({ ...p })),
            ...cross.map(p => ({ ...p })),
            neighborLoop[1],
            neighborLoop[2],
            ...back.map(p => ({ ...p }))
        ];
    }
};
