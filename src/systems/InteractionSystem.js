/**
 * System interakcji (InteractionSystem)
 */
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';
import { InputSystem } from '../input/InputManager.js';
import { VehicleSystem } from './VehicleSystem.js';

export const InteractionSystem = {
    update() {
        const players = World.getEntitiesByType('player');
        if (players.length === 0) return;
        const p = players[0];

        const isActionPressed = InputSystem.consumeAction();
        const isShootPressed = InputSystem.consumeShoot();
        const controlled = VehicleSystem.getControlledEntity();

        // 1. Strzelanie (tylko pieszo na razie dla prostoty)
        if (controlled && controlled.type === 'player' && isShootPressed) {
            EventBus.emit('gunshot', { x: p.transform.x, y: p.transform.y });
            EventBus.emit('audio_play', 'gunshot');
        }

        // 2. Jeśli jesteśmy w aucie, sprawdź tylko wyjście
        if (controlled && controlled.type === 'car') {
            if (isActionPressed) {
                EventBus.emit('exit_vehicle', { player: p });
            }
            return;
        }

        const npcs = World.getEntitiesByType('npc');
        let npcInZone = false;

        npcs.forEach(npc => {
            const dx = p.transform.x - npc.transform.x;
            const dy = p.transform.y - npc.transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < p.interactionRadius) {
                npcInZone = true;
                EventBus.emit('player_near_npc', { npcId: npc.id });
            }
        });

        EventBus.emit('ui_show_dialogue', npcInZone ? 'NPC: Hej!' : null);

        const cars = World.getEntitiesByType('car');
        let carInZone = null;

        cars.forEach(car => {
            const dx = p.transform.x - car.transform.x;
            const dy = p.transform.y - car.transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 150) { // Zwiększony promień dla aut
                carInZone = car;
                EventBus.emit('player_near_car', { carId: car.id });
            }
        });

        if (carInZone) {
            EventBus.emit('ui_show_action_hint', 'Naciśnij F aby wsiąść');
            if (isActionPressed) {
                EventBus.emit('enter_vehicle', { player: p, car: carInZone });
            }
        } else {
            EventBus.emit('ui_show_action_hint', null);
        }
    }
};
