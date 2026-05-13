import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputSystem } from './InputManager.js';

describe('InputSystem', () => {
    beforeEach(() => {
        InputSystem.resetAll();
    });

    it('should set right steering state on ArrowRight keydown/keyup', () => {
        InputSystem.setKey('ArrowRight', true);
        expect(InputSystem.keys.right).toBe(true);

        InputSystem.setKey('ArrowRight', false);
        expect(InputSystem.keys.right).toBe(false);
    });

    it('should trigger debugAIJustPressed on KeyD keydown', () => {
        InputSystem.setKey('KeyD', true);
        expect(InputSystem.keys.right).toBe(true);
        expect(InputSystem.debugAIJustPressed).toBe(true);

        // consume should return true and reset it
        const consumed = InputSystem.consumeDebugAI();
        expect(consumed).toBe(true);
        expect(InputSystem.debugAIJustPressed).toBe(false);
    });

    it('should reset all states on resetAll', () => {
        InputSystem.setKey('KeyD', true);
        InputSystem.resetAll();
        expect(InputSystem.keys.right).toBe(false);
        expect(InputSystem.debugAIJustPressed).toBe(false);
    });

    it('should trigger zoomToggleJustPressed on KeyZ keydown', () => {
        InputSystem.setKey('KeyZ', true);
        expect(InputSystem.keys.zoomToggle).toBe(true);
        expect(InputSystem.zoomToggleJustPressed).toBe(true);

        const consumed = InputSystem.consumeZoomToggle();
        expect(consumed).toBe(true);
        expect(InputSystem.zoomToggleJustPressed).toBe(false);
    });
});
