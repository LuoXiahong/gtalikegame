import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthSystem } from './HealthSystem.js';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';
import { GameState, GAME_STATES } from '../core/GameState.js';
import { World } from '../world/World.js';
import { Player } from '../entities/Player.js';
import { NPC } from '../entities/NPC.js';

describe('HealthSystem', () => {
    let npc;
    let player;

    beforeEach(() => {
        EventBus.listeners = {};
        World.init();
        HealthSystem.init();

        npc = new NPC('npc1', 100, 100, '#aaa', [{ x: 100, y: 100 }]);
        player = new Player(0, 0);
        World.addEntity(npc);
        World.addEntity(player);
    });

    it('damages the npc on a vehicle hit-and-run', () => {
        EventBus.emit('npc_hit', { npc, car: {} });

        expect(npc.health.current).toBe(100 - GameConfig.HEALTH.VEHICLE_HIT_DAMAGE);
        expect(npc.health.dead).toBe(false);
    });

    it('knocks out and removes the npc once health reaches zero', () => {
        let knockedOut = null;
        EventBus.on('npc_knockout', ({ entity }) => { knockedOut = entity; });

        for (let i = 0; i < 4; i++) {
            EventBus.emit('npc_hit', { npc, car: {} });
        }

        expect(npc.health.current).toBe(0);
        expect(npc.health.dead).toBe(true);
        expect(knockedOut).toBe(npc);
        expect(World.getEntitiesByType('npc')).not.toContain(npc);
    });

    it('ignores further damage once the npc is already dead', () => {
        npc.health.current = 0;
        npc.health.dead = true;

        EventBus.emit('npc_hit', { npc, car: {} });

        expect(npc.health.current).toBe(0);
    });

    it('damages the nearest npc within range on gunshot', () => {
        EventBus.emit('gunshot', { x: 100, y: 100 });

        expect(npc.health.current).toBe(100 - GameConfig.HEALTH.GUNSHOT_DAMAGE);
    });

    it('ignores an npc outside the gunshot hit radius', () => {
        EventBus.emit('gunshot', { x: 100 + GameConfig.HEALTH.GUNSHOT_HIT_RADIUS * 2, y: 100 });

        expect(npc.health.current).toBe(100);
    });

    it('applies falling-off explosion damage by distance and hits the player too', () => {
        EventBus.emit('explosion', { x: 100, y: 100, radius: 200 });

        expect(npc.health.current).toBeLessThan(100);
        expect(player.health.current).toBeLessThan(100);
        // player at (0,0) is farther from the blast center than the npc at (0,0)... npc at blast center takes max damage
        expect(npc.health.current).toBeLessThanOrEqual(player.health.current);
    });

    it('emits health_change and sets GameState to WASTED when the player dies', () => {
        let emitted = null;
        EventBus.on('health_change', (data) => { emitted = data; });

        EventBus.emit('explosion', { x: 0, y: 0, radius: 1000 });

        expect(emitted).not.toBeNull();
        expect(player.health.dead).toBe(true);
        expect(GameState.getState()).toBe(GAME_STATES.WASTED);
    });
});
