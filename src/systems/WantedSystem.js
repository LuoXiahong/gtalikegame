/**
 * Wanted-star level: rise on incidents, decay over time.
 */
import { EventBus } from '../core/EventBus.js';
import { Time } from '../core/Time.js';
import { PoliceSystem } from './PoliceSystem.js';

export const WantedSystem = {
    stars: 0,
    maxStars: 5,
    timer: 0,
    resetTime: 10, // seconds until one star drops
    lastIncidentTime: 0,

    init() {
        this.reset();
        if (this._onNpcHit) EventBus.off('npc_hit', this._onNpcHit);
        if (this._onGunshot) EventBus.off('gunshot', this._onGunshot);
        if (this._onExplosion) EventBus.off('explosion', this._onExplosion);

        this._onNpcHit = () => {
            this.handleIncident();
        };
        EventBus.on('npc_hit', this._onNpcHit);

        this._onGunshot = () => {
            this.handleIncident();
        };
        EventBus.on('gunshot', this._onGunshot);

        this._onExplosion = () => {
            this.handleIncident();
        };
        EventBus.on('explosion', this._onExplosion);
    },

    reset() {
        const hadStars = this.stars > 0;
        this.stars = 0;
        this.timer = 0;
        this.lastIncidentTime = -9999;
        if (hadStars) {
            EventBus.emit('wanted_reset');
        }
    },

    handleIncident() {
        // Debounce: avoid maxing stars in a single frame
        if (Time.time - this.lastIncidentTime > 1.0) {
            if (this.stars < this.maxStars) {
                this.stars++;
            }
            this.lastIncidentTime = Time.time;
            this.timer = this.resetTime;
            EventBus.emit('wanted_level_change', { stars: this.stars });
        }
    },

    update(dt) {
        if (this.stars > 0) {
            if (PoliceSystem.isActive) return;
            this.timer -= dt;
            if (this.timer <= 0) {
                this.stars--;
                if (this.stars > 0) {
                    this.timer = this.resetTime;
                } else {
                    this.timer = 0;
                }

                EventBus.emit('wanted_level_change', { stars: this.stars });
                if (this.stars === 0) {
                    EventBus.emit('wanted_reset');
                }
            }
        }
    }
};
