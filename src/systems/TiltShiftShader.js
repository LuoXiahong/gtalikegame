/**
 * Miniaturization / tilt-shift post-process blur.
 * Strong edge falloff, sharp mid-band — diorama look (ref).
 */
export const TILT_SHIFT_BLUR = 0.005;
export const TILT_SHIFT_FOCUS = 0.5;
/** Half-width of the sharp band (UV). Narrower = more diorama. */
export const TILT_SHIFT_FALLOFF = 0.16;
/** Soft ramp from sharp → full blur (UV). */
export const TILT_SHIFT_SOFT = 0.28;

export const TiltShiftShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'blur': { value: TILT_SHIFT_BLUR },
        'focus': { value: TILT_SHIFT_FOCUS },
        'falloff': { value: TILT_SHIFT_FALLOFF },
        'soft': { value: TILT_SHIFT_SOFT }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float blur;
        uniform float focus;
        uniform float falloff;
        uniform float soft;
        varying vec2 vUv;

        void main() {
            float dist = abs(vUv.y - focus);
            // Ease-in ramp: mid band stays crisp; corners hit full blur hard
            float t = smoothstep(falloff, falloff + soft, dist);
            t = t * t;
            float blurAmount = t * blur;

            // Early-out keeps the focus strip unfiltered (no soft wash)
            if (blurAmount < 1e-6) {
                gl_FragColor = texture2D(tDiffuse, vUv);
                return;
            }

            // 13-tap cross + diagonal — readable soft edges without streaking
            vec4 sum = vec4(0.0);
            #define SAMPLE(ox, oy, w) texture2D(tDiffuse, clamp(vUv + vec2(ox, oy) * blurAmount, vec2(0.001), vec2(0.999))) * (w)

            sum += SAMPLE( 0.0,  0.0, 0.16);
            sum += SAMPLE( 1.0,  0.0, 0.09);
            sum += SAMPLE(-1.0,  0.0, 0.09);
            sum += SAMPLE( 0.0,  1.0, 0.09);
            sum += SAMPLE( 0.0, -1.0, 0.09);
            sum += SAMPLE( 2.5,  0.0, 0.06);
            sum += SAMPLE(-2.5,  0.0, 0.06);
            sum += SAMPLE( 0.0,  2.5, 0.06);
            sum += SAMPLE( 0.0, -2.5, 0.06);
            sum += SAMPLE( 2.0,  2.0, 0.06);
            sum += SAMPLE(-2.0,  2.0, 0.06);
            sum += SAMPLE( 2.0, -2.0, 0.06);
            sum += SAMPLE(-2.0, -2.0, 0.06);

            gl_FragColor = sum;
        }
    `
};
