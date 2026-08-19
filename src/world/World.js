/**
 * Central store for world / environment data.
 */
import { Tilemap } from './Tilemap.js';
import { Decals } from './Decals.js';
import { WorldGrid } from './WorldGrid.js';

export const World = {
    width: 3000,
    height: 3000,
    tileSize: 100,
    buildings: [],
    entities: [],
    entitiesByType: {},
    tilemap: null,
    decals: null,

    reset() {
        this.entities = [];
        this.entitiesByType = {};
        this.buildings = [];
    },

    init() {
        this.reset();
        this.tilemap = Tilemap;
        this.tilemap.init();

        this.decals = Decals;
        this.decals.init();

        // One building per cell of the 3x3 block grid
        this.buildings = [];
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                // Varied z heights 0.2–0.6 for a non-flat skyline
                const zHeight = 0.2 + ((r * 3 + c) % 5) * 0.1;
                this.buildings.push({
                    x: b.x + 100,
                    y: b.y + 100,
                    w: 300,
                    h: 300,
                    z: zHeight
                });
            }
        }
    },

    addEntity(entity) {
        this.entities.push(entity);
        if (!this.entitiesByType[entity.type]) {
            this.entitiesByType[entity.type] = [];
        }
        this.entitiesByType[entity.type].push(entity);
    },

    removeEntity(id) {
        const idx = this.entities.findIndex(e => e.id === id);
        if (idx !== -1) {
            const entity = this.entities[idx];
            this.entities.splice(idx, 1);
            if (this.entitiesByType[entity.type]) {
                const typeIdx = this.entitiesByType[entity.type].findIndex(e => e.id === id);
                if (typeIdx !== -1) {
                    this.entitiesByType[entity.type].splice(typeIdx, 1);
                }
            }
        }
    },

    /**
     * Entities of a type.
     *
     * Returns the LIVE internal array by reference (except 'police', which is a
     * filtered copy) — deliberately, so per-frame callers allocate nothing. The
     * cost is that `removeEntity` splices the array a caller may be iterating.
     * Snapshot with `.slice()` before any loop that can trigger a despawn, e.g.
     * one emitting an event a listener turns into a kill.
     * @param {string} type
     * @returns {object[]}
     */
    getEntitiesByType(type) {
        if (type === 'police') {
            return (this.entitiesByType['car'] || []).filter(e => e.isPolice);
        }
        return this.entitiesByType[type] || [];
    }
};
