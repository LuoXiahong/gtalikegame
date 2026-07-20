/**
 * PropFactory — simple sidewalk props (lamp, hydrant, bench, kiosk).
 */
import * as THREE from 'three';
import { WorldMetrics } from '../world/WorldMetrics.js';

export const PROP_TYPES = ['lampPost', 'hydrant', 'bench', 'kiosk'];

/**
 * @param {'lampPost'|'hydrant'|'bench'|'kiosk'} type
 * @returns {THREE.Group}
 */
export function createProp(type) {
    const group = new THREE.Group();
    group.userData.propType = type;

    switch (type) {
        case 'lampPost':
            addLampPost(group);
            break;
        case 'hydrant':
            addHydrant(group);
            break;
        case 'bench':
            addBench(group);
            break;
        case 'kiosk':
            addKiosk(group);
            break;
        default:
            addHydrant(group);
            group.userData.propType = 'hydrant';
    }

    return group;
}

function addLampPost(group) {
    const poleMat = new THREE.MeshStandardMaterial({
        color: 0xb0b0b8,
        roughness: 0.28,
        metalness: 0.85,
        envMapIntensity: 1.2
    });
    // Base plinth so the pole reads grounded from the isometric view
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, 0.35, 8),
        poleMat
    );
    base.position.y = 0.17;
    group.add(base);

    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.13, 5.2, 8),
        poleMat
    );
    pole.position.y = 2.6;
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.09, 0.09),
        poleMat
    );
    arm.position.set(0.35, 5.05, 0);
    group.add(arm);

    const globeMat = new THREE.MeshStandardMaterial({
        color: 0xffe6a0,
        roughness: 0.4,
        metalness: 0.05,
        emissive: 0xffcc66,
        emissiveIntensity: 0.7
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), globeMat);
    globe.position.set(0.75, 4.9, 0);
    group.add(globe);

    // Subtle warm pool on the sidewalk
    const light = new THREE.PointLight(0xffb84d, 0.7, 10, 2);
    light.position.copy(globe.position);
    light.castShadow = false;
    light.userData.isStreetLight = true;
    light.userData.baseIntensity = 0.7;
    group.add(light);
}

function addHydrant(group) {
    const mat = new THREE.MeshStandardMaterial({
        color: 0xa83228,
        roughness: 0.7,
        metalness: 0.25
    });
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 0.55, 8),
        mat
    );
    body.position.y = 0.28;
    body.castShadow = true;
    group.add(body);

    const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 0.12, 8),
        mat
    );
    cap.position.y = 0.6;
    group.add(cap);

    const nozzle = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.1, 0.1),
        mat
    );
    nozzle.position.set(0, 0.38, 0);
    group.add(nozzle);
}

function addBench(group) {
    const wood = new THREE.MeshStandardMaterial({
        color: 0x6b4f2a,
        roughness: 0.9,
        metalness: 0.05
    });
    const iron = new THREE.MeshStandardMaterial({
        color: 0x2c2c2c,
        roughness: 0.5,
        metalness: 0.7
    });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.4), wood);
    seat.position.y = 0.42;
    seat.castShadow = true;
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.06), wood);
    back.position.set(0, 0.62, -0.17);
    group.add(back);

    for (const x of [-0.45, 0.45]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.35), iron);
        leg.position.set(x, 0.2, 0);
        group.add(leg);
    }
}

function addKiosk(group) {
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x3d5a4c,
        roughness: 0.85,
        metalness: 0.05
    });
    const roofMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.7,
        metalness: 0.2
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.8), bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.0), roofMat);
    roof.position.y = 1.45;
    group.add(roof);

    const windowMat = new THREE.MeshStandardMaterial({
        color: 0xc9a227,
        roughness: 0.4,
        metalness: 0.1,
        emissive: 0xc9a227,
        emissiveIntensity: 0.25
    });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), windowMat);
    win.position.set(0, 0.85, 0.42);
    group.add(win);
}

/**
 * Place prop on sidewalk height at world xz.
 * @param {'lampPost'|'hydrant'|'bench'|'kiosk'} type
 * @param {number} x
 * @param {number} z
 * @param {number} [rotationY]
 * @returns {THREE.Group}
 */
export function createPropAt(type, x, z, rotationY = 0) {
    const group = createProp(type);
    group.position.set(x, WorldMetrics.SIDEWALK_HEIGHT, z);
    group.rotation.y = rotationY;
    return group;
}
