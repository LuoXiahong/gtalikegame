import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionSystem } from './InteractionSystem.js';
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';

vi.mock('../world/World.js', () => ({
    World: {
        getEntitiesByType: vi.fn()
    }
}));

vi.mock('../input/InputManager.js', () => ({
    InputSystem: {
        consumeAction: vi.fn(() => false),
        consumeShoot: vi.fn(() => false)
    }
}));

vi.mock('./VehicleSystem.js', () => ({
    VehicleSystem: {
        getControlledEntity: vi.fn(() => ({ type: 'player' }))
    }
}));

import { InputSystem } from '../input/InputManager.js';
import { VehicleSystem } from './VehicleSystem.js';

describe('InteractionSystem', () => {
    let mockPlayer;
    let mockNPC;
    let mockCar;

    beforeEach(() => {
        mockPlayer = {
            id: 'p1',
            transform: { x: 100, y: 100 },
            interactionRadius: 50
        };

        mockNPC = {
            id: 'npc1',
            transform: { x: 500, y: 500 } // far away
        };

        mockCar = {
            id: 'car1',
            transform: { x: 500, y: 500, width: 40, height: 40 } // far away
        };

        World.getEntitiesByType.mockImplementation((type) => {
            if (type === 'player') return [mockPlayer];
            if (type === 'npc') return [mockNPC];
            if (type === 'car') return [mockCar];
            return [];
        });

        vi.spyOn(EventBus, 'emit');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not emit near events when entities are far away', () => {
        InteractionSystem.update();
        expect(EventBus.emit).toHaveBeenCalledWith('ui_show_dialogue', null);
        expect(EventBus.emit).not.toHaveBeenCalledWith('player_near_npc', expect.anything());
        expect(EventBus.emit).not.toHaveBeenCalledWith('player_near_car', expect.anything());
    });

    it('should emit player_near_npc and show dialogue when close to NPC', () => {
        mockNPC.transform.x = 110;
        mockNPC.transform.y = 110; // dist ~ 14.1 < 50
        
        InteractionSystem.update();
        expect(EventBus.emit).toHaveBeenCalledWith('player_near_npc', { npcId: 'npc1' });
        expect(EventBus.emit).toHaveBeenCalledWith('ui_show_dialogue', 'NPC: Hej!');
    });

    it('should emit player_near_car when close to car', () => {
        // Car center will be at x+20, y+20. To be near player (100,100), car can be at 80,80 (center 100,100)
        mockCar.transform.x = 80;
        mockCar.transform.y = 80;
        
        InteractionSystem.update();
        expect(EventBus.emit).toHaveBeenCalledWith('player_near_car', { carId: 'car1' });
        expect(EventBus.emit).toHaveBeenCalledWith('ui_show_action_hint', 'Naciśnij F aby wsiąść');
    });

    it('should emit enter_vehicle when action is pressed near car', () => {
        mockCar.transform.x = 80;
        mockCar.transform.y = 80;
        InputSystem.consumeAction.mockReturnValue(true);
        
        InteractionSystem.update();
        expect(EventBus.emit).toHaveBeenCalledWith('enter_vehicle', { player: mockPlayer, car: mockCar });
    });
});
