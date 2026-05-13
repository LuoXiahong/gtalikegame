/**
 * WORLD: Tilemap
 * System kafelków definiujący semantykę podłoża.
 */
import { World } from './World.js';
import { WorldGrid } from './WorldGrid.js';

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
        // Generowanie siatki na podstawie WorldGrid
        // Wypełniamy strefę miejską drogą, ignorując zewnętrzny margines
        const padding = WorldGrid.PADDING;
        const startTile = Math.floor(padding / this.tileSize);
        const endTileCol = Math.floor((3000 - padding) / this.tileSize);
        const endTileRow = Math.floor((3000 - padding) / this.tileSize);

        for (let r = startTile; r < endTileRow; r++) {
            for (let c = startTile; c < endTileCol; c++) {
                this.setTile(c, r, TILE_TYPES.ROAD);
            }
        }

        // Następnie nadpisujemy bloki odpowiednio chodnikiem i strefami budynków
        for (let br = 0; br < WorldGrid.GRID_ROWS; br++) {
            for (let bc = 0; bc < WorldGrid.GRID_COLS; bc++) {
                const b = WorldGrid.getBlockBounds(br, bc);
                if (!b) continue;

                const startCol = Math.floor(b.x / this.tileSize);
                const endCol = Math.floor((b.x + b.w) / this.tileSize);
                const startRow = Math.floor(b.y / this.tileSize);
                const endRow = Math.floor((b.y + b.h) / this.tileSize);

                for (let r = startRow; r < endRow; r++) {
                    for (let c = startCol; c < endCol; c++) {
                        const worldX = c * this.tileSize + this.tileSize / 2;
                        const worldY = r * this.tileSize + this.tileSize / 2;

                        const isBorder = (worldX < b.x + 100) ||
                                         (worldX >= b.x + b.w - 100) ||
                                         (worldY < b.y + 100) ||
                                         (worldY >= b.y + b.h - 100);

                        if (isBorder) {
                            this.setTile(c, r, TILE_TYPES.SIDEWALK);
                        } else {
                            this.setTile(c, r, TILE_TYPES.BUILDING_ZONE);
                        }
                    }
                }
            }
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
