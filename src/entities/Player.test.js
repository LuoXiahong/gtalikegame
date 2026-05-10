import { describe, it, expect } from 'vitest';
import { Player } from './Player.js';

describe('Player', () => {
    it('should initialize Player with correct components', () => {
        const p = new Player(100, 200);
        
        expect(p.id).toBe('player1');
        expect(p.type).toBe('player');
        expect(p.transform.x).toBe(100);
        expect(p.transform.y).toBe(200);
        
        // Sprawdzenie fizyki
        expect(p.physics).toBeDefined();
        expect(p.physics.speed).toBe(100);
        expect(p.physics.friction).toBe(0.5);
        
        // Sprawdzenie visual
        expect(p.visual.color).toBe('#e74c3c');
        
        // Sprawdzenie specyficznych właściwości gracza
        expect(p.interactionRadius).toBe(120);
    });
});
