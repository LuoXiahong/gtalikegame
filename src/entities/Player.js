import { Entity } from './Entity.js';

export class Player extends Entity {
    constructor(x, y) {
        super('player1', 'player', x, y);
        this.physics = { velX: 0, velY: 0, speed: 100, friction: 0.5 };
        this.visual.color = '#e74c3c';
        this.interactionRadius = 120; // Komponent interakcji
    }
}
