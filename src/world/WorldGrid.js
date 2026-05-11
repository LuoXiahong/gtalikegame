/**
 * METRYKI ŚWIATA: WorldGrid
 * Definiuje strukturę siatki miejskiej 3x3 dla gry (9 bloków, ulice i marginesy).
 */

export const WorldGrid = {
    BLOCK_SIZE: 500,      // Rozmiar boku pojedynczego bloku (500u = 5 kafelków)
    STREET_WIDTH: 200,    // Szerokość ulicy rozdzielającej bloki (200u = 2 kafelki)
    GRID_COLS: 3,         // Siatka 3x3 bloków
    GRID_ROWS: 3,
    PADDING: 500,         // Zewnętrzny margines/trawa (500u = 5 kafelków)

    /**
     * Zwraca pozycję i wymiary dla bloku o indeksie [row, col]
     * @param {number} row - indeks wiersza bloku (0-2)
     * @param {number} col - indeks kolumny bloku (0-2)
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
     * Zwraca środki wszystkich ulic (pionowych/poziomych) w grze.
     * @returns {number[]}
     */
    getStreetCenters() {
        return [
            this.PADDING + this.BLOCK_SIZE + this.STREET_WIDTH / 2, // Pierwsza ulica (1100)
            this.PADDING + 2 * this.BLOCK_SIZE + 1.5 * this.STREET_WIDTH // Druga ulica (1800)
        ];
    },

    /**
     * Sprawdza, czy dany punkt w układzie 2D leży na terenie bloku miejskiego
     * @param {number} x - współrzędna X
     * @param {number} y - współrzędna Y
     * @returns {boolean} - true, jeśli punkt leży na bloku (strefa budynku/chodnika)
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
