import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VehicleSystem } from './VehicleSystem.js';
import { EventBus } from '../core/EventBus.js';
import { InputSystem } from '../input/InputManager.js';

vi.mock('../core/EventBus.js', () => ({
    EventBus: {
        emit: vi.fn(),
        on: vi.fn()
    }
}));

vi.mock('../input/InputManager.js', () => ({
    InputSystem: {
        resetAll: vi.fn(),
        keys: { up: false, down: false, left: false, right: false, action: false, shoot: false, explode: false }
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
            physics: { speed: 10, velX: 10, velY: 10 },
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
        expect(mockCar.physics.speed).toBe(0);
        expect(mockCar.physics.velX).toBe(0);
        expect(mockCar.physics.velY).toBe(0);
        expect(InputSystem.resetAll).toHaveBeenCalled();
        expect(EventBus.emit).toHaveBeenCalledWith('vehicle_entered', { carId: mockCar.id });
    });

    it('should exit vehicle correctly', () => {
        VehicleSystem.init(mockPlayer);
        VehicleSystem.enterVehicle({ player: mockPlayer, car: mockCar });
        
        // Ustaw prędkość auta w trakcie sterowania
        mockCar.physics.speed = 20;
        mockCar.physics.velX = 15;
        mockCar.physics.velY = 15;

        VehicleSystem.exitVehicle({ player: mockPlayer });

        expect(VehicleSystem.getControlledEntity()).toBe(mockPlayer);
        expect(mockCar.occupied).toBe(false);
        expect(mockCar.occupantId).toBe(null);
        expect(mockPlayer.visible).toBe(true);
        expect(mockCar.physics.speed).toBe(0);
        expect(mockCar.physics.velX).toBe(0);
        expect(mockCar.physics.velY).toBe(0);
        expect(mockPlayer.physics.velX).toBe(0);
        expect(mockPlayer.physics.velY).toBe(0);
        expect(InputSystem.resetAll).toHaveBeenCalledTimes(2); // raz przy enter, raz przy exit
        
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
