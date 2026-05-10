/**
 * System Pojazdów (VehicleSystem)
 * Zarządza wsiadaniem, wysiadaniem i logiką posiadania pojazdu.
 */
import { EventBus } from '../core/EventBus.js';
import { InputSystem } from '../input/InputManager.js';

export const VehicleSystem = {
    controlledEntity: null,

    init(player) {
        this.controlledEntity = player;

        EventBus.on('enter_vehicle', (data) => this.enterVehicle(data));
        EventBus.on('exit_vehicle', (data) => this.exitVehicle(data));
    },

    enterVehicle({ player, car }) {
        if (!car || car.occupied) return;

        this.controlledEntity = car;
        car.occupied = true;
        car.occupantId = player.id;
        player.visible = false;

        // Zatrzymujemy gracza i samochód w miejscu
        if (player.physics) {
            player.physics.velX = 0;
            player.physics.velY = 0;
        }
        if (car.physics) {
            car.physics.speed = 0;
            car.physics.velX = 0;
            car.physics.velY = 0;
        }

        // Czyścimy wejście, by nie przenosiło się na samochód
        InputSystem.resetAll();

        EventBus.emit('vehicle_entered', { carId: car.id });
        EventBus.emit('ui_show_action_hint', null);
    },

    exitVehicle({ player }) {
        const car = this.controlledEntity;
        if (!car || car.type !== 'car') return;

        this.controlledEntity = player;
        car.occupied = false;
        car.occupantId = null;
        player.visible = true;

        // Ustawiamy gracza obok auta
        player.transform.x = car.transform.x + car.transform.width / 2 + 30;
        player.transform.y = car.transform.y;

        // Zatrzymujemy auto i gracza po wyjściu
        if (car.physics) {
            car.physics.speed = 0;
            car.physics.velX = 0;
            car.physics.velY = 0;
        }
        if (player.physics) {
            player.physics.velX = 0;
            player.physics.velY = 0;
        }

        // Czyścimy wejście, by gracz nie szedł samoczynnie
        InputSystem.resetAll();

        EventBus.emit('vehicle_exited', { carId: car.id });
    },

    getControlledEntity() {
        return this.controlledEntity;
    }
};
