/**
 * SYSTEM RENDERINGU 3D (RenderSystem3D)
 * Odpowiedzialny za wyświetlanie świata gry w trójwymiarze przy użyciu Three.js.
 * 
 * KONWENCJA MAPOWANIA WSPÓŁRZĘDNYCH:
 * world2D.x → world3D.x
 * world2D.y → world3D.z (oś głębokości)
 * Oś world3D.y odpowiada wysokości w pionie.
 */
import * as THREE from 'three';
import { World } from '../world/World.js';
import { WorldGrid } from '../world/WorldGrid.js';
import { RenderSync3D } from './RenderSync3D.js';

export const RenderSystem3D = {
    renderer: null,
    scene: null,
    camera: null,
    
    // Elementy środowiska 3D
    groundPlane: null,
    asphaltPlane: null,
    sidewalks: [],
    buildingZones: [],
    laneMarkings: [],
    zebras: [],
    
    // Sześcian walidacji ruchu i skali
    box5u: null,
    
    // Punkt początkowy odniesienia (gracz zaczyna na skrzyżowaniu x:1100, y:1100)
    originX: 1100,
    originZ: 1100,

    init() {
        const canvas = document.getElementById('gameCanvas3D');
        if (!canvas) {
            console.error('Nie znaleziono elementu #gameCanvas3D!');
            return;
        }

        const parent = canvas.parentElement;
        const width = parent.clientWidth || 800;
        const height = parent.clientHeight || 600;

        // 1. Inicjalizacja WebGLRenderer (renderowanie czarnej sceny na start)
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(width, height, false);
        this.renderer.setClearColor(0x000000, 1.0);

        // 2. Inicjalizacja Sceny
        this.scene = new THREE.Scene();

        // 3. Konfiguracja OrthographicCamera (Brak perspektywy)
        const aspect = width / height;
        const viewSize = 600; // Zasięg widzenia izometrycznego
        
        this.camera = new THREE.OrthographicCamera(
            -viewSize * aspect / 2, // left
            viewSize * aspect / 2,  // right
            viewSize / 2,           // top
            -viewSize / 2,          // bottom
            -2000,                  // near
            10000                   // far
        );

        this.camera.zoom = 1.0;
        this.camera.updateProjectionMatrix();

        // 4. Obsługa zdarzenia zmiany rozmiaru okna (resize)
        window.addEventListener('resize', () => {
            const w = parent.clientWidth || 800;
            const h = parent.clientHeight || 600;
            
            this.renderer.setSize(w, h, false);
            
            const newAspect = w / h;
            this.camera.left = -viewSize * newAspect / 2;
            this.camera.right = viewSize * newAspect / 2;
            this.camera.top = viewSize / 2;
            this.camera.bottom = -viewSize / 2;
            this.camera.updateProjectionMatrix();
        });

        // 5. Budowa makiety środowiska na bazie WorldGrid
        
        // A. Podłoże trawy (cały świat 3000x3000px)
        const groundGeom = new THREE.PlaneGeometry(3000, 3000);
        const groundMat = new THREE.MeshBasicMaterial({ color: 0x27ae60 }); // Zielona trawa
        this.groundPlane = new THREE.Mesh(groundGeom, groundMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.set(1500, -0.05, 1500);
        this.scene.add(this.groundPlane);

        // B. Podłoże asfaltowe (miejski obszar wewnątrz paddingu, kolor ciemnoszary #222)
        const asphaltSize = 3000 - 2 * WorldGrid.PADDING;
        const asphaltGeom = new THREE.PlaneGeometry(asphaltSize, asphaltSize);
        const asphaltMat = new THREE.MeshBasicMaterial({ color: 0x222222 }); // Ciemny asfalt drogowy
        this.asphaltPlane = new THREE.Mesh(asphaltGeom, asphaltMat);
        this.asphaltPlane.rotation.x = -Math.PI / 2;
        this.asphaltPlane.position.set(1500, -0.01, 1500);
        this.scene.add(this.asphaltPlane);

        // C. Budowa 9 bloków (podniesiony chodnik na 0.05u + wyższa strefa zabudowy na 0.07u)
        this.sidewalks = [];
        this.buildingZones = [];
        
        const sidewalkMat = new THREE.MeshBasicMaterial({ color: 0x95a5a6 }); // Jaśniejszy beton chodnikowy (#95a5a6)
        const buildingZoneMat = new THREE.MeshBasicMaterial({ color: 0x7f8c8d }); // Ciemniejszy beton strefy budynków (#7f8c8d)
        
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = b.x + b.w / 2;
                const posZ = b.y + b.h / 2;
                
                // 1. Podstawa chodnika (500x500x0.05)
                const swGeom = new THREE.BoxGeometry(b.w, 0.05, b.h);
                const swMesh = new THREE.Mesh(swGeom, sidewalkMat);
                swMesh.position.set(posX, 0.025, posZ);
                this.scene.add(swMesh);
                this.sidewalks.push(swMesh);
                
                // 2. Podniesiona strefa budynku (300x300x0.02, wysokość sumaryczna 0.07)
                const bzGeom = new THREE.BoxGeometry(300, 0.02, 300);
                const bzMesh = new THREE.Mesh(bzGeom, buildingZoneMat);
                bzMesh.position.set(posX, 0.06, posZ);
                this.scene.add(bzMesh);
                this.buildingZones.push(bzMesh);
            }
        }

        // D. Generowanie linii przerywanych (Lane Markings) na środkach jezdni
        this.laneMarkings = [];
        const roads = WorldGrid.getStreetCenters(); // [1100, 1800]
        
        // Pionowe linie jezdni (dzielone przez skrzyżowania)
        roads.forEach(rx => {
            this.createDashedLine(rx, 500, rx, 1000, true);
            this.createDashedLine(rx, 1200, rx, 1700, true);
            this.createDashedLine(rx, 1900, rx, 2400, true);
        });
        
        // Poziome linie jezdni (dzielone przez skrzyżowania)
        roads.forEach(rz => {
            this.createDashedLine(500, rz, 1000, rz, false);
            this.createDashedLine(1200, rz, 1700, rz, false);
            this.createDashedLine(1900, rz, 2400, rz, false);
        });

        // E. Generowanie przejść dla pieszych (Zebras) na wlotach skrzyżowań
        this.zebras = [];
        roads.forEach(cx => {
            roads.forEach(cz => {
                // Cztery zebry wokół każdego skrzyżowania (Północ, Południe, Zachód, Wschód)
                this.createZebra(cx, cz - 110, true);  // Północ (droga pionowa)
                this.createZebra(cx, cz + 110, true);  // Południe (droga pionowa)
                this.createZebra(cx - 110, cz, false); // Zachód (droga pozioma)
                this.createZebra(cx + 110, cz, false); // Wschód (droga pozioma)
            });
        });

        // 6. Testowy sześcian (15u x 15u x 15u) do walidacji ruchu i osi (kolor czerwony)
        const geom5u = new THREE.BoxGeometry(15, 15, 15);
        const mat5u = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        this.box5u = new THREE.Mesh(geom5u, mat5u);
        this.box5u.position.set(this.originX, 7.5, this.originZ + 200);
        this.scene.add(this.box5u);
    },

    /**
     * Tworzy linię przerywaną na zadanym odcinku jezdni
     */
    createDashedLine(xStart, zStart, xEnd, zEnd, isVertical) {
        const dashLength = 15;
        const dashGap = 15;
        const step = dashLength + dashGap;
        
        const geom = new THREE.BoxGeometry(isVertical ? 2 : dashLength, 0.005, isVertical ? dashLength : 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const start = isVertical ? zStart : xStart;
        const end = isVertical ? zEnd : xEnd;
        
        for (let pos = start + dashGap; pos < end - dashGap; pos += step) {
            const mesh = new THREE.Mesh(geom, mat);
            const posX = isVertical ? xStart : pos;
            const posZ = isVertical ? pos : zStart;
            mesh.position.set(posX, 0.003, posZ); // Lekko ponad asfaltem, poniżej zderzaków aut
            this.scene.add(mesh);
            this.laneMarkings.push(mesh);
        }
    },

    /**
     * Tworzy przejście dla pieszych (zebra) ułożone w poprzek kierunku wchodzenia pieszych
     */
    createZebra(cx, cz, isVerticalRoad) {
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const stripeOffsets = [-60, -30, 0, 30, 60];
        
        if (isVerticalRoad) {
            // Zebra na drodze pionowej (pieszy idzie poziomo X, pasy są ułożone pionowo Z)
            const stripeGeom = new THREE.BoxGeometry(4, 0.005, 20);
            stripeOffsets.forEach(dx => {
                const mesh = new THREE.Mesh(stripeGeom, stripeMat);
                mesh.position.set(cx + dx, 0.003, cz);
                this.scene.add(mesh);
                this.zebras.push(mesh);
            });
        } else {
            // Zebra na drodze poziomej (pieszy idzie pionowo Z, pasy są ułożone poziomo X)
            const stripeGeom = new THREE.BoxGeometry(20, 0.005, 4);
            stripeOffsets.forEach(dz => {
                const mesh = new THREE.Mesh(stripeGeom, stripeMat);
                mesh.position.set(cx, 0.003, cz + dz);
                this.scene.add(mesh);
                this.zebras.push(mesh);
            });
        }
    },

    update() {
        if (!this.renderer || !this.scene || !this.camera) return;

        // 1. Walidacja konwencji - płynny ruch czerwonego sześcianu wzdłuż ulicy (oś X)
        const time = Date.now() * 0.001;
        this.box5u.position.x = 1500 + Math.sin(time) * 1000;
        this.box5u.position.z = 1100;

        // 2. Pobranie pozycji śledzonej encji (gracza lub pojazdu)
        const player = World.getEntitiesByType('player')[0];
        let focusX = this.originX;
        let focusZ = this.originZ;

        if (player && player.transform) {
            focusX = player.transform.x;
            focusZ = player.transform.y;
        }

        // 3. Pozycjonowanie kamery izometrycznej
        const tiltAngle = 35.264 * Math.PI / 180;
        const yawAngle = 45 * Math.PI / 180;
        const distance = 1200;

        this.camera.position.x = focusX + Math.cos(yawAngle) * Math.cos(tiltAngle) * distance;
        this.camera.position.y = Math.sin(tiltAngle) * distance;
        this.camera.position.z = focusZ + Math.sin(yawAngle) * Math.cos(tiltAngle) * distance;
        
        this.camera.lookAt(focusX, 0, focusZ);

        // 4. Synchronizacja modeli 3D z logiką 2D
        RenderSync3D.update(this.scene);

        // 5. Render klatki
        this.renderer.render(this.scene, this.camera);
    }
};
