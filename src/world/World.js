/**
 * CORE: ŚWIAT (World Manager)
 * Centralne repozytorium danych środowiskowych.
 */
import { Tilemap } from './Tilemap.js';
import { Decals } from './Decals.js';

export const World = {
    width: 3000,
    height: 3000,
    tileSize: 100,
    buildings: [],
    entities: [],
    tilemap: null,
    decals: null,

    init() {
        this.tilemap = Tilemap;
        this.tilemap.init();

        this.decals = Decals;
        this.decals.init();

        this.buildings = [
            { x: 1300, y: 1300, w: 200, h: 300, z: 0.4 },
            { x: 1600, y: 1200, w: 150, h: 150, z: 0.15 },
            { x: 1200, y: 1700, w: 400, h: 100, z: 0.25 },
            { x: 1800, y: 1500, w: 200, h: 200, z: 0.6 }
        ];
    },

    addEntity(entity) {
        this.entities.push(entity);
    },

    removeEntity(id) {
        this.entities = this.entities.filter(e => e.id !== id);
    },

    getEntitiesByType(type) {
        return this.entities.filter(e => e.type === type);
    }
};
