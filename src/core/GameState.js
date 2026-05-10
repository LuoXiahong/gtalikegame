/**
 * CORE: GameState
 * Zarządza stanami aplikacji (Menu, Gra, Koniec gry).
 */
import { EventBus } from './EventBus.js';

export const GAME_STATES = {
    MENU: 'MENU',
    PLAY: 'PLAY',
    MISSION_PASSED: 'MISSION_PASSED',
    WASTED: 'WASTED'
};

let currentState = null;

export const GameState = {
    getState() {
        return currentState;
    },

    setState(newState) {
        if (!GAME_STATES[newState]) {
            console.error(`Attempted to set invalid state: ${newState}`);
            return;
        }

        if (currentState === newState) return;

        const oldState = currentState;
        currentState = newState;

        EventBus.emit('state_change', { 
            from: oldState, 
            to: currentState 
        });
    }
};
