/**
 * Enter/exit vehicle ownership and control handoff.
 */
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { InputSystem } from '../input/InputManager.js';

export const VehicleSystem = {
    controlledEntity: null,

    init(player) {
        this.controlledEntity = player;
        player.controlled = true;

        if (this._onEnter) EventBus.off(EVENTS.ENTER_VEHICLE, this._onEnter);
        if (this._onExit) EventBus.off(EVENTS.EXIT_VEHICLE, this._onExit);

        this._onEnter = (data) => this.enterVehicle(data);
        this._onExit = (data) => this.exitVehicle(data);

        EventBus.on(EVENTS.ENTER_VEHICLE, this._onEnter);
        EventBus.on(EVENTS.EXIT_VEHICLE, this._onExit);
    },

    enterVehicle({ player, car }) {
        if (!car || car.occupied) return;

        if (this.controlledEntity) this.controlledEntity.controlled = false;
        this.controlledEntity = car;
        car.controlled = true;
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

        EventBus.emit(EVENTS.VEHICLE_ENTERED, { carId: car.id });
        EventBus.emit(EVENTS.UI_SHOW_ACTION_HINT, null);
    },

    exitVehicle({ player }) {
        const car = this.controlledEntity;
        if (!car || car.type !== 'car') return;

        car.controlled = false;
        this.controlledEntity = player;
        player.controlled = true;
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

        EventBus.emit(EVENTS.VEHICLE_EXITED, { carId: car.id });
    },

    getControlledEntity() {
        return this.controlledEntity;
    }
};
