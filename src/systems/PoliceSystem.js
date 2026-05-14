/**
 * System Policji (PoliceSystem)
 */
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';
import { Car } from '../entities/Car.js';
import { VehicleSystem } from './VehicleSystem.js';

export const PoliceSystem = {
    policeCars: [],
    spawnDistance: 1000,
    isActive: false,

    init() {
        this.reset();
        if (this._onWantedChange) EventBus.off('wanted_level_change', this._onWantedChange);
        if (this._onWantedReset) EventBus.off('wanted_reset', this._onWantedReset);

        this._onWantedChange = ({ stars }) => {
            if (stars >= 2) {
                this.isActive = true;
            } else {
                this.isActive = false;
                this.despawnAll();
            }
        };
        EventBus.on('wanted_level_change', this._onWantedChange);

        this._onWantedReset = () => {
            this.isActive = false;
            this.despawnAll();
        };
        EventBus.on('wanted_reset', this._onWantedReset);
    },

    reset() {
        this.despawnAll();
        this.policeCars = [];
        this.isActive = false;
    },

    spawnPoliceIfNeeded() {
        // Dopuszczamy 1 auto policyjne na razie dla prostoty (można skalować ze stars)
        if (this.policeCars.length === 0) {
            const target = VehicleSystem.getControlledEntity() || World.getEntitiesByType('player')[0];
            if (!target) return;

            // Spawn z dala od gracza
            const angle = Math.random() * Math.PI * 2;
            const px = target.transform.x + Math.cos(angle) * this.spawnDistance;
            const py = target.transform.y + Math.sin(angle) * this.spawnDistance;

            const policeCar = new Car('police_' + Date.now(), px, py, '#2980b9');
            policeCar.isPolice = true;
            policeCar.physics.maxSpeed = 650; // Policja jest trochę szybsza
            policeCar.physics.acceleration = 500;
            
            World.addEntity(policeCar);
            this.policeCars.push(policeCar);
        }
    },

    despawnAll() {
        this.policeCars.forEach(car => {
            World.removeEntity(car.id);
        });
        this.policeCars = [];
    },

    cleanUpDestroyedCars() {
        // Usuwamy z tablicy auta, których nie ma już w World.entities
        this.policeCars = this.policeCars.filter(car => World.entities.includes(car));
    },

    update(dt) {
        if (!this.isActive) return;

        this.cleanUpDestroyedCars();
        this.spawnPoliceIfNeeded();

        const target = VehicleSystem.getControlledEntity() || World.getEntitiesByType('player')[0];
        if (!target) return;

        this.policeCars.forEach(policeCar => {
            if (!World.entities.includes(policeCar)) return;

            const dx = target.transform.x - policeCar.transform.x;
            const dy = target.transform.y - policeCar.transform.y;
            
            // Proste skierowanie przodu w stronę gracza
            const targetAngle = Math.atan2(dy, dx);
            policeCar.transform.angle = targetAngle;
            
            // Przyspieszenie
            if (policeCar.physics.speed < policeCar.physics.maxSpeed) {
                policeCar.physics.speed += policeCar.physics.acceleration * dt;
            }

            // Aplikacja wektora prędkości (UWAGA: wymagane mnożenie przez dt dla MovementSystem)
            policeCar.physics.velX = Math.cos(policeCar.transform.angle) * policeCar.physics.speed * dt;
            policeCar.physics.velY = Math.sin(policeCar.transform.angle) * policeCar.physics.speed * dt;
        });
    }
};
