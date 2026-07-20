/**
 * Enter/exit vehicle ownership and control handoff.
 */
import { EventBus } from '../core/EventBus.js';
import { InputSystem } from '../input/InputManager.js';

export const VehicleSystem = {
    controlledEntity: null,

    init(player) {
        this.controlledEntity = player;

        if (this._onEnter) EventBus.off('enter_vehicle', this._onEnter);
        if (this._onExit) EventBus.off('exit_vehicle', this._onExit);

        this._onEnter = (data) => this.enterVehicle(data);
        this._onExit = (data) => this.exitVehicle(data);

        EventBus.on('enter_vehicle', this._onEnter);
        EventBus.on('exit_vehicle', this._onExit);
    },

    enterVehicle({ player, car }) {
        if (!car || car.occupied) return;

        this.controlledEntity = car;
        car.occupied = true;
        car.occupantId = player.id;
        player.visible = false;

        if (player.physics) {
            player.physics.velX = 0;
            player.physics.velY = 0;
        }
        if (car.physics) {
            car.physics.speed = 0;
            car.physics.velX = 0;
            car.physics.velY = 0;
        }

        // Clear held keys so they don't transfer to the car.
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

        player.transform.x = car.transform.x + car.transform.width / 2 + 30;
        player.transform.y = car.transform.y;

        if (car.physics) {
            car.physics.speed = 0;
            car.physics.velX = 0;
            car.physics.velY = 0;
        }
        if (player.physics) {
            player.physics.velX = 0;
            player.physics.velY = 0;
        }

        // Traffic AI: retarget nearest segment for a smooth return (no teleport).
        if (car.ai && car.ai.type === 'traffic') {
            car.ai.needsRetarget = true;
            car.ai.vx = 0;
            car.ai.vy = 0;
            car.ai.currentSpeed = 0;
            car.ai.driftTimer = 0;
            car.ai.driftAngle = 0;
            car.ai.recovering = true;
        }

        // Clear held keys so the player doesn't walk on their own.
        InputSystem.resetAll();

        EventBus.emit('vehicle_exited', { carId: car.id });
    },

    getControlledEntity() {
        return this.controlledEntity;
    }
};
