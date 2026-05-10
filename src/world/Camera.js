/**
 * Camera jako osobny byt
 * Render nie liczy już offsetów ręcznie wszędzie.
 */
export const Camera = {
    x: 0,
    y: 0,
    width: 800,
    height: 600,

    follow(entity, dt) {
        if (entity && entity.transform) {
            const targetX = this.width / 2 - entity.transform.x;
            const targetY = this.height / 2 - entity.transform.y;

            // Prędkość wygładzania - im wyższa, tym szybciej kamera nadąża
            const smoothing = 6.0; 
            
            // Liniowa interpolacja (lerp) pozycji kamery
            this.x += (targetX - this.x) * Math.min(1, smoothing * dt);
            this.y += (targetY - this.y) * Math.min(1, smoothing * dt);
        }
    }
};
