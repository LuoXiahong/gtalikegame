/**
 * Camera jako osobny byt
 * Render nie liczy już offsetów ręcznie wszędzie.
 */
export const Camera = {
    x: 0,
    y: 0,
    width: 800,
    height: 600,

    follow(entity) {
        if (entity && entity.transform) {
            this.x = this.width / 2 - entity.transform.x;
            this.y = this.height / 2 - entity.transform.y;
        }
    }
};
