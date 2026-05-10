import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState, GAME_STATES } from './GameState.js';
import { EventBus } from './EventBus.js';

describe('GameState', () => {
    beforeEach(() => {
        // Reset state to MENU before each test
        GameState.setState(GAME_STATES.MENU);
        vi.clearAllMocks();
    });

    it('should have initial state MENU', () => {
        expect(GameState.getState()).toBe(GAME_STATES.MENU);
    });

    it('should change state and emit event', () => {
        const spy = vi.spyOn(EventBus, 'emit');
        
        GameState.setState(GAME_STATES.PLAY);
        
        expect(GameState.getState()).toBe(GAME_STATES.PLAY);
        expect(spy).toHaveBeenCalledWith('state_change', {
            from: GAME_STATES.MENU,
            to: GAME_STATES.PLAY
        });
    });

    it('should not emit event if state is the same', () => {
        const spy = vi.spyOn(EventBus, 'emit');
        
        GameState.setState(GAME_STATES.MENU);
        
        expect(spy).not.toHaveBeenCalled();
    });

    it('should not change to invalid state', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        GameState.setState('INVALID_STATE');
        
        expect(GameState.getState()).toBe(GAME_STATES.MENU);
        expect(spy).toHaveBeenCalled();
        
        spy.mockRestore();
    });
});
