import { Entity } from './Entity.js';

export class Player extends Entity {
    constructor(x, y) {
        super('player1', 'player', x, y);
        // walkSpeed is a constant config value (px/s), never mutated per-frame —
        // unlike Car.physics.speed, which is a live scalar VehiclePhysicsSystem updates.
        this.physics = { velX: 0, velY: 0, walkSpeed: 170, friction: 0.5 };
        this.visual.color = '#e74c3c';
        this.interactionRadius = 120;
        this.health = { current: 100, max: 100, dead: false };
    }
}
