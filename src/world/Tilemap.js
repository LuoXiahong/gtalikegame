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
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const worldX = c * this.tileSize + this.tileSize / 2;
                const worldY = r * this.tileSize + this.tileSize / 2;

                // Sprawdzamy czy ten kafelek leży w którymkolwiek bloku
                let insideBlock = false;
                for (let br = 0; br < WorldGrid.GRID_ROWS; br++) {
                    for (let bc = 0; bc < WorldGrid.GRID_COLS; bc++) {
                        const b = WorldGrid.getBlockBounds(br, bc);
                        if (worldX >= b.x && worldX < b.x + b.w && worldY >= b.y && worldY < b.y + b.h) {
                            insideBlock = true;
                            
                            // Sprawdzamy czy leży na krawędzi bloku (zewnętrzny pierścień o szerokości 1 kafelka = 100u)
                            const isBorder = (worldX < b.x + 100) || 
                                             (worldX >= b.x + b.w - 100) || 
                                             (worldY < b.y + 100) || 
                                             (worldY >= b.y + b.h - 100);
                            
                            if (isBorder) {
                                this.setTile(c, r, TILE_TYPES.SIDEWALK);
                            } else {
                                this.setTile(c, r, TILE_TYPES.BUILDING_ZONE);
                            }
                            break;
                        }
                    }
                    if (insideBlock) break;
                }

                // Jeśli nie leży w bloku, ale leży wewnątrz miejskiego obszaru (między zewnętrznymi marginesami), jest to ROAD!
                if (!insideBlock) {
                    const padding = WorldGrid.PADDING;
                    if (worldX >= padding && worldX < 3000 - padding && worldY >= padding && worldY < 3000 - padding) {
                        this.setTile(c, r, TILE_TYPES.ROAD);
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
