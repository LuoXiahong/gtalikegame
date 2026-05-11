/**
 * TRAFFIC SYSTEM (TrafficSystem)
 * Spawns and manages autonomous AI vehicles driving along streets waypoints.
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
        
        // Despawn vehicles too far from player
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
        
        // Spawn fresh vehicles if below limit
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
        
        // Find starting node further than spawnRadius from player
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
        
        if (!pathName) return; // All paths too close to player
        
        const path = Waypoints.paths[pathName];
        const nextNode = path[1] || start;
        const pathAngle = Math.atan2(nextNode.y - start.y, nextNode.x - start.x);
        const perpAngle = pathAngle + Math.PI / 2;
        
        const laneOffset = (Math.random() - 0.5) * 30; // Lane positioning offset
        
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
        // Disable physical friction for traffic AI, steering directly
        car.physics.friction = 1.0; 
        World.addEntity(car);
    },
    
    computeSpeedMult(car) {
        let speedMult = 1.0;
        const sensorDist = 180;
        const minStopDist = 100;
        
        // 1. Avoid other vehicles and the player
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
                
                if (Math.abs(diff) < 0.45) { // 25-degree vision cone
                    if (distToOther <= minStopDist) {
                        speedMult = 0;
                    } else {
                        // Smoothly decelerate
                        const factor = (distToOther - minStopDist) / (sensorDist - minStopDist);
                        speedMult = Math.min(speedMult, factor);
                    }
                }
            }
        }
        
        // 2. Avoid buildings (AABB ray casting approximation)
        if (World.buildings && World.buildings.length > 0) {
            const cos = Math.cos(car.transform.angle);
            const sin = Math.sin(car.transform.angle);
            
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
        
        // Calculate lane lateral offset for target waypoint
        const prevIndex = Math.max(0, car.ai.targetIndex - 1);
        const prevNode = path[prevIndex];
        const segmentAngle = Math.atan2(target.y - prevNode.y, target.x - prevNode.x);
        const perpAngle = segmentAngle + Math.PI / 2;
        
        const targetX = target.x + Math.cos(perpAngle) * (car.ai.laneOffset || 0);
        const targetY = target.y + Math.sin(perpAngle) * (car.ai.laneOffset || 0);
        
        const dx = targetX - car.transform.x;
        const dy = targetY - car.transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let angle = Math.atan2(dy, dx);
        
        // Manage collision avoidance timer
        if (car.ai.avoidTimer === undefined) car.ai.avoidTimer = 0;
        if (car.ai.avoidAngleOffset === undefined) car.ai.avoidAngleOffset = 0;
        
        if (car.ai.avoidTimer > 0) {
            car.ai.avoidTimer -= dt;
            if (car.ai.avoidTimer <= 0) {
                car.ai.avoidTimer = 0;
                car.ai.avoidAngleOffset = 0;
            }
        }
        
        // Check if avoidance trigger is needed
        if (car.ai.avoidTimer === 0) {
            const others = World.entities.filter(e => e !== car && e.type === 'car');
            for (const other of others) {
                const odx = other.transform.x - car.transform.x;
                const ody = other.transform.y - car.transform.y;
                const odist = Math.sqrt(odx * odx + ody * ody);
                
                if (odist < 140) {
                    const angleToOther = Math.atan2(ody, odx);
                    let diff = angleToOther - angle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    
                    if (Math.abs(diff) < 1.0) {
                        car.ai.avoidTimer = 1.5;
                        car.ai.avoidAngleOffset = diff > 0 ? -0.4 : 0.4;
                        break;
                    }
                }
            }
        }
        
        if (car.ai.avoidTimer > 0) {
            angle += car.ai.avoidAngleOffset;
        }
        
        car.transform.angle = angle;
  
        // Decelerate/Stop on obstacle detection
        const speedMult = this.computeSpeedMult(car);
        
        const targetSpeed = car.ai.maxSpeed * speedMult;
        car.ai.currentSpeed += (targetSpeed - car.ai.currentSpeed) * 0.1;
        
        // Predictive collision safety checks
        const predVelX = Math.cos(angle) * car.ai.currentSpeed * dt;
        const predVelY = Math.sin(angle) * car.ai.currentSpeed * dt;
        const nextX = car.transform.x + predVelX;
        const nextY = car.transform.y + predVelY;
        
        const hw = car.transform.width / 2;
        const hh = car.transform.height / 2;
        
        let collisionOccurred = false;
        let pushX = 0;
        let pushY = 0;
        
        // A. Building collisions
        if (World.buildings && World.buildings.length > 0) {
            for (const b of World.buildings) {
                if (nextX - hw < b.x + b.w &&
                    nextX + hw > b.x &&
                    nextY - hh < b.y + b.h &&
                    nextY + hh > b.y) {
                    
                    collisionOccurred = true;
                    const bx = b.x + b.w / 2;
                    const by = b.y + b.h / 2;
                    const bdx = car.transform.x - bx;
                    const bdy = car.transform.y - by;
                    const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
                    pushX = (bdx / bdist) * 10;
                    pushY = (bdy / bdist) * 10;
                    break;
                }
            }
        }
        
        // B. Vehicle/Player collisions
        if (!collisionOccurred) {
            const others = World.entities.filter(e => e !== car && (e.type === 'car' || e.type === 'player'));
            for (const other of others) {
                const ohw = other.transform.width / 2;
                const ohh = other.transform.height / 2;
                
                if (nextX - hw < other.transform.x + ohw &&
                    nextX + hw > other.transform.x - ohw &&
                    nextY - hh < other.transform.y + ohh &&
                    nextY + hh > other.transform.y - ohh) {
                    
                    collisionOccurred = true;
                    const cdx = car.transform.x - other.transform.x;
                    const cdy = car.transform.y - other.transform.y;
                    const cdist = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
                    pushX = (cdx / cdist) * 10;
                    pushY = (cdy / cdist) * 10;
                    break;
                }
            }
        }
        
        if (collisionOccurred) {
            car.ai.currentSpeed = 0;
            // Elastic fallback push
            car.transform.x += pushX;
            car.transform.y += pushY;
            car.physics.velX = 0;
            car.physics.velY = 0;
        } else {
            car.physics.velX = predVelX;
            car.physics.velY = predVelY;
        }
    }
};
