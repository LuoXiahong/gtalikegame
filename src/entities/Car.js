import { Entity } from './Entity.js';

export class Car extends Entity {
    constructor(id, x, y, color) {
        super(id, 'car', x, y);
        this.transform.width = 90;
        this.transform.height = 45;
        // Fizyka auta (arcade)
        this.physics = { 
            velX: 0, 
            velY: 0, 
            speed: 0, // Bieżąca prędkość scalarna
            maxSpeed: 600,
            acceleration: 400,
            friction: 1.0, // Fizyczne tarcie (MovementSystem) - wyłączone dla aut
            rollingResistance: 0.98, // Naturalne zwalnianie auta
            brakingFriction: 0.92, 
            steeringPower: 2.5 
        };
        this.visual.color = color;
        this.visual.z = 0.05; 

        this.occupied = false;
        this.occupantId = null;
    }
}
