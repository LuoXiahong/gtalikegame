/**
 * VEHICLE PHYSICS SYSTEM (VehiclePhysicsSystem)
 * Implements arcade driving feel, focusing on responsive handling and zesty steering.
 */
import { InputSystem } from '../input/InputManager.js';
import { decayFactor, frameBlend } from '../core/MathUtils.js';

// Handbrake drift tuning (T22). Held handbrake breaks rear-axle traction: the velocity
// vector lags further behind the car's heading (visible slide) and steering tightens.
export const HANDBRAKE_DRIFT_INERTIA = 0.05; // vs. normal driftInertia = 0.2 (lower = more slide)
export const HANDBRAKE_STEER_BOOST = 1.5;    // multiplies steeringPower while drifting
export const HANDBRAKE_SPEED_DECAY = 0.985;  // per-frame (60fps-tuned) speed scrub from locked rear wheels

// Fractions of maxSpeed rather than flat px/s — keeps handling feel identical
// (same % of top speed to steer/handbrake, same % for full steering authority)
// no matter what maxSpeed is tuned to.
const MIN_STEERABLE_SPEED_FRACTION = 0.01; // was a flat 5 px/s at the old maxSpeed=500
const FULL_STEER_SPEED_FRACTION = 0.30;    // was a flat 150 px/s at the old maxSpeed=500

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
            p.speed *= decayFactor(p.rollingResistance, dt);
        }

        // Speed limits (slower reverse speed)
        if (p.speed > p.maxSpeed) p.speed = p.maxSpeed;
        if (p.speed < -p.maxSpeed / 2) p.speed = -p.maxSpeed / 2;

        // Micro-movement deadzone
        if (Math.abs(p.speed) < 1) p.speed = 0;

        const minSteerableSpeed = p.maxSpeed * MIN_STEERABLE_SPEED_FRACTION;
        const isHandbraking = InputSystem.keys.handbrake && Math.abs(p.speed) > minSteerableSpeed;
        if (isHandbraking) p.speed *= decayFactor(HANDBRAKE_SPEED_DECAY, dt);

        // 2. Arcade Steering
        if (Math.abs(p.speed) > minSteerableSpeed) {
            const steerDir = (InputSystem.keys.left ? -1 : 0) + (InputSystem.keys.right ? 1 : 0);

            // Turn rate scales with speed (vehicles cannot rotate in place)
            const speedFactor = Math.min(Math.abs(p.speed) / (p.maxSpeed * FULL_STEER_SPEED_FRACTION), 1.0);

            // Invert steering when reversing
            const reverseFactor = p.speed < 0 ? -1 : 1;

            // Handbrake tightens the turn radius (locked rear wheels pivot the car faster)
            const steerBoost = isHandbraking ? HANDBRAKE_STEER_BOOST : 1.0;

            t.angle += steerDir * p.steeringPower * steerBoost * speedFactor * reverseFactor * dt;
        }

        // 3. Movement vector conversion for MovementSystem
        const moveStep = p.speed * dt;
        const targetVelX = Math.cos(t.angle) * moveStep;
        const targetVelY = Math.sin(t.angle) * moveStep;

        // Drift inertia: velocity vector catches up to car angle with latency.
        // Handbrake drops traction so the rear axle slides instead of gripping (drift).
        const driftInertia = isHandbraking ? HANDBRAKE_DRIFT_INERTIA : 0.2;
        const blend = frameBlend(driftInertia, dt);
        p.velX += (targetVelX - p.velX) * blend;
        p.velY += (targetVelY - p.velY) * blend;
    }
};
