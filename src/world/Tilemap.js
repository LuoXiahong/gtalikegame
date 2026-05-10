/**
 * WORLD: Tilemap
 * System kafelków definiujący semantykę podłoża.
 */
import { World } from './World.js';

export const TILE_TYPES = {
    GRASS: 0,
    ROAD: 1,
    SIDEWALK: 2,
    BUILDING_ZONE: 3
};

export const TILE_COLORS = {
    [TILE_TYPES.GRASS]: '#27ae60',
    [TILE_TYPES.ROAD]: '#34495e',
    [TILE_TYPES.SIDEWALK]: '#95a5a6',
    [TILE_TYPES.BUILDING_ZONE]: '#7f8c8d'
};

export const Tilemap = {
    data: [],
    cols: 0,
    rows: 0,
    tileSize: 100,

    init() {
        this.tileSize = World.tileSize;
        this.cols = Math.ceil(World.width / this.tileSize);
        this.rows = Math.ceil(World.height / this.tileSize);
        
        // Inicjalizacja pustej mapy (trawa)
        this.data = Array(this.rows).fill(0).map(() => Array(this.cols).fill(TILE_TYPES.GRASS));

        this.generateSimpleCity();
    },

    generateSimpleCity() {
        // Prosta siatka ulic (krzyżówka)
        const midCol = Math.floor(this.cols / 2);
        const midRow = Math.floor(this.rows / 2);

        // Pionowa ulica
        for (let r = 0; r < this.rows; r++) {
            this.setTile(midCol - 1, r, TILE_TYPES.SIDEWALK);
            this.setTile(midCol, r, TILE_TYPES.ROAD);
            this.setTile(midCol + 1, r, TILE_TYPES.ROAD);
            this.setTile(midCol + 2, r, TILE_TYPES.SIDEWALK);
        }

        // Pozioma ulica
        for (let c = 0; c < this.cols; c++) {
            this.setTile(c, midRow - 1, TILE_TYPES.SIDEWALK);
            this.setTile(c, midRow, TILE_TYPES.ROAD);
            this.setTile(c, midRow + 1, TILE_TYPES.ROAD);
            this.setTile(c, midRow + 2, TILE_TYPES.SIDEWALK);
        }
    },

    setTile(x, y, type) {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            this.data[y][x] = type;
        }
    },

    getTileAt(worldX, worldY) {
        const x = Math.floor(worldX / this.tileSize);
        const y = Math.floor(worldY / this.tileSize);
        
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            return this.data[y][x];
        }
        return TILE_TYPES.GRASS;
    }
};
