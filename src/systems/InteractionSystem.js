/**
 * Proximity prompts, vehicle enter/exit, on-foot gunshot/explosion input.
 */
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';
import { InputSystem } from '../input/InputManager.js';
import { VehicleSystem } from './VehicleSystem.js';
import { GameConfig } from '../core/GameConfig.js';
import { I18n } from '../i18n/I18n.js';

export const InteractionSystem = {
    lastDialogue: undefined,
    lastHint: undefined,
    lastNearNPC: undefined,
    lastNearCar: undefined,
    _localeBound: false,

    reset() {
        this.lastDialogue = undefined;
        this.lastHint = undefined;
        this.lastNearNPC = undefined;
        this.lastNearCar = undefined;
    },

    _ensureLocaleListener() {
        if (this._localeBound) return;
        this._localeBound = true;
        EventBus.on('locale_change', () => {
            this.lastDialogue = undefined;
            this.lastHint = undefined;
        });
    },

    update() {
        this._ensureLocaleListener();
        const players = World.getEntitiesByType('player');
        if (players.length === 0) return;
        const p = players[0];

        const isActionPressed = InputSystem.consumeAction();
        const isShootPressed = InputSystem.consumeShoot();
        const isExplodePressed = InputSystem.consumeExplode();
        const controlled = VehicleSystem.getControlledEntity();

        // Shoot / explode only while on foot (for now)
        if (controlled && controlled.type === 'player') {
            if (isShootPressed) {
                EventBus.emit('gunshot', { x: p.transform.x, y: p.transform.y });
                EventBus.emit('audio_play', 'gunshot');
            }
            if (isExplodePressed) {
                EventBus.emit('explosion', {
                    x: p.transform.x,
                    y: p.transform.y,
                    radius: GameConfig.AI.EXPLOSION_DEFAULT_RADIUS
                });
                EventBus.emit('audio_play', 'explosion');
            }
        }

        if (controlled && controlled.type === 'car') {
            if (isActionPressed) {
                EventBus.emit('exit_vehicle', { player: p });
            }
            return;
        }

        const npcs = World.getEntitiesByType('npc');
        let nearNPCId = null;

        npcs.forEach(npc => {
            const dx = p.transform.x - npc.transform.x;
            const dy = p.transform.y - npc.transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < p.interactionRadius) {
                nearNPCId = npc.id;
            }
        });

        if (nearNPCId && nearNPCId !== this.lastNearNPC) {
            EventBus.emit('player_near_npc', { npcId: nearNPCId });
        }
        this.lastNearNPC = nearNPCId;

        const dialogue = nearNPCId ? I18n.t('interact.npcHello') : null;
        if (dialogue !== this.lastDialogue) {
            EventBus.emit('ui_show_dialogue', dialogue);
            this.lastDialogue = dialogue;
        }

        const cars = World.getEntitiesByType('car');
        let carInZone = null;
        let nearestCarDist = Infinity;

        cars.forEach(car => {
            const dx = p.transform.x - car.transform.x;
            const dy = p.transform.y - car.transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < GameConfig.INTERACTION.VEHICLE_RADIUS && dist < nearestCarDist) {
                carInZone = car;
                nearestCarDist = dist;
            }
        });

        if (carInZone) {
            if (carInZone.id !== this.lastNearCar) {
                EventBus.emit('player_near_car', { carId: carInZone.id });
                this.lastNearCar = carInZone.id;
            }
            const hint = I18n.t('interact.enterVehicle');
            if (hint !== this.lastHint) {
                EventBus.emit('ui_show_action_hint', hint);
                this.lastHint = hint;
            }
            if (isActionPressed) {
                EventBus.emit('enter_vehicle', { player: p, car: carInZone });
            }
        } else {
            this.lastNearCar = null;
            if (this.lastHint !== null) {
                EventBus.emit('ui_show_action_hint', null);
                this.lastHint = null;
            }
        }
    }
};
