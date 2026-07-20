import { EventBus } from '../core/EventBus.js';

/**
 * Shared camera offset so render code does not recompute it ad hoc.
 */
export const Camera = {
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    _needsSnap: false,

    init() {
        EventBus.on('vehicle_entered', () => {
            this._needsSnap = true;
        });
        EventBus.on('vehicle_exited', () => {
            this._needsSnap = true;
        });
    },

    follow(entity, dt) {
        if (entity && entity.transform) {
            const targetX = this.width / 2 - entity.transform.x;
            const targetY = this.height / 2 - entity.transform.y;

            if (this._needsSnap) {
                this.x = targetX;
                this.y = targetY;
                this._needsSnap = false;
                return;
            }

            // Higher = snappier follow
            const smoothing = 6.0; 
            
            this.x += (targetX - this.x) * Math.min(1, smoothing * dt);
            this.y += (targetY - this.y) * Math.min(1, smoothing * dt);
        }
    }
};
