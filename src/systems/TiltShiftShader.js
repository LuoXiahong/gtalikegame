/**
 * TiltShiftShader
 * Shader post-processingu realizujący efekt makiety (Tilt-Shift).
 */
export const TiltShiftShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'blur': { value: 0.0004 },       // Maksymalny poziom rozmycia
        'focus': { value: 0.5 },        // Pionowy punkt skupienia (odpowiada środkowi rzutni z graczem)
        'falloff': { value: 0.28 }       // Szerokość ostrego paska wokół punktu skupienia
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
        varying vec2 vUv;

        void main() {
            // Oblicz odległość pionową od punktu skupienia
            float dist = abs(vUv.y - focus);
            
            // Oblicz siłę rozmycia na podstawie odległości i gwałtowności spadku ostrości (falloff)
            float blurAmount = smoothstep(falloff, falloff + 0.15, dist) * blur;
            
            // 9-punktowy diagonalny blur z bezpiecznym mapowaniem UV (zapobiega czarnym krawędziom)
            vec4 sum = vec4(0.0);
            
            #define SAMPLE(offset) texture2D(tDiffuse, clamp(vUv + (offset) * blurAmount, vec2(0.001), vec2(0.999)))
            
            sum += SAMPLE(vec2(-4.0, -4.0)) * 0.05;
            sum += SAMPLE(vec2(-3.0, -3.0)) * 0.09;
            sum += SAMPLE(vec2(-2.0, -2.0)) * 0.12;
            sum += SAMPLE(vec2(-1.0, -1.0)) * 0.15;
            sum += SAMPLE(vec2(0.0, 0.0)) * 0.18;
            sum += SAMPLE(vec2(1.0, 1.0)) * 0.15;
            sum += SAMPLE(vec2(2.0, 2.0)) * 0.12;
            sum += SAMPLE(vec2(3.0, 3.0)) * 0.09;
            sum += SAMPLE(vec2(4.0, 4.0)) * 0.05;
            
            gl_FragColor = sum;
        }
    `
};
