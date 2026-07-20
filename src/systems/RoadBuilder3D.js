/**
 * RoadBuilder3D — 3D roads, lane markings, and intersections.
 */
import * as THREE from 'three';
import { WorldGrid } from '../world/WorldGrid.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { RoadTextureGenerator } from './RoadTextureGenerator.js';

export const RoadBuilder3D = {
    buildRoads(renderSystem) {
        const SF = WorldMetrics.SCALE_FACTOR;
        renderSystem.laneMarkings = [];
        const roads = WorldGrid.getStreetCenters();
        const half = WorldGrid.STREET_WIDTH / 2;

        // Straight corridors stop at block faces (flush with intersection squares).
        // Lane dashes are inset in the straight texture so they sit on exit roads only.
        roads.forEach(rx => {
            this.createDashedLine(renderSystem, rx * SF, 500 * SF, rx * SF, 1000 * SF, true);
            this.createDashedLine(renderSystem, rx * SF, 1200 * SF, rx * SF, 1700 * SF, true);
            this.createDashedLine(renderSystem, rx * SF, 1900 * SF, rx * SF, 2400 * SF, true);
        });

        roads.forEach(rz => {
            this.createDashedLine(renderSystem, 500 * SF, rz * SF, 1000 * SF, rz * SF, false);
            this.createDashedLine(renderSystem, 1200 * SF, rz * SF, 1700 * SF, rz * SF, false);
            this.createDashedLine(renderSystem, 1900 * SF, rz * SF, 2400 * SF, rz * SF, false);
        });

        renderSystem.zebras = [];
        roads.forEach(cx => {
            roads.forEach(cz => {
                this.createZebra(renderSystem, cx * SF, cz * SF);
                // Crosswalks on exit approaches (same idea as 2D Decals offset)
                const approach = half + 50;
                this.createCrosswalk(renderSystem, cx * SF, (cz - approach) * SF, true);
                this.createCrosswalk(renderSystem, cx * SF, (cz + approach) * SF, true);
                this.createCrosswalk(renderSystem, (cx - approach) * SF, cz * SF, false);
                this.createCrosswalk(renderSystem, (cx + approach) * SF, cz * SF, false);
            });
        });
    },

    createDashedLine(renderSystem, xStart, zStart, xEnd, zEnd, isVertical) {
        const SF = WorldMetrics.SCALE_FACTOR;
        const width = WorldGrid.STREET_WIDTH * SF;
        const length = Math.abs(isVertical ? (zEnd - zStart) : (xEnd - xStart));

        const geom = new THREE.PlaneGeometry(width, length);
        const texture = RoadTextureGenerator.getTexture('straight');
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.9,
            metalness: 0.0
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = -Math.PI / 2;

        const posX = isVertical ? xStart : (xStart + xEnd) / 2;
        const posZ = isVertical ? (zStart + zEnd) / 2 : zStart;

        mesh.position.set(posX, 0.002, posZ);

        if (!isVertical) {
            mesh.rotation.z = Math.PI / 2;
        }

        mesh.receiveShadow = true;
        renderSystem.scene.add(mesh);
        renderSystem.laneMarkings.push(mesh);
    },

    createZebra(renderSystem, targetX, targetZ) {
        const SF = WorldMetrics.SCALE_FACTOR;

        const key = `${targetX.toFixed(2)},${targetZ.toFixed(2)}`;
        if (renderSystem.createdIntersections && renderSystem.createdIntersections.has(key)) {
            return;
        }
        if (renderSystem.createdIntersections) {
            renderSystem.createdIntersections.add(key);
        }

        const width = WorldGrid.STREET_WIDTH * SF;
        const geom = new THREE.PlaneGeometry(width, width);
        const texture = RoadTextureGenerator.getTexture('intersection');
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.9,
            metalness: 0.0
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = -Math.PI / 2;
        // Slightly above straight overlays to avoid edge z-fight; asphalt matches
        mesh.position.set(targetX, 0.003, targetZ);
        mesh.receiveShadow = true;

        renderSystem.scene.add(mesh);
        renderSystem.zebras.push(mesh);
    },

    /**
     * Crosswalk on an exit road just outside the intersection square.
     * @param {boolean} northSouth - true = bars across E-W travel (on N/S approaches)
     */
    createCrosswalk(renderSystem, x, z, northSouth) {
        const SF = WorldMetrics.SCALE_FACTOR;
        const roadW = WorldGrid.STREET_WIDTH * SF * 0.9;
        const depth = 80 * SF;

        // Width across the roadway, depth along the approach (rotate for E/W)
        const geom = new THREE.PlaneGeometry(roadW, depth);
        const texture = RoadTextureGenerator.getTexture('crosswalk');
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.9,
            metalness: 0.0
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = -Math.PI / 2;
        if (!northSouth) {
            mesh.rotation.z = Math.PI / 2;
        }
        mesh.position.set(x, 0.004, z);
        mesh.receiveShadow = true;

        renderSystem.scene.add(mesh);
        renderSystem.zebras.push(mesh);
    }
};
