/**
 * State-only entity structures (no gameplay logic).
 */
export class Entity {
    constructor(id, type, x, y) {
        this.id = id;
        this.type = type;

        this.transform = { x: x, y: y, width: 20, height: 20, angle: 0 };

        // Optional; initialized in subclasses
        this.physics = null;

        this.visual = { color: '#ffffff', walkCycle: 0 };
        this.visible = true;
    }
}
