/**
 * System Poziomu Poszukiwań (WantedSystem)
 */
import { EventBus } from '../core/EventBus.js';
import { Time } from '../core/Time.js';

export const WantedSystem = {
    stars: 0,
    maxStars: 5,
    timer: 0,
    resetTime: 10, // sekundy do utraty 1 gwiazdki
    lastIncidentTime: 0,

    init() {
        this.reset();
        if (this._onNpcHit) EventBus.off('npc_hit', this._onNpcHit);
        this._onNpcHit = () => {
            this.handleIncident();
        };
        EventBus.on('npc_hit', this._onNpcHit);
    },

    reset() {
        this.stars = 0;
        this.timer = 0;
        this.lastIncidentTime = -9999;
    },

    handleIncident() {
        // Debounce: zabezpieczenie przed nabijaniem max gwiazdek w 1 klatce
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
