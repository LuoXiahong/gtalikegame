/**
 * VEHICLE PHYSICS SYSTEM (VehiclePhysicsSystem)
 * Implements arcade driving feel, focusing on responsive handling and zesty steering.
 */
import { InputSystem } from '../input/InputManager.js';

export const VehiclePhysicsSystem = {
    update(dt, entity) {
        if (!entity || entity.type !== 'car') return;

        const p = entity.physics;
        const t = entity.transform;

        // 1. Acceleration and Braking
        let driveIntent = 0;
        if (InputSystem.keys.up) driveIntent = 1;
        if (InputSystem.keys.down) driveIntent = -1;

        // Determine if currently braking (key input opposite to motion direction)
        const isBraking = (p.speed > 0 && InputSystem.keys.down) || (p.speed < 0 && InputSystem.keys.up);

        if (isBraking) {
            // High-deceleration arcade braking
            const brakeDecel = (p.brakeForce || 800) * dt;
            if (Math.abs(p.speed) < brakeDecel) {
                p.speed = 0;
            } else {
                p.speed -= Math.sign(p.speed) * brakeDecel;
            }
        } else if (driveIntent !== 0) {
            // Acceleration with non-linear curve (faster launch, slower top-end approach)
            const speedRatio = Math.min(Math.abs(p.speed) / p.maxSpeed, 1.0);
            const accelCurve = 1.0 - speedRatio * 0.6; // 100% force at start, tapering to 40% near top speed
            p.speed += driveIntent * p.acceleration * accelCurve * dt;
        } else {
            // Natural coasting deceleration
            p.speed *= p.rollingResistance;
        }

        // Speed limits (slower reverse speed)
        if (p.speed > p.maxSpeed) p.speed = p.maxSpeed;
        if (p.speed < -p.maxSpeed / 2) p.speed = -p.maxSpeed / 2;

        // Micro-movement deadzone
        if (Math.abs(p.speed) < 1) p.speed = 0;

        // 2. Arcade Steering
        if (Math.abs(p.speed) > 5) {
            const steerDir = (InputSystem.keys.left ? -1 : 0) + (InputSystem.keys.right ? 1 : 0);
            
            // Turn rate scales with speed (vehicles cannot rotate in place)
            const speedFactor = Math.min(Math.abs(p.speed) / 150, 1.0);
            
            // Invert steering when reversing
            const reverseFactor = p.speed < 0 ? -1 : 1;
            
            t.angle += steerDir * p.steeringPower * speedFactor * reverseFactor * dt;
        }

        // 3. Movement vector conversion for MovementSystem
        const moveStep = p.speed * dt;
        const targetVelX = Math.cos(t.angle) * moveStep;
        const targetVelY = Math.sin(t.angle) * moveStep;
        
        // Simple drift inertia: velocity vector catches up to car angle with latency
        const driftInertia = 0.2; 
        p.velX += (targetVelX - p.velX) * driftInertia;
        p.velY += (targetVelY - p.velY) * driftInertia;
    }
};
