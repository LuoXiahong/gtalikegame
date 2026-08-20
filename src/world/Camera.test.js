import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Camera, ZOOM_LEVELS, DEFAULT_ZOOM_INDEX } from './Camera.js';
import { EventBus } from '../core/EventBus.js';
import { World } from './World.js';
import { InputSystem } from '../input/InputManager.js';

vi.mock('./World.js', () => ({
    World: {
        getControlled: vi.fn()
    }
}));

vi.mock('../input/InputManager.js', () => ({
    InputSystem: {
        consumeZoomToggle: vi.fn(() => false)
    }
}));

describe('Camera', () => {
    let mockPlayer;
    let mockCar;

    beforeEach(() => {
        vi.clearAllMocks();

        Camera.x = 0;
        Camera.y = 0;
        Camera.width = 800;
        Camera.height = 600;
        Camera.focusX = 1100;
        Camera.focusY = 1100;
        Camera.zoomIndex = DEFAULT_ZOOM_INDEX;
        Camera.zoom = ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
        Camera.lookAheadX = 0;
        Camera.lookAheadY = 0;
        Camera._needsSnap = false;

        mockPlayer = { type: 'player', transform: { x: 1000, y: 1000, angle: 0 } };
        mockCar = {
            type: 'car',
            transform: { x: 1000, y: 1000, angle: 0 },
            physics: { speed: 300 }
        };
        World.getControlled.mockReturnValue(mockPlayer);
    });

    describe('2D screen-offset follow', () => {
        it('should follow target with smoothing when _needsSnap is false', () => {
            Camera.update(0.1);

            // targetX = 400 - 1000 = -600
            // targetY = 300 - 1000 = -700
            // with smoothing = 6, dt = 0.1, lerp factor is 0.6
            // Camera.x should be 0 + (-600 - 0) * 0.6 = -360
            expect(Camera.x).toBeCloseTo(-360);
            expect(Camera.y).toBeCloseTo(-420);
            expect(Camera._needsSnap).toBe(false);
        });

        it('should snap directly to target when _needsSnap is true', () => {
            Camera._needsSnap = true;
            Camera.update(0.1);

            expect(Camera.x).toBe(-600);
            expect(Camera.y).toBe(-700);
            expect(Camera._needsSnap).toBe(false); // resets flag
        });

        it('should set _needsSnap when vehicle enter/exit events occur', () => {
            Camera.init();

            Camera._needsSnap = false;
            EventBus.emit('vehicle_entered', { carId: 'car1' });
            expect(Camera._needsSnap).toBe(true);

            Camera._needsSnap = false;
            EventBus.emit('vehicle_exited', { carId: 'car1' });
            expect(Camera._needsSnap).toBe(true);
        });

        it('should do nothing when nothing is controlled', () => {
            World.getControlled.mockReturnValue(null);
            Camera.update(0.1);

            expect(Camera.x).toBe(0);
            expect(Camera.y).toBe(0);
        });
    });

    describe('3D zoom', () => {
        it('should cycle zoomIndex when the zoom-toggle input is consumed', () => {
            InputSystem.consumeZoomToggle.mockReturnValueOnce(true);
            Camera.update(1 / 60);
            expect(Camera.zoomIndex).toBe((DEFAULT_ZOOM_INDEX + 1) % ZOOM_LEVELS.length);
        });

        it('should not read input directly on the render side — only Camera consumes it', () => {
            // Regression for C1: InputSystem.consumeZoomToggle must be called
            // exactly once per Camera.update(), not from inside a renderer.
            Camera.update(1 / 60);
            expect(InputSystem.consumeZoomToggle).toHaveBeenCalledTimes(1);
        });

        it('should zoom out toward the target as a controlled car speeds up', () => {
            World.getControlled.mockReturnValue(mockCar);
            const before = Camera.zoom;
            for (let i = 0; i < 60; i++) Camera.update(1 / 60);
            expect(Camera.zoom).toBeLessThan(before);
        });

        it('should not zoom based on speed for an on-foot player', () => {
            const before = Camera.zoom;
            for (let i = 0; i < 60; i++) Camera.update(1 / 60);
            expect(Camera.zoom).toBeCloseTo(before);
        });
    });

    describe('3D speed look-ahead', () => {
        it('should push the focus ahead of a fast-moving controlled car', () => {
            World.getControlled.mockReturnValue(mockCar);
            for (let i = 0; i < 200; i++) Camera.update(1 / 60);

            expect(Camera.lookAheadX).toBeGreaterThan(0);
            expect(Camera.focusX).toBeGreaterThan(mockCar.transform.x);
        });

        it('should not look ahead for a stationary car', () => {
            World.getControlled.mockReturnValue({ ...mockCar, physics: { speed: 0 } });
            for (let i = 0; i < 30; i++) Camera.update(1 / 60);

            expect(Camera.lookAheadX).toBeCloseTo(0);
            expect(Camera.focusX).toBeCloseTo(mockCar.transform.x);
        });

        it('should not look ahead for an on-foot player even when facing a direction', () => {
            for (let i = 0; i < 30; i++) Camera.update(1 / 60);
            expect(Camera.lookAheadX).toBeCloseTo(0);
            expect(Camera.lookAheadY).toBeCloseTo(0);
        });
    });

    describe('freezeZoomAndLookAhead (screenshot mode)', () => {
        it('holds zoom and look-ahead static while position still tracks the controlled entity', () => {
            World.getControlled.mockReturnValue(mockCar);
            const frozenZoom = Camera.zoom;
            const frozenLookAheadX = Camera.lookAheadX;

            for (let i = 0; i < 60; i++) {
                Camera.update(1 / 60, { freezeZoomAndLookAhead: true });
            }

            expect(Camera.zoom).toBe(frozenZoom);
            expect(Camera.lookAheadX).toBe(frozenLookAheadX);
            // Base focus still tracks the entity even though look-ahead is frozen at 0.
            expect(Camera.focusX).toBe(mockCar.transform.x);
        });
    });
});
