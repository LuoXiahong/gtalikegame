import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UISystem } from './HUD.js';
import { EventBus } from '../core/EventBus.js';
import { GameState, GAME_STATES } from '../core/GameState.js';

vi.mock('../world/World.js', () => ({
    World: {
        getEntitiesByType: vi.fn(() => [{ transform: { x: 1000, y: 1000, angle: 0 } }]),
        buildings: []
    }
}));

vi.mock('../world/Tilemap.js', () => ({
    Tilemap: {
        cols: 30,
        rows: 30,
        data: Array(30).fill(0).map(() => Array(30).fill(0))
    },
    TILE_COLORS: { 0: '#27ae60' }
}));

vi.mock('../systems/VehicleSystem.js', () => ({
    VehicleSystem: {
        getControlledEntity: vi.fn(() => null)
    }
}));

describe('UISystem Speedometer & Minimap Logic', () => {
    let mockUiLayer;
    let mockMobileHUD;
    let mockMinimapCanvas;
    let mockMinimapCtx;

    beforeEach(() => {
        // Reset properties
        UISystem.speedValue = 0;
        UISystem.showSpeed = false;
        UISystem.wantedStars = 0;
        UISystem.missionText = '';
        UISystem.currentDialogue = null;

        // Mock document elements
        mockUiLayer = {
            style: { display: 'none' },
            innerHTML: ''
        };
        mockMobileHUD = {
            style: { display: 'none' }
        };
        mockMinimapCtx = {
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            scale: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn()
        };
        mockMinimapCanvas = {
            width: 130,
            height: 130,
            style: { display: 'none' },
            getContext: vi.fn(() => mockMinimapCtx)
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'uiLayer') return mockUiLayer;
                if (id === 'mobileHUD') return mockMobileHUD;
                if (id === 'minimap') return mockMinimapCanvas;
                return null;
            })
        });
    });

    it('should initialize and subscribe to vehicle and speed events', () => {
        UISystem.init();

        // 1. Enter vehicle -> should show speed
        EventBus.emit('vehicle_entered', { carId: 'car1' });
        expect(UISystem.showSpeed).toBe(true);
        expect(mockUiLayer.innerHTML).toContain('KM/H');

        // 2. Speed update -> should update speedValue
        EventBus.emit('speed_update', 500);
        expect(UISystem.speedValue).toBe(500);
        // kmh = Math.round(500 * 0.3) = 150
        expect(mockUiLayer.innerHTML).toContain('150 KM/H');

        // 3. Exit vehicle -> should hide speed and reset speedValue
        EventBus.emit('vehicle_exited', { carId: 'car1' });
        expect(UISystem.showSpeed).toBe(false);
        expect(UISystem.speedValue).toBe(0);
        expect(mockUiLayer.innerHTML).not.toContain('KM/H');
    });

    it('should draw minimap when updated in PLAY state', () => {
        UISystem.init();
        
        GameState.setState(GAME_STATES.PLAY);
        UISystem.update();

        expect(mockMinimapCtx.clearRect).toHaveBeenCalled();
        expect(mockMinimapCtx.save).toHaveBeenCalled();
        expect(mockMinimapCtx.restore).toHaveBeenCalled();
    });
});
