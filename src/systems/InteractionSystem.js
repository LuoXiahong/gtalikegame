/**
 * System interakcji (InteractionSystem)
 */
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';
import { InputSystem } from '../input/InputManager.js';
import { VehicleSystem } from './VehicleSystem.js';

export const InteractionSystem = {
    lastDialogue: undefined,
    lastHint: undefined,
    lastNearNPC: undefined,
    lastNearCar: undefined,

    reset() {
        this.lastDialogue = undefined;
        this.lastHint = undefined;
        this.lastNearNPC = undefined;
        this.lastNearCar = undefined;
    },

    update() {
        const players = World.getEntitiesByType('player');
        if (players.length === 0) return;
        const p = players[0];

        const isActionPressed = InputSystem.consumeAction();
        const isShootPressed = InputSystem.consumeShoot();
        const isExplodePressed = InputSystem.consumeExplode();
        const controlled = VehicleSystem.getControlledEntity();

        // 1. Strzelanie i Eksplozje (tylko pieszo na razie)
        if (controlled && controlled.type === 'player') {
            if (isShootPressed) {
                EventBus.emit('gunshot', { x: p.transform.x, y: p.transform.y });
                EventBus.emit('audio_play', 'gunshot');
            }
            if (isExplodePressed) {
                EventBus.emit('explosion', { x: p.transform.x, y: p.transform.y, radius: 1000 });
                EventBus.emit('audio_play', 'explosion');
            }
        }

        // 2. Jeśli jesteśmy w aucie, sprawdź tylko wyjście
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

        const dialogue = nearNPCId ? 'NPC: Hej!' : null;
        if (dialogue !== this.lastDialogue) {
            EventBus.emit('ui_show_dialogue', dialogue);
            this.lastDialogue = dialogue;
        }

        const cars = World.getEntitiesByType('car');
        let carInZone = null;

        cars.forEach(car => {
            const dx = p.transform.x - car.transform.x;
            const dy = p.transform.y - car.transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 150) { // Zwiększony promień dla aut
                carInZone = car;
            }
        });

        if (carInZone) {
            if (carInZone.id !== this.lastNearCar) {
                EventBus.emit('player_near_car', { carId: carInZone.id });
                this.lastNearCar = carInZone.id;
            }
            const hint = 'Naciśnij F aby wsiąść';
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
