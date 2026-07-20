import { Entity } from './Entity.js';

export class Car extends Entity {
    constructor(id, x, y, color) {
        super(id, 'car', x, y);
        this.transform.width = 90;
        this.transform.height = 45;
        this.physics = { 
            velX: 0, 
            velY: 0, 
            speed: 0, // Scalar speed (arcade driving)
            maxSpeed: 500,
            acceleration: 600,
            friction: 1.0, // MovementSystem friction off for cars (1.0 = no decay)
            rollingResistance: 0.97,
            brakingFriction: 0.90, 
            brakeForce: 800,
            steeringPower: 3.0
        };
        this.visual.color = color;
        this.visual.z = 0.05; 

        this.occupied = false;
        this.occupantId = null;
    }
}
