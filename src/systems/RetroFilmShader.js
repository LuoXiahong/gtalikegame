/**
 * Film-stock post effect (jitter, scratches, grain, vignette) tuned to keep characters readable:
 * mild sepia, soft contrast, lifted shadows.
 */
export const RetroFilmShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        intensity: { value: 1.0 },
        vignette: { value: 0.40 },
        flicker: { value: 0.25 },
        jitter: { value: 0.08 },
        grain: { value: 0.35 },
        scratches: { value: 0.40 },
        dust: { value: 0.0 },
        sepia: { value: 0.35 },
        contrast: { value: 0.15 },
        fps: { value: 18.0 },
        todDesaturation: { value: 0.0 },
        todTint: { value: [1.0, 1.0, 1.0] },
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
        uniform float time;
        uniform float intensity;
        uniform float vignette;
        uniform float flicker;
        uniform float jitter;
        uniform float grain;
        uniform float scratches;
        uniform float dust;
        uniform float sepia;
        uniform float contrast;
        uniform float fps;
        uniform float todDesaturation;
        uniform vec3 todTint;
        varying vec2 vUv;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float overlayChannel(float base, float blend) {
            return base < 0.5
                ? (2.0 * base * blend)
                : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
        }

        vec3 overlay(vec3 base, vec3 blend) {
            return vec3(
                overlayChannel(base.r, blend.r),
                overlayChannel(base.g, blend.g),
                overlayChannel(base.b, blend.b)
            );
        }

        void main() {
            vec4 raw = texture2D(tDiffuse, vUv);
            vec3 col = raw.rgb;

            if (intensity >= 0.001) {
            float i = intensity;
            float frame = floor(time * max(fps, 1.0));

            // Gate jitter
            float jAmt = jitter * i;
            float jx = (hash(vec2(frame, 1.71)) - 0.5) * jAmt * 0.022;
            float jy = (hash(vec2(frame, 9.33)) - 0.5) * jAmt * 0.013;
            float scaleJ = 1.0 + jAmt * 0.012;
            vec2 uv = (vUv - 0.5) / scaleJ + 0.5 + vec2(jx, jy);

            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, raw.a);
                return;
            }
            uv = clamp(uv, vec2(0.001), vec2(0.999));

            col = texture2D(tDiffuse, uv).rgb;

            // Warm tint only — keep character colors (max ~55% sepia mix)
            float sepMix = sepia * i * 0.55;
            float luma = dot(col, vec3(0.299, 0.587, 0.114));
            vec3 warm = vec3(luma * 1.05, luma * 0.98, luma * 0.82);
            col = mix(col, warm, sepMix);

            // Light desaturation so NPC/player hues survive
            float satAmt = mix(1.0, 0.85, sepia * i * 0.5);
            float l2 = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(l2), col, satAmt);

            // Soft contrast + shadow lift so blacks aren't crushed
            float cAmt = 1.0 + contrast * i * 0.45;
            col = (col - 0.5) * cAmt + 0.5;
            float lift = 0.10 * i * (0.55 + contrast * 0.25);
            col = col + lift * (1.0 - smoothstep(0.0, 0.45, col));
            col = clamp(col, 0.0, 1.0);

            // Shallow flicker; floor brightness so characters don't vanish
            float flick = 1.0 - flicker * i * hash(vec2(frame, 3.1)) * 0.28;
            if (hash(vec2(frame, 7.7)) < flicker * i * 0.08) {
                flick = 1.0 - flicker * i * 0.35;
            }
            flick = max(0.78, flick);
            col *= flick;

            if (grain > 0.001) {
                float n = hash(floor(uv * vec2(320.0, 240.0) + frame * 13.0));
                float v = 0.5 + (n * 2.0 - 1.0) * (100.0 / 255.0) * grain;
                float gAlpha = (0.12 + grain * 0.22) * i;
                col = mix(col, overlay(col, vec3(clamp(v, 0.0, 1.0))), gAlpha);
            }

            if (scratches > 0.001) {
                for (int n = 0; n < 8; n++) {
                    float nf = float(n);
                    float life = 1.0 + floor(hash(vec2(nf, 11.0)) * 3.0);
                    float lifeId = floor(frame / life);
                    float spawn = hash(vec2(nf * 3.7, lifeId));
                    if (spawn < scratches * 0.40) {
                        float sx = hash(vec2(nf * 5.1, lifeId + 0.3));
                        sx += (hash(vec2(frame, nf)) - 0.5) * 0.0015;
                        float wobble = 0.0004 + hash(vec2(nf, lifeId + 2.0)) * 0.0016;
                        float w = 0.00035 + hash(vec2(nf, 8.8)) * 0.0008;
                        float alpha = (0.10 + hash(vec2(nf, 2.2)) * 0.22)
                            * (0.3 + scratches * 0.4) * i;

                        float xLine = sx + sin(uv.y * 14.0 + sx * 30.0) * wobble;
                        float line = smoothstep(w * 1.8, 0.0, abs(uv.x - xLine));
                        vec3 scratchCol = hash(vec2(nf, 1.4)) < 0.7
                            ? vec3(0.78, 0.74, 0.66)
                            : vec3(0.08, 0.07, 0.06);
                        col = mix(col, scratchCol, line * alpha);
                    }
                }
            }

            if (dust > 0.001) {
                float cell = hash(floor(uv * 90.0) + frame);
                if (cell > 1.0 - dust * i * 0.03) {
                    if (hash(uv * 50.0 + frame) < 0.5) {
                        col = mix(col, vec3(0.08, 0.07, 0.06), 0.35 * dust * i);
                    }
                }
            }

            // Mild vignette — avoid killing the frame center
            float breathe = 0.85 + (1.0 - flick) * 0.35;
            float dist = length(vUv - 0.5) / 0.7071;
            float vig = smoothstep(0.42, 1.15, dist);
            col *= 1.0 - min(0.55, vig * vignette * 0.55 * breathe) * i;

            float wash = min(0.18, (1.0 - flick) * 0.35) * i;
            col *= 1.0 - wash;

            float edgeX = smoothstep(0.0, 0.006, vUv.x) * smoothstep(0.0, 0.006, 1.0 - vUv.x);
            float edgeY = smoothstep(0.0, 0.008, vUv.y) * smoothstep(0.0, 0.008, 1.0 - vUv.y);
            col *= mix(1.0, edgeX * edgeY, 0.45 * i);

            // Narrow sprocket strip — limited frame loss
            float strip = 0.022;
            if (vUv.x < strip || vUv.x > 1.0 - strip) {
                col *= 0.25;
                float holeY = fract(vUv.y * 9.0);
                float hole = step(0.30, holeY) * step(holeY, 0.70);
                float hx = vUv.x < 0.5 ? vUv.x / strip : (1.0 - vUv.x) / strip;
                float holeX = step(0.25, hx) * step(hx, 0.75);
                col = mix(col, vec3(0.0), hole * holeX * i);
            }

            col = mix(raw.rgb, clamp(col, 0.0, 1.0), i);
            }

            // Time-of-day cool grading — always applied (even when film intensity is 0)
            float luma = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(col, vec3(luma), todDesaturation);
            vec3 tinted = col * todTint;
            col = mix(col, tinted, min(1.0, todDesaturation * 0.65 + 0.12));

            gl_FragColor = vec4(clamp(col, 0.0, 1.0), raw.a);
        }
    `
};
