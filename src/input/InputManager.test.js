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

    it('should trigger debugAIJustPressed on Backquote keydown', () => {
        InputSystem.setKey('Backquote', true);
        expect(InputSystem.keys.debugAI).toBe(true);
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

    it('should trigger screenshotJustPressed on F9 keydown', () => {
        InputSystem.setKey('F9', true);
        expect(InputSystem.keys.screenshot).toBe(true);
        expect(InputSystem.screenshotJustPressed).toBe(true);

        const consumed = InputSystem.consumeScreenshot();
        expect(consumed).toBe(true);
        expect(InputSystem.screenshotJustPressed).toBe(false);
    });

    it('should set handbrake state on ShiftLeft/ShiftRight keydown/keyup', () => {
        InputSystem.setKey('ShiftLeft', true);
        expect(InputSystem.keys.handbrake).toBe(true);

        InputSystem.setKey('ShiftLeft', false);
        expect(InputSystem.keys.handbrake).toBe(false);

        InputSystem.setKey('ShiftRight', true);
        expect(InputSystem.keys.handbrake).toBe(true);
    });

    it('should set sprint alongside handbrake on Shift (vehicle vs on-foot context)', () => {
        InputSystem.setKey('ShiftLeft', true);
        expect(InputSystem.keys.sprint).toBe(true);

        InputSystem.setKey('ShiftLeft', false);
        expect(InputSystem.keys.sprint).toBe(false);
    });
});
