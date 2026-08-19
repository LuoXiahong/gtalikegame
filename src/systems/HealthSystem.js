/**
 * HP and damage: vehicle hit-and-runs, gunshots, explosions.
 * Reduces health on the entity's own `health` component; on death,
 * NPCs are removed from the world and the player triggers GAME_STATES.WASTED.
 */
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { GameConfig } from '../core/GameConfig.js';
import { GameState, GAME_STATES } from '../core/GameState.js';

export const HealthSystem = {
    init() {
        if (this._onNpcHit) EventBus.off(EVENTS.NPC_HIT, this._onNpcHit);
        if (this._onGunshot) EventBus.off(EVENTS.GUNSHOT, this._onGunshot);
        if (this._onExplosion) EventBus.off(EVENTS.EXPLOSION, this._onExplosion);

        this._onNpcHit = ({ npc }) => {
            this.applyDamage(npc, GameConfig.HEALTH.VEHICLE_HIT_DAMAGE);
        };
        EventBus.on(EVENTS.NPC_HIT, this._onNpcHit);

        this._onGunshot = ({ x, y }) => {
            const target = this.nearestNPC(x, y, GameConfig.HEALTH.GUNSHOT_HIT_RADIUS);
            if (target) this.applyDamage(target, GameConfig.HEALTH.GUNSHOT_DAMAGE);
        };
        EventBus.on(EVENTS.GUNSHOT, this._onGunshot);

        this._onExplosion = ({ x, y, radius }) => {
            const targets = [...World.getEntitiesByType('npc'), ...World.getEntitiesByType('player')];
            targets.forEach(ent => {
                const dx = ent.transform.x - x;
                const dy = ent.transform.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= radius) return;

                const falloff = 1 - dist / radius;
                this.applyDamage(ent, GameConfig.HEALTH.EXPLOSION_MAX_DAMAGE * falloff);
            });
        };
        EventBus.on(EVENTS.EXPLOSION, this._onExplosion);
    },

    // Nearest living NPC to (x, y) within maxDist, or null.
    nearestNPC(x, y, maxDist) {
        let best = null;
        let bestDist = maxDist;

        World.getEntitiesByType('npc').forEach(npc => {
            if (!npc.health || npc.health.dead) return;
            const dx = npc.transform.x - x;
            const dy = npc.transform.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                best = npc;
            }
        });

        return best;
    },

    applyDamage(entity, amount) {
        if (!entity || !entity.health || entity.health.dead) return;

        entity.health.current = Math.max(0, entity.health.current - amount);

        if (entity.type === 'player') {
            EventBus.emit(EVENTS.HEALTH_CHANGE, { current: entity.health.current, max: entity.health.max });
        }

        if (entity.health.current <= 0) {
            entity.health.dead = true;

            if (entity.type === 'player') {
                EventBus.emit(EVENTS.PLAYER_KNOCKOUT, { entity });
                GameState.setState(GAME_STATES.WASTED);
            } else if (entity.type === 'npc') {
                EventBus.emit(EVENTS.NPC_KNOCKOUT, { entity });
                World.removeEntity(entity.id);
            }
        }
    }
};
