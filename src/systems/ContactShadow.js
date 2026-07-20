/**
 * Soft circular contact-shadow helper (shared by buildings, NPCs, vehicles).
 */
import * as THREE from 'three';

let cachedTexture = null;

/**
 * Soft radial alpha texture (64×64). Created once and reused.
 * @returns {THREE.CanvasTexture}
 */
export function getContactShadowTexture() {
    if (cachedTexture) return cachedTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        cachedTexture = new THREE.Texture();
        return cachedTexture;
    }
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    cachedTexture = new THREE.CanvasTexture(canvas);
    return cachedTexture;
}

/**
 * Flat soft blob under a model pivot.
 * @param {THREE.Group} group
 * @param {{ width?: number, depth?: number, y?: number, opacity?: number }} [opts]
 * @returns {THREE.Mesh}
 */
export function addContactShadow(group, opts = {}) {
    const width = opts.width ?? 0.7;
    const depth = opts.depth ?? 0.7;
    const y = opts.y ?? 0.01;
    const opacity = opts.opacity ?? 0.35;

    const geom = new THREE.PlaneGeometry(width, depth);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        map: getContactShadowTexture(),
        transparent: true,
        opacity,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, y, 0);
    mesh.name = 'contactShadow';
    group.add(mesh);
    return mesh;
}
