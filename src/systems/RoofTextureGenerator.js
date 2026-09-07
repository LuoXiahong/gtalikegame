/**
 * RoofTextureGenerator — procedural roughness speckle for building roofs (T56).
 * Mirrors RoadTextureGenerator's weather-reactive material props, but roofs are flat
 * boxes with no wear/puddle layout to bake — just a static speckled roughnessMap whose
 * sparkle only reads once the base roughness drops low enough on rain to catch it.
 */
import * as THREE from 'three';

const SPECKLE_COUNT = 900;

export const RoofTextureGenerator = {
    _wetness: 'clear',
    _roughnessTexture: null,
    liveMaterials: new Set(),

    createRoughnessTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;

        if (ctx) {
            // Mid-grey base roughness; dark speckles read as glossier spots once
            // material.roughness itself is low enough (rain) for the map to matter.
            ctx.fillStyle = '#c8c8c8';
            ctx.fillRect(0, 0, 256, 256);
            ctx.fillStyle = '#2c2c2c';
            for (let i = 0; i < SPECKLE_COUNT; i++) {
                const x = Math.random() * 256;
                const y = Math.random() * 256;
                const r = 0.5 + Math.random() * 0.9;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    },

    getRoughnessTexture() {
        if (!this._roughnessTexture) this._roughnessTexture = this.createRoughnessTexture();
        return this._roughnessTexture;
    },

    /** Dry: matte concrete, speckle invisible. Rain: low enough roughness + high enough
     * envMapIntensity that the speckle map's dark dots catch reflections as sparkle. */
    getSurfaceMaterialProps() {
        if (this._wetness === 'rain') {
            return { roughness: 0.55, metalness: 0.1, envMapIntensity: 0.9 };
        }
        return { roughness: 0.85, metalness: 0.05, envMapIntensity: 0.2 };
    },

    trackMaterial(mat) {
        this.liveMaterials.add(mat);
    },

    setWetness(weather) {
        this._wetness = weather === 'rain' ? 'rain' : 'clear';
        const props = this.getSurfaceMaterialProps();
        for (const mat of this.liveMaterials) {
            if (!mat) continue;
            mat.roughness = props.roughness;
            mat.metalness = props.metalness;
            mat.envMapIntensity = props.envMapIntensity;
            mat.needsUpdate = true;
        }
    }
};
