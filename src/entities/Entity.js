/**
 * ENCJE (Entities)
 * Struktury przechowujące stan, bez logiki gameplayowej.
 */
export class Entity {
    constructor(id, type, x, y) {
        this.id = id;
        this.type = type;

        // Komponent: Pozycja i wymiary
        this.transform = { x: x, y: y, width: 20, height: 20, angle: 0 };

        // Komponent: Fizyka (opcjonalny, inicjowany w podklasach)
        this.physics = null;

        // Komponent: Reprezentacja wizualna
        this.visual = { color: '#ffffff', walkCycle: 0 };
        this.visible = true;
    }
}
