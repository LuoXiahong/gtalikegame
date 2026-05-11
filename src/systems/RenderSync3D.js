/**
 * SYSTEM SYNCHRONIZACJI RENDEROWANIA (RenderSync3D)
 * Odpowiada za synchronizację encji z logiki 2D do ich reprezentacji 3D w scenie Three.js.
 * Wykorzystuje ujednoliconą skalę WorldMetrics (1u = 1m).
 */
import * as THREE from 'three';
import { World } from '../world/World.js';
import { MissionSystem } from './MissionSystem.js';
import { WorldMetrics } from '../world/WorldMetrics.js';

export const RenderSync3D = {
    meshes: new Map(), // entityId -> THREE.Object3D
    targetMesh: null,  // Złoty okrąg celu misji

    /**
     * Główny krok synchronizacji wywoływany w każdej klatce przed renderowaniem 3D
     * @param {THREE.Scene} scene - Scena 3D z RenderSystem3D
     */
    update(scene) {
        if (!scene) return;

        const activeIds = new Set();
        const SF = WorldMetrics.SCALE_FACTOR;

        // 1. Synchronizacja wszystkich encji z logiki gry
        (World.entities || []).forEach(ent => {
            if (!ent.transform) return;
            activeIds.add(ent.id);

            let mesh = this.meshes.get(ent.id);
            if (!mesh) {
                mesh = this.createEntityMesh(ent);
                scene.add(mesh);
                this.meshes.set(ent.id, mesh);
            }

            // Mapowanie pozycji: world2D.x -> world3D.x, world2D.y -> world3D.z (z uwzględnieniem skali)
            mesh.position.x = ent.transform.x * SF;
            mesh.position.z = ent.transform.y * SF;

            // Obliczanie wysokości podłoża (chodnik vs ulica)
            let groundY = 0;
            if (World.tilemap) {
                const tileType = World.tilemap.getTileAt(ent.transform.x, ent.transform.y);
                if (tileType === 2 || tileType === 3) {
                    groundY = WorldMetrics.SIDEWALK_HEIGHT; // 0.15m dla chodników i stref budynków
                }
            }
            mesh.position.y = groundY;

            // Mapowanie rotacji: rotacja 2D -> rotacja 3D wokół osi Y
            mesh.rotation.y = -ent.transform.angle;

            // Opcjonalne ukrywanie encji (np. gdy gracz siedzi w aucie)
            if (ent.visible === false) {
                mesh.visible = false;
            } else {
                mesh.visible = true;
            }
        });

        // 2. Despawn i zwalnianie pamięci usuniętych encji
        for (const [id, mesh] of this.meshes.entries()) {
            if (!activeIds.has(id)) {
                scene.remove(mesh);
                this.disposeHierarchy(mesh);
                this.meshes.delete(id);
            }
        }

        // 3. Synchronizacja wskaźnika celu misji (Target Zone)
        if (MissionSystem && MissionSystem.targetLocation) {
            const loc = MissionSystem.targetLocation;
            if (!this.targetMesh) {
                const geom = new THREE.TorusGeometry((loc.radius || 40) * SF, 0.4, 8, 24);
                const mat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, side: THREE.DoubleSide });
                this.targetMesh = new THREE.Mesh(geom, mat);
                this.targetMesh.rotation.x = Math.PI / 2; // Poziomo
                scene.add(this.targetMesh);
            }
            this.targetMesh.position.x = loc.x * SF;
            this.targetMesh.position.z = loc.y * SF;
            this.targetMesh.position.y = 1.0 + Math.sin(Date.now() * 0.005) * 0.3;
            this.targetMesh.rotation.z = Date.now() * 0.001; // Powolna rotacja
        } else if (this.targetMesh) {
            scene.remove(this.targetMesh);
            this.disposeHierarchy(this.targetMesh);
            this.targetMesh = null;
        }
    },

    /**
     * Tworzy odpowiedni model 3D dla danej encji na podstawie jej typu
     */
    createEntityMesh(ent) {
        const group = new THREE.Group();

        if (ent.type === 'player') {
            const w = WorldMetrics.NPC_WIDTH;
            const h = WorldMetrics.NPC_HEIGHT;
            const d = WorldMetrics.NPC_DEPTH;

            // Korpus (niebieski kubik)
            const bodyGeom = new THREE.BoxGeometry(w, h * 0.75, d);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.7, metalness: 0.1 });
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.y = (h * 0.75) / 2; // Pivot na spodzie
            group.add(body);

            // Głowa
            const headGeom = new THREE.SphereGeometry(w * 0.4, 8, 8);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8, metalness: 0.0 });
            const head = new THREE.Mesh(headGeom, headMat);
            head.position.y = h * 0.85;
            group.add(head);

        } else if (ent.type === 'npc') {
            const color = ent.visual?.color ? parseInt(ent.visual.color.replace('#', '0x')) : 0x8e44ad;
            const w = WorldMetrics.NPC_WIDTH;
            const h = WorldMetrics.NPC_HEIGHT;
            const d = WorldMetrics.NPC_DEPTH;

            // Korpus
            const bodyGeom = new THREE.BoxGeometry(w, h * 0.75, d);
            const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.1 });
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.y = (h * 0.75) / 2;
            group.add(body);

            // Głowa
            const headGeom = new THREE.SphereGeometry(w * 0.4, 8, 8);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8, metalness: 0.0 });
            const head = new THREE.Mesh(headGeom, headMat);
            head.position.y = h * 0.85;
            group.add(head);

        } else if (ent.type === 'car') {
            const color = ent.visual?.color ? parseInt(ent.visual.color.replace('#', '0x')) : 0xc0392b;
            
            // Określamy typ pojazdu (Sedan vs Van) stabilnie na podstawie ent.id
            const idNum = typeof ent.id === 'string' ? parseInt(ent.id.replace(/[^0-9]/g, '')) : 0;
            const isVan = !isNaN(idNum) ? (idNum % 3 === 0) : false; // 1/3 to Vany, reszta to Sedany

            if (!isVan) {
                // --- MODEL: SEDAN (Type A) ---
                const metrics = WorldMetrics.SEDAN;
                const chassisH = metrics.height * metrics.chassisHeightRatio;
                const cabinH = metrics.height * (1 - metrics.chassisHeightRatio);

                // 1. Dolne podwozie (oś X to długość, oś Z to szerokość)
                const lowerGeom = new THREE.BoxGeometry(metrics.length, chassisH, metrics.width);
                const lowerMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.3 });
                const lower = new THREE.Mesh(lowerGeom, lowerMat);
                lower.position.y = chassisH / 2 + 0.1; // 0.1m clearance
                group.add(lower);

                // 2. Kabina (przesunięta lekko do tyłu: ujemny X)
                const upperGeom = new THREE.BoxGeometry(metrics.length * 0.55, cabinH, metrics.width * 0.85);
                const upperMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 });
                const upper = new THREE.Mesh(upperGeom, upperMat);
                upper.position.set(-metrics.length * 0.1, chassisH + cabinH / 2 + 0.1, 0);
                group.add(upper);

                // 3. Przednie ciepłe reflektory emisyjne (X = metrics.length/2)
                const lightFrontGeom = new THREE.BoxGeometry(0.1, 0.1, 0.2);
                const lightFrontMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: 0xffeeaa,
                    emissiveIntensity: 1.0,
                    roughness: 0.1
                });
                const leftLightF = new THREE.Mesh(lightFrontGeom, lightFrontMat);
                leftLightF.position.set(metrics.length / 2, chassisH / 2 + 0.1, -metrics.width * 0.35);
                group.add(leftLightF);

                const rightLightF = new THREE.Mesh(lightFrontGeom, lightFrontMat);
                rightLightF.position.set(metrics.length / 2, chassisH / 2 + 0.1, metrics.width * 0.35);
                group.add(rightLightF);

                // 4. Tylne czerwone światła emisyjne (X = -metrics.length/2)
                const lightRearGeom = new THREE.BoxGeometry(0.1, 0.1, 0.2);
                const lightRearMat = new THREE.MeshStandardMaterial({
                    color: 0xff0000,
                    emissive: 0xff0000,
                    emissiveIntensity: 1.0,
                    roughness: 0.1
                });
                const leftLightR = new THREE.Mesh(lightRearGeom, lightRearMat);
                leftLightR.position.set(-metrics.length / 2, chassisH / 2 + 0.1, -metrics.width * 0.35);
                group.add(leftLightR);

                const rightLightR = new THREE.Mesh(lightRearGeom, lightRearMat);
                rightLightR.position.set(-metrics.length / 2, chassisH / 2 + 0.1, metrics.width * 0.35);
                group.add(rightLightR);

                // 5. Koła (4 czarne cylindry/boxy)
                const wheelGeom = new THREE.BoxGeometry(0.4, 0.3, 0.3);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.0 });
                const wheelOffsets = [
                    { x: -metrics.length * 0.3, z: -metrics.width * 0.45 },
                    { x: metrics.length * 0.3, z: -metrics.width * 0.45 },
                    { x: -metrics.length * 0.3, z: metrics.width * 0.45 },
                    { x: metrics.length * 0.3, z: metrics.width * 0.45 }
                ];
                wheelOffsets.forEach(offset => {
                    const wheel = new THREE.Mesh(wheelGeom, wheelMat);
                    wheel.position.set(offset.x, 0.15, offset.z);
                    group.add(wheel);
                });

            } else {
                // --- MODEL: VAN (Type B) ---
                const metrics = WorldMetrics.VAN;
                const chassisH = metrics.height * metrics.chassisHeightRatio;
                const cabinH = metrics.height * (1 - metrics.chassisHeightRatio);

                // 1. Dolne podwozie
                const lowerGeom = new THREE.BoxGeometry(metrics.length, chassisH, metrics.width);
                const lowerMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.2 });
                const lower = new THREE.Mesh(lowerGeom, lowerMat);
                lower.position.y = chassisH / 2 + 0.1; // 0.1m clearance
                group.add(lower);

                // 2. Wysoka, zintegrowana kabina (lekki offset w tył)
                const upperGeom = new THREE.BoxGeometry(metrics.length * 0.85, cabinH, metrics.width * 0.9);
                const upperMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.2 });
                const upper = new THREE.Mesh(upperGeom, upperMat);
                upper.position.set(-metrics.length * 0.05, chassisH + cabinH / 2 + 0.1, 0);
                group.add(upper);

                // 3. Przednia przyciemniana szyba (czarny pasek z przodu kabiny)
                const windowGeom = new THREE.BoxGeometry(metrics.length * 0.3, cabinH * 0.4, metrics.width * 0.85);
                const windowMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
                const win = new THREE.Mesh(windowGeom, windowMat);
                win.position.set(metrics.length * 0.25, chassisH + cabinH * 0.7 + 0.1, 0);
                group.add(win);

                // 4. Przednie ciepłe reflektory emisyjne
                const lightFrontGeom = new THREE.BoxGeometry(0.1, 0.15, 0.25);
                const lightFrontMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: 0xffeeaa,
                    emissiveIntensity: 1.0,
                    roughness: 0.1
                });
                const leftLightF = new THREE.Mesh(lightFrontGeom, lightFrontMat);
                leftLightF.position.set(metrics.length / 2, chassisH / 2 + 0.1, -metrics.width * 0.35);
                group.add(leftLightF);

                const rightLightF = new THREE.Mesh(lightFrontGeom, lightFrontMat);
                rightLightF.position.set(metrics.length / 2, chassisH / 2 + 0.1, metrics.width * 0.35);
                group.add(rightLightF);

                // 5. Tylne czerwone światła emisyjne
                const lightRearGeom = new THREE.BoxGeometry(0.1, 0.15, 0.25);
                const lightRearMat = new THREE.MeshStandardMaterial({
                    color: 0xff0000,
                    emissive: 0xff0000,
                    emissiveIntensity: 1.0,
                    roughness: 0.1
                });
                const leftLightR = new THREE.Mesh(lightRearGeom, lightRearMat);
                leftLightR.position.set(-metrics.length / 2, chassisH / 2 + 0.1, -metrics.width * 0.35);
                group.add(leftLightR);

                const rightLightR = new THREE.Mesh(lightRearGeom, lightRearMat);
                rightLightR.position.set(-metrics.length / 2, chassisH / 2 + 0.1, metrics.width * 0.35);
                group.add(rightLightR);

                // 6. Koła
                const wheelGeom = new THREE.BoxGeometry(0.45, 0.35, 0.35);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.0 });
                const wheelOffsets = [
                    { x: -metrics.length * 0.3, z: -metrics.width * 0.45 },
                    { x: metrics.length * 0.3, z: -metrics.width * 0.45 },
                    { x: -metrics.length * 0.3, z: metrics.width * 0.45 },
                    { x: metrics.length * 0.3, z: metrics.width * 0.45 }
                ];
                wheelOffsets.forEach(offset => {
                    const wheel = new THREE.Mesh(wheelGeom, wheelMat);
                    wheel.position.set(offset.x, 0.175, offset.z);
                    group.add(wheel);
                });
            }
        }

        // Automatyczne włączenie cieni rzucanych i przyjmowanych dla wszystkich części modelu (T-701)
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return group;
    },

    /**
     * Bezpieczne usuwanie geometrii i materiałów dla uniknięcia wycieków pamięci
     */
    disposeHierarchy(obj) {
        obj.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
};
