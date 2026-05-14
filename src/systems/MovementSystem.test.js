import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementSystem } from './MovementSystem.js';
import { World } from '../world/World.js';

// Mockowanie zależności
vi.mock('../world/World.js', () => ({
    World: {
        width: 1000,
        height: 1000,
        entities: []
    }
}));

describe('MovementSystem', () => {
    let mockEntity;

    beforeEach(() => {
        mockEntity = {
            id: 'e1',
            transform: { x: 100, y: 100, angle: 0 },
            physics: { velX: 0, velY: 0, friction: 0.5 }
        };
        
        World.entities = [mockEntity];
    });

    it('should update position based on velocity', () => {
        mockEntity.physics.velX = 10;
        mockEntity.physics.velY = 5;
        // Friction 0.5: 10*0.5 = 5, 5*0.5 = 2.5
        // x = 100 + 5 = 105, y = 100 + 2.5 = 102.5
        MovementSystem.update(0.1);
        
        expect(mockEntity.transform.x).toBe(105);
        expect(mockEntity.transform.y).toBe(102.5);
    });

    it('should stop movement if velocity falls below threshold', () => {
        mockEntity.physics.velX = 0.15;
        MovementSystem.update(0.1); // 0.15 * 0.5 = 0.075 < 0.1
        
        expect(mockEntity.physics.velX).toBe(0);
    });

    it('should respect world boundaries (clamped by WORLD_MARGIN)', () => {
        // Entity width = 20 → hw = 10, but WORLD_MARGIN = 50 takes over
        mockEntity.transform.width = 20;
        mockEntity.transform.height = 20;
        const margin = 50; // WORLD_MARGIN

        mockEntity.transform.x = 5;
        mockEntity.physics.velX = -10;
        MovementSystem.update(0.1);
        expect(mockEntity.transform.x).toBe(margin);
        expect(mockEntity.physics.velX).toBe(0);

        mockEntity.transform.x = 995;
        mockEntity.physics.velX = 10;
        MovementSystem.update(0.1);
        expect(mockEntity.transform.x).toBe(1000 - margin);
        expect(mockEntity.physics.velX).toBe(0);
    });

    it('should reset speed on boundary collision for vehicles', () => {
        mockEntity.type = 'car';
        mockEntity.transform.width = 20;
        mockEntity.transform.height = 20;
        mockEntity.physics.speed = 500;
        mockEntity.transform.x = 2;
        mockEntity.physics.velX = -10;
        MovementSystem.update(0.1);
        expect(mockEntity.physics.speed).toBe(0);
    });

    // --- TESTY REGRESYJNE ---

    it('[REGRESJA] player speed powinno być zachowane po uderzeniu w granicę mapy', () => {
        // Gracz pieszo: physics.speed to stała bazowa prędkości (np. 100),
        // NIE powinna być zerowana przez granicę. Bez tej naprawy gracz
        // trwale traci zdolność ruchu po pierwszym kontakcie ze ścianą.
        mockEntity.type = 'player';
        mockEntity.transform.width = 20;
        mockEntity.transform.height = 20;
        mockEntity.physics.speed = 100; // bazowa prędkość gracza

        mockEntity.transform.x = 5;    // za granicą (WORLD_MARGIN = 50)
        mockEntity.physics.velX = -20;
        MovementSystem.update(0.1);

        expect(mockEntity.transform.x).toBe(50);   // wciągnięty do marginesu
        expect(mockEntity.physics.velX).toBe(0);    // velX skierowany w ścianę = 0
        expect(mockEntity.physics.speed).toBe(100); // speed NIE zerowane — gracz może dalej chodzić
    });

    it('[REGRESJA] player może się poruszać po powrocie od granicy mapy', () => {
        // Symulacja: gracz uderza w ścianę i w kolejnej klatce dostaje velX od input
        mockEntity.type = 'player';
        mockEntity.transform.width = 20;
        mockEntity.transform.height = 20;
        mockEntity.physics.speed = 100;

        // Klatka 1: uderzenie w lewą ścianę
        mockEntity.transform.x = 5;
        mockEntity.physics.velX = -20;
        MovementSystem.update(0.1);
        expect(mockEntity.transform.x).toBe(50);
        expect(mockEntity.physics.speed).toBe(100);

        // Klatka 2: input daje prędkość w prawo — gracz powinien ruszyć
        mockEntity.physics.velX = 10;
        const xBefore = mockEntity.transform.x;
        MovementSystem.update(0.1);
        expect(mockEntity.transform.x).toBeGreaterThan(xBefore); // gracz się poruszył
    });
});
