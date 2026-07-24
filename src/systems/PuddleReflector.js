/**
 * PuddleReflector — readable scene reflections in hero puddles (rain only).
 *
 * No SSR. Per hero puddle:
 * 1. Soft water disc
 * 2. Squashed Y-flipped lamp ghost sitting in the disc (readable pole + globe)
 * 3. Small Reflector for planar bounce (fog disabled while capturing)
 */
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { CityBuilder3D } from './CityBuilder3D.js';

/** Intersection focus used by screenshots (2D px). */
export const HERO_INTERSECTION_2D = { x: 1100, z: 1100 };

/** How far from the lamp toward the street to place the puddle (world m). */
export const PUDDLE_LAMP_OFFSET = 3.0;

export const PUDDLE_RADIUS = 4.0;
export const PUDDLE_Y = 0.014;
/** Squash factor for the mirrored lamp (negative = inverted). */
export const GHOST_Y_SCALE = -0.35;

const RT_SIZE = 256;

export const PuddleReflectorShader = {
    name: 'PuddleReflectorShader',
    uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        opacity: { value: 0.5 }
    },
    vertexShader: /* glsl */`
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        varying vec2 vLocalUv;

        #include <common>
        #include <logdepthbuf_pars_vertex>

        void main() {
            vUv = textureMatrix * vec4(position, 1.0);
            vLocalUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            #include <logdepthbuf_vertex>
        }
    `,
    fragmentShader: /* glsl */`
        uniform vec3 color;
        uniform sampler2D tDiffuse;
        uniform float opacity;
        varying vec4 vUv;
        varying vec2 vLocalUv;

        #include <logdepthbuf_pars_fragment>

        void main() {
            #include <logdepthbuf_fragment>

            vec4 base = texture2DProj(tDiffuse, vUv);
            vec2 d = vLocalUv - vec2(0.5);
            float r = length(d) * 2.0;
            float edge = 1.0 - smoothstep(0.5, 1.0, r);
            if (edge < 0.02) discard;

            vec3 wet = mix(base.rgb * 1.2, color, 0.18);
            gl_FragColor = vec4(wet, edge * opacity);
        }
    `
};

/**
 * @param {number} [SF]
 * @param {number} [count]
 * @returns {{ x: number, z: number, radius: number, lampX: number, lampZ: number, lampRot: number }[]}
 */
export function collectHeroPuddleSpots(SF = WorldMetrics.SCALE_FACTOR, count = 2) {
    const ix = HERO_INTERSECTION_2D.x * SF;
    const iz = HERO_INTERSECTION_2D.z * SF;
    const lamps = CityBuilder3D.collectLampSpots(SF);
    const ranked = lamps
        .map(l => ({ ...l, dist: Math.hypot(l.x - ix, l.z - iz) }))
        .sort((a, b) => a.dist - b.dist);

    const spots = [];
    const seen = new Set();
    for (const lamp of ranked) {
        if (spots.length >= count) break;
        const dx = ix - lamp.x;
        const dz = iz - lamp.z;
        const len = Math.hypot(dx, dz) || 1;
        const x = lamp.x + (dx / len) * PUDDLE_LAMP_OFFSET;
        const z = lamp.z + (dz / len) * PUDDLE_LAMP_OFFSET;
        const key = `${x.toFixed(2)},${z.toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        spots.push({
            x,
            z,
            radius: PUDDLE_RADIUS,
            lampX: lamp.x,
            lampZ: lamp.z,
            lampRot: lamp.rot
        });
    }
    return spots;
}

/**
 * Squashed inverted lamp sitting in the puddle (not on the real lamp) so the
 * silhouette reads from iso as a reflection in the water.
 * @param {{ x: number, z: number, lampX: number, lampZ: number, lampRot: number }} spot
 * @returns {THREE.Group}
 */
export function createInvertedLampGhost(spot) {
    const group = new THREE.Group();
    // Local globe ≈ y 4.9 → world y ≈ pivot + 4.9 * GHOST_Y_SCALE ≈ PUDDLE_Y
    const pivotY = PUDDLE_Y - 4.9 * GHOST_Y_SCALE;
    // Anchor in the puddle; keep lamp yaw so arm orientation matches the real post
    group.position.set(spot.x, pivotY, spot.z);
    group.rotation.y = spot.lampRot || 0;
    group.scale.set(1, GHOST_Y_SCALE, 1);
    group.userData.isPuddleLampGhost = true;

    const poleMat = new THREE.MeshBasicMaterial({
        color: 0x121218,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        fog: false
    });
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, 5.2, 6),
        poleMat
    );
    pole.position.y = 2.6;
    group.add(pole);

    const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.1, 0.1),
        poleMat
    );
    arm.position.set(0.35, 5.05, 0);
    group.add(arm);

    const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshBasicMaterial({
            color: 0xd8e2f0,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            fog: false
        })
    );
    globe.position.set(0.75, 4.9, 0);
    group.add(globe);

    group.renderOrder = 4;
    return group;
}

/**
 * @param {THREE.Scene} scene
 * @param {{ active?: boolean }} [opts]
 * @returns {import('three/addons/objects/Reflector.js').Reflector[] & { ghosts: THREE.Group[], discs: THREE.Mesh[] }}
 */
export function createPuddleReflectors(scene, opts = {}) {
    const active = opts.active !== false;
    const spots = collectHeroPuddleSpots();
    const reflectors = [];
    const ghosts = [];
    const discs = [];

    for (const spot of spots) {
        const discGeom = new THREE.CircleGeometry(spot.radius, 32);
        const disc = new THREE.Mesh(
            discGeom,
            new THREE.MeshBasicMaterial({
                color: 0x152030,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                fog: false
            })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(spot.x, PUDDLE_Y, spot.z);
        disc.renderOrder = 1;
        disc.visible = active;
        disc.userData.isPuddleDisc = true;
        scene.add(disc);
        discs.push(disc);

        const ghost = createInvertedLampGhost(spot);
        ghost.visible = active;
        scene.add(ghost);
        ghosts.push(ghost);

        const reflector = new Reflector(discGeom.clone(), {
            clipBias: 0.003,
            textureWidth: RT_SIZE,
            textureHeight: RT_SIZE,
            color: 0x243040,
            multisample: 0,
            shader: PuddleReflectorShader
        });
        reflector.material.transparent = true;
        reflector.material.depthWrite = false;
        if (reflector.material.uniforms.opacity) {
            reflector.material.uniforms.opacity.value = 0.5;
        }
        reflector.rotation.x = -Math.PI / 2;
        reflector.position.set(spot.x, PUDDLE_Y + 0.003, spot.z);
        reflector.forceUpdate = true;
        reflector.visible = active;
        reflector.userData.isPuddleReflector = true;
        reflector.renderOrder = 2;

        const prevOnBefore = reflector.onBeforeRender;
        reflector.onBeforeRender = function (renderer, scn, camera) {
            const fog = scn.fog;
            scn.fog = null;
            prevOnBefore.call(this, renderer, scn, camera);
            scn.fog = fog;
        };

        scene.add(reflector);
        reflectors.push(reflector);
    }

    reflectors.ghosts = ghosts;
    reflectors.discs = discs;
    return reflectors;
}

/**
 * @param {{ visible?: boolean, ghosts?: THREE.Object3D[], discs?: THREE.Object3D[] }[]|null|undefined} reflectors
 * @param {boolean} active
 */
export function setPuddleReflectorsActive(reflectors, active) {
    if (!reflectors) return;
    for (const r of reflectors) {
        r.visible = !!active;
    }
    for (const g of reflectors.ghosts || []) {
        g.visible = !!active;
    }
    for (const d of reflectors.discs || []) {
        d.visible = !!active;
    }
}

/**
 * @param {ReturnType<typeof createPuddleReflectors>|null|undefined} reflectors
 * @param {THREE.Scene} [scene]
 */
export function disposePuddleReflectors(reflectors, scene) {
    if (!reflectors) return;
    const all = [
        ...reflectors,
        ...(reflectors.ghosts || []),
        ...(reflectors.discs || [])
    ];
    for (const obj of all) {
        if (scene) scene.remove(obj);
        obj.geometry?.dispose?.();
        obj.dispose?.();
        obj.traverse?.((child) => {
            child.geometry?.dispose?.();
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => m.dispose?.());
            }
        });
    }
}
