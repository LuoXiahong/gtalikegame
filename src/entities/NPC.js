import { Entity } from './Entity.js';

export class NPC extends Entity {
    constructor(id, x, y, color) {
        super(id, 'npc', x, y);
        this.transform.width = 18;
        this.transform.height = 18;
        this.physics = { velX: 0, velY: 0, speed: 80, friction: 1 };
        this.visual.color = color;

        // Komponent: Sztuczna Inteligencja (FSM)
        this.ai = { state: 'idle', timer: 0 };
    }
}
