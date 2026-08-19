/**
 * Proximity prompts, vehicle enter/exit, on-foot gunshot/explosion input.
 */
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { InputSystem } from '../input/InputManager.js';
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
        EventBus.on(EVENTS.LOCALE_CHANGE, () => {
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
        const controlled = World.getControlled();

        // Shoot / explode only while on foot (for now)
        if (controlled && controlled.type === 'player') {
            if (isShootPressed) {
                EventBus.emit(EVENTS.GUNSHOT, { x: p.transform.x, y: p.transform.y });
                EventBus.emit(EVENTS.AUDIO_PLAY, 'gunshot');
            }
            if (isExplodePressed) {
                EventBus.emit(EVENTS.EXPLOSION, {
                    x: p.transform.x,
                    y: p.transform.y,
                    radius: GameConfig.AI.EXPLOSION_DEFAULT_RADIUS
                });
                EventBus.emit(EVENTS.AUDIO_PLAY, 'explosion');
            }
        }

        if (controlled && controlled.type === 'car') {
            if (isActionPressed) {
                EventBus.emit(EVENTS.EXIT_VEHICLE, { player: p });
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
            EventBus.emit(EVENTS.PLAYER_NEAR_NPC, { npcId: nearNPCId });
        }
        this.lastNearNPC = nearNPCId;

        const dialogue = nearNPCId ? I18n.t('interact.npcHello') : null;
        if (dialogue !== this.lastDialogue) {
            EventBus.emit(EVENTS.UI_SHOW_DIALOGUE, dialogue);
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
                EventBus.emit(EVENTS.PLAYER_NEAR_CAR, { carId: carInZone.id });
                this.lastNearCar = carInZone.id;
            }
            const hint = I18n.t('interact.enterVehicle');
            if (hint !== this.lastHint) {
                EventBus.emit(EVENTS.UI_SHOW_ACTION_HINT, hint);
                this.lastHint = hint;
            }
            if (isActionPressed) {
                EventBus.emit(EVENTS.ENTER_VEHICLE, { player: p, car: carInZone });
            }
        } else {
            this.lastNearCar = null;
            if (this.lastHint !== null) {
                EventBus.emit(EVENTS.UI_SHOW_ACTION_HINT, null);
                this.lastHint = null;
            }
        }
    }
};
