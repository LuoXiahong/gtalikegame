import { Entity } from './Entity.js';
import { GameConfig } from '../core/GameConfig.js';

export class Car extends Entity {
    constructor(id, x, y, color) {
        super(id, 'car', x, y);
        // Collision footprint in 2D px; WorldMetrics.SCALE_FACTOR (0.1) converts to 3D
        // meters, so this must track the real vehicle archetypes in VehicleModelFactory.js
        // (~4.2-5.0m long, ~1.65-1.9m wide) or the 3D model floats inside an oversized box.
        this.transform.width = 50;
        this.transform.height = 20;
        this.physics = {
            velX: 0,
            velY: 0,
            speed: 0, // Scalar speed (arcade driving)
            maxSpeed: GameConfig.VEHICLE.MAX_SPEED, // 80 km/h cap — see GameConfig.js
            acceleration: 600 * GameConfig.VEHICLE.SPEED_SCALE,
            friction: 1.0, // MovementSystem friction off for cars (1.0 = no decay)
            rollingResistance: 0.97,
            brakingFriction: 0.90,
            brakeForce: 800 * GameConfig.VEHICLE.SPEED_SCALE,
            steeringPower: 3.0
        };
        this.visual.color = color;
        this.visual.z = 0.05; 

        this.occupied = false;
        this.occupantId = null;
    }
}
