/**
 * System fizyki pojazdów (Arcade Driving)
 * Skupiony na "feelingu" i sterowaniu zręcznościowym.
 */
import { InputSystem } from '../input/InputManager.js';

export const VehiclePhysicsSystem = {
    update(dt, entity) {
        if (!entity || entity.type !== 'car') return;

        const p = entity.physics;
        const t = entity.transform;

        // 1. Przyspieszanie i Hamowanie
        let driveIntent = 0;
        if (InputSystem.keys.up) driveIntent = 1;
        if (InputSystem.keys.down) driveIntent = -1;

        if (driveIntent !== 0) {
            // Przyspieszanie (z uwzględnieniem kierunku)
            p.speed += driveIntent * p.acceleration * dt;
        } else {
            // Naturalne toczenie się (tarcie powietrza/podłoża)
            p.speed *= p.rollingResistance;
        }

        // Specyficzna logika hamulca (szybsze zwalnianie)
        const isBraking = (p.speed > 0 && InputSystem.keys.down) || (p.speed < 0 && InputSystem.keys.up);
        if (isBraking) {
            p.speed *= p.brakingFriction;
        }

        // Limity prędkości
        if (p.speed > p.maxSpeed) p.speed = p.maxSpeed;
        if (p.speed < -p.maxSpeed / 2) p.speed = -p.maxSpeed / 2;

        // Martwa strefa (stop)
        if (Math.abs(p.speed) < 1) p.speed = 0;

        // 2. Skręcanie (Arcade Steering)
        if (Math.abs(p.speed) > 5) {
            const steerDir = (InputSystem.keys.left ? -1 : 0) + (InputSystem.keys.right ? 1 : 0);
            
            // Skrętność zależy od prędkości - auto nie skręca w miejscu
            // speedFactor rośnie od 0 do 1 w zakresie 0-100 px/s
            const speedFactor = Math.min(Math.abs(p.speed) / 150, 1.0);
            
            // Kierunek skrętu odwraca się na wstecznym
            const reverseFactor = p.speed < 0 ? -1 : 1;
            
            t.angle += steerDir * p.steeringPower * speedFactor * reverseFactor * dt;
        }

        // 3. Konwersja na wektor prędkości dla MovementSystem
        // Obliczamy docelowy wektor ruchu wynikający z kąta auta
        const moveStep = p.speed * dt;
        const targetVelX = Math.cos(t.angle) * moveStep;
        const targetVelY = Math.sin(t.angle) * moveStep;
        
        // "Drift hint": Wektor prędkości goni orientację auta z lekkim opóźnieniem
        // Daje to uczucie "ślizgania się" przy gwałtownych skrętach.
        const driftInertia = 0.2; 
        p.velX += (targetVelX - p.velX) * driftInertia;
        p.velY += (targetVelY - p.velY) * driftInertia;
    }
};
