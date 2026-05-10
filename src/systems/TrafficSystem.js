/**
 * SYSTEM: TrafficSystem
 * Zarządza ruchem ulicznym (autami AI).
 */
import { World } from '../world/World.js';
import { Waypoints } from '../world/Waypoints.js';
import { Car } from '../entities/Car.js';

export const TrafficSystem = {
    maxCars: 8,
    
    update(dt) {
        const trafficCars = World.getEntitiesByType('car').filter(c => c.ai && c.ai.type === 'traffic');
        
        // 3. Spawn / Despawn
        if (trafficCars.length < this.maxCars) {
            this.spawnRandomCar();
        }
        
        trafficCars.forEach(car => this.updateCar(car, dt));
    },
    
    spawnRandomCar() {
        const pathNames = Object.keys(Waypoints.paths);
        const pathName = pathNames[Math.floor(Math.random() * pathNames.length)];
        const path = Waypoints.paths[pathName];
        
        const start = path[0];
        // Losowy offset boczny (symulacja pasów / nieidealnego toru)
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        
        const car = new Car(`traffic_${Date.now()}_${Math.random()}`, start.x + offsetX, start.y + offsetY, '#f39c12');
        car.ai = {
            type: 'traffic',
            pathName: pathName,
            targetIndex: 1,
            maxSpeed: 150 + Math.random() * 100,
            currentSpeed: 0
        };
        // Wyłączamy domyślne tarcie fizyki, AI steruje bezpośrednio
        car.physics.friction = 1.0; 
        World.addEntity(car);
    },
    
    updateCar(car, dt) {
        const path = Waypoints.paths[car.ai.pathName];
        const target = path[car.ai.targetIndex];
        
        const dx = target.x - car.transform.x;
        const dy = target.y - car.transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const angle = Math.atan2(dy, dx);
        car.transform.angle = angle;

        // 2. Hamowanie przed przeszkodą (Fake Raycast)
        let speedMult = 1.0;
        const sensorDist = 180;
        
        const others = World.entities.filter(e => e !== car && (e.type === 'car' || e.type === 'player'));
        for (const other of others) {
            const odx = other.transform.x - car.transform.x;
            const ody = other.transform.y - car.transform.y;
            const distToOther = Math.sqrt(odx * odx + ody * ody);
            
            if (distToOther < sensorDist) {
                const angleToOther = Math.atan2(ody, odx);
                let diff = angleToOther - car.transform.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                
                if (Math.abs(diff) < 0.6) { // Stożek widzenia ok 35 stopni
                    speedMult = 0; 
                    break;
                }
            }
        }
        
        // Płynne przyspieszanie/hamowanie
        const targetSpeed = car.ai.maxSpeed * speedMult;
        car.ai.currentSpeed += (targetSpeed - car.ai.currentSpeed) * 0.1;
        
        // Ustawienie vel dla MovementSystem
        car.physics.velX = Math.cos(angle) * car.ai.currentSpeed * dt;
        car.physics.velY = Math.sin(angle) * car.ai.currentSpeed * dt;
    }
};
