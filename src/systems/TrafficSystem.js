/**
 * SYSTEM: TrafficSystem
 * Zarządza ruchem ulicznym (autami AI).
 */
import { World } from '../world/World.js';
import { Waypoints } from '../world/Waypoints.js';
import { Car } from '../entities/Car.js';

export const TrafficSystem = {
    maxCars: 8,
    spawnRadius: 900,
    despawnRadius: 1200,
    
    update(dt) {
        const trafficCars = World.getEntitiesByType('car').filter(c => c.ai && c.ai.type === 'traffic');
        const player = World.getEntitiesByType('player')[0];
        
        // Despawn far cars
        trafficCars.forEach(car => {
            if (player && !car.occupied) {
                const dx = car.transform.x - player.transform.x;
                const dy = car.transform.y - player.transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > this.despawnRadius) {
                    World.removeEntity(car.id);
                }
            }
        });
        
        const remainingCars = World.getEntitiesByType('car').filter(c => c.ai && c.ai.type === 'traffic');
        
        // 3. Spawn / Despawn
        if (remainingCars.length < this.maxCars) {
            this.spawnRandomCar();
        }
        
        remainingCars.forEach(car => this.updateCar(car, dt));
    },
    
    spawnRandomCar() {
        const pathNames = Object.keys(Waypoints.paths);
        const player = World.getEntitiesByType('player')[0];
        
        let pathName = null;
        let start = null;
        
        // Spróbuj znaleźć punkt startowy poza spawnRadius od gracza
        const shuffledPathNames = [...pathNames].sort(() => Math.random() - 0.5);
        for (const tempPathName of shuffledPathNames) {
            const tempPath = Waypoints.paths[tempPathName];
            const tempStart = tempPath[0];
            
            if (player) {
                const dx = tempStart.x - player.transform.x;
                const dy = tempStart.y - player.transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= this.spawnRadius) {
                    pathName = tempPathName;
                    start = tempStart;
                    break;
                }
            } else {
                pathName = tempPathName;
                start = tempStart;
                break;
            }
        }
        
        if (!pathName) return; // Wszystkie ścieżki za blisko gracza
        
        const path = Waypoints.paths[pathName];
        
        const nextNode = path[1] || start;
        const pathAngle = Math.atan2(nextNode.y - start.y, nextNode.x - start.x);
        const perpAngle = pathAngle + Math.PI / 2;
        
        const laneOffset = (Math.random() - 0.5) * 30; // boczny offset (pas ruchu)
        
        const spawnX = start.x + Math.cos(perpAngle) * laneOffset;
        const spawnY = start.y + Math.sin(perpAngle) * laneOffset;
        
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const car = new Car(`traffic_${Date.now()}_${Math.random()}`, spawnX, spawnY, color);
        car.ai = {
            type: 'traffic',
            pathName: pathName,
            targetIndex: 1,
            maxSpeed: 150 + Math.random() * 100,
            currentSpeed: 0,
            laneOffset: laneOffset
        };
        // Wyłączamy domyślne tarcie fizyki, AI steruje bezpośrednio
        car.physics.friction = 1.0; 
        World.addEntity(car);
    },
    
    computeSpeedMult(car) {
        let speedMult = 1.0;
        const sensorDist = 180;
        const minStopDist = 100;
        
        // 1. Unikanie innych aut i gracza
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
                
                if (Math.abs(diff) < 0.45) { // Stożek widzenia ok 25 stopni (0.45 rad)
                    if (distToOther <= minStopDist) {
                        speedMult = 0;
                    } else {
                        // Płynny lerp zwalniania
                        const factor = (distToOther - minStopDist) / (sensorDist - minStopDist);
                        speedMult = Math.min(speedMult, factor);
                    }
                }
            }
        }
        
        // 2. Unikanie budynków (AABB sampling)
        if (World.buildings && World.buildings.length > 0) {
            const cos = Math.cos(car.transform.angle);
            const sin = Math.sin(car.transform.angle);
            
            // Check sample points along the ray in front of the car
            const sampleDistances = [60, 100, 140, 180];
            for (const dist of sampleDistances) {
                const rx = car.transform.x + cos * dist;
                const ry = car.transform.y + sin * dist;
                
                for (const b of World.buildings) {
                    if (rx >= b.x && rx <= b.x + b.w && ry >= b.y && ry <= b.y + b.h) {
                        if (dist <= minStopDist) {
                            speedMult = 0;
                        } else {
                            const factor = (dist - minStopDist) / (sensorDist - minStopDist);
                            speedMult = Math.min(speedMult, factor);
                        }
                        break;
                    }
                }
                if (speedMult === 0) break;
            }
        }
        
        return speedMult;
    },

    updateCar(car, dt) {
        const path = Waypoints.paths[car.ai.pathName];
        const target = path[car.ai.targetIndex];
        
        // Oblicz boczny offset dla targetu
        const prevIndex = Math.max(0, car.ai.targetIndex - 1);
        const prevNode = path[prevIndex];
        const segmentAngle = Math.atan2(target.y - prevNode.y, target.x - prevNode.x);
        const perpAngle = segmentAngle + Math.PI / 2;
        
        const targetX = target.x + Math.cos(perpAngle) * (car.ai.laneOffset || 0);
        const targetY = target.y + Math.sin(perpAngle) * (car.ai.laneOffset || 0);
        
        const dx = targetX - car.transform.x;
        const dy = targetY - car.transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const angle = Math.atan2(dy, dx);
        car.transform.angle = angle;
 
        // 2. Hamowanie przed przeszkodą (Fake Raycast)
        const speedMult = this.computeSpeedMult(car);
        
        // Płynne przyspieszanie/hamowanie
        const targetSpeed = car.ai.maxSpeed * speedMult;
        car.ai.currentSpeed += (targetSpeed - car.ai.currentSpeed) * 0.1;
        
        // Ustawienie vel dla MovementSystem
        car.physics.velX = Math.cos(angle) * car.ai.currentSpeed * dt;
        car.physics.velY = Math.sin(angle) * car.ai.currentSpeed * dt;
    }
};
