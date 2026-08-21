import { Entity } from './Entity.js';

export class Player extends Entity {
    constructor(x, y) {
        super('player1', 'player', x, y);
        // friction: 1 (no decay) — PlayerMovementSystem already assigns velX/velY fresh
        // each frame as a dt-scaled displacement, not a persisting velocity, so a
        // friction < 1 here double-decays it (see PlayerMovementSystem's STOP_DECAY for
        // the actual "coast to a stop" behavior). walkSpeed matches NPC.js for a
        // consistent pace between player and pedestrians.
        this.physics = { velX: 0, velY: 0, walkSpeed: 85, friction: 1 };
        this.visual.color = '#e74c3c';
        this.interactionRadius = 120;
        this.health = { current: 100, max: 100, dead: false };
    }
}
