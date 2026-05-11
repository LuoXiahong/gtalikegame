/**
 * WORLD METRICS: WorldGrid
 * Defines the structure of the 3x3 city grid layout (9 blocks, streets, and padding margins).
 */

export const WorldGrid = {
    BLOCK_SIZE: 500,      // Dimension of a single block side (500px = 5 tiles)
    STREET_WIDTH: 200,    // Width of streets separating blocks (200px = 2 tiles)
    GRID_COLS: 3,         // 3x3 layout
    GRID_ROWS: 3,
    PADDING: 500,         // Outer grass padding boundary (500px = 5 tiles)

    /**
     * Returns bounds for the city block at the specified [row, col] indices
     * @param {number} row - Row index (0-2)
     * @param {number} col - Column index (0-2)
     * @returns {{x: number, y: number, w: number, h: number}|null}
     */
    getBlockBounds(row, col) {
        if (row < 0 || row >= this.GRID_ROWS || col < 0 || col >= this.GRID_COLS) {
            return null;
        }
        const x = this.PADDING + col * (this.BLOCK_SIZE + this.STREET_WIDTH);
        const y = this.PADDING + row * (this.BLOCK_SIZE + this.STREET_WIDTH);
        return {
            x,
            y,
            w: this.BLOCK_SIZE,
            h: this.BLOCK_SIZE
        };
    },

    /**
     * Returns center coordinates for all street axes (both vertical and horizontal)
     * @returns {number[]}
     */
    getStreetCenters() {
        return [
            this.PADDING + this.BLOCK_SIZE + this.STREET_WIDTH / 2, // First street center (1100)
            this.PADDING + 2 * this.BLOCK_SIZE + 1.5 * this.STREET_WIDTH // Second street center (1800)
        ];
    },

    /**
     * Checks if a 2D point lies within any urban city block bounds (sidewalk/building zone)
     * @param {number} x - coordinate X
     * @param {number} y - coordinate Y
     * @returns {boolean} - true if point is on a block
     */
    isPointInAnyBlock(x, y) {
        for (let r = 0; r < this.GRID_ROWS; r++) {
            for (let c = 0; c < this.GRID_COLS; c++) {
                const b = this.getBlockBounds(r, c);
                if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) {
                    return true;
                }
            }
        }
        return false;
    }
};
