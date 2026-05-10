import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VehicleSystem } from './VehicleSystem.js';
import { EventBus } from '../core/EventBus.js';

vi.mock('../core/EventBus.js', () => ({
    EventBus: {
        emit: vi.fn(),
        on: vi.fn()
    }
}));

describe('VehicleSystem', () => {
    let mockPlayer;
    let mockCar;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPlayer = {
            id: 'p1',
            type: 'player',
            transform: { x: 0, y: 0 },
            physics: { velX: 10, velY: 10 },
            visible: true
        };
        mockCar = {
            id: 'c1',
            type: 'car',
            transform: { x: 100, y: 100, width: 90, height: 45 },
            occupied: false,
            occupantId: null
        };
    });

    it('should initialize with player as controlled entity', () => {
        VehicleSystem.init(mockPlayer);
        expect(VehicleSystem.getControlledEntity()).toBe(mockPlayer);
    });

    it('should enter vehicle correctly', () => {
        VehicleSystem.init(mockPlayer);
        VehicleSystem.enterVehicle({ player: mockPlayer, car: mockCar });

        expect(VehicleSystem.getControlledEntity()).toBe(mockCar);
        expect(mockCar.occupied).toBe(true);
        expect(mockCar.occupantId).toBe(mockPlayer.id);
        expect(mockPlayer.visible).toBe(false);
        expect(mockPlayer.physics.velX).toBe(0);
        expect(mockPlayer.physics.velY).toBe(0);
        expect(EventBus.emit).toHaveBeenCalledWith('vehicle_entered', { carId: mockCar.id });
    });

    it('should exit vehicle correctly', () => {
        VehicleSystem.init(mockPlayer);
        VehicleSystem.enterVehicle({ player: mockPlayer, car: mockCar });
        VehicleSystem.exitVehicle({ player: mockPlayer });

        expect(VehicleSystem.getControlledEntity()).toBe(mockPlayer);
        expect(mockCar.occupied).toBe(false);
        expect(mockCar.occupantId).toBe(null);
        expect(mockPlayer.visible).toBe(true);
        
        // Sprawdź pozycję gracza po wyjściu (obok auta)
        expect(mockPlayer.transform.x).toBe(mockCar.transform.x + mockCar.transform.width / 2 + 30);
        expect(EventBus.emit).toHaveBeenCalledWith('vehicle_exited', { carId: mockCar.id });
    });

    it('should not enter if car is already occupied', () => {
        mockCar.occupied = true;
        VehicleSystem.init(mockPlayer);
        VehicleSystem.enterVehicle({ player: mockPlayer, car: mockCar });

        expect(VehicleSystem.getControlledEntity()).toBe(mockPlayer);
    });
});
