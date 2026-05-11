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
import { Camera as GameCamera } from '../world/Camera.js';

export const RenderSystem3D = {
    renderer: null,
    scene: null,
    camera: null,
    
    // Obiekty testowe do walidacji skali i ruchu
    gridHelper: null,
    box1u: null,
    box2u: null,
    box5u: null,
    
    // Punkt początkowy odniesienia (np. pozycja gracza na starcie)
    originX: 1000,
    originZ: 1500,

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
        this.renderer.setClearColor(0x000000, 1.0); // Czarna scena bazowa

        // 2. Inicjalizacja Sceny
        this.scene = new THREE.Scene();

        // 3. Konfiguracja OrthographicCamera (Brak perspektywy)
        const aspect = width / height;
        const viewSize = 200; // Wysokość widocznego obszaru w jednostkach (kalibracja pod siatkę 200u)
        
        this.camera = new THREE.OrthographicCamera(
            -viewSize * aspect / 2, // left
            viewSize * aspect / 2,  // right
            viewSize / 2,           // top
            -viewSize / 2,          // bottom
            -1000,                  // near
            5000                    // far
        );

        // Wyłączamy orbit controls - sterujemy w pełni automatycznie przez kod
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

        // 5. Dodanie THREE.GridHelper do walidacji skali jednostek (grid o boku 200u z liniami co 10u)
        // Kolor główny: 0xffffff (biały), kolor linii pomocniczych: 0x444444 (ciemnoszary)
        this.gridHelper = new THREE.GridHelper(200, 20, 0xffffff, 0x444444);
        this.gridHelper.position.set(this.originX, 0, this.originZ);
        this.scene.add(this.gridHelper);

        // 6. Stworzenie 3 testowych sześcianów o znanych wymiarach (1u, 2u, 5u)
        // Używamy MeshBasicMaterial, który nie wymaga światła do poprawnego renderowania.
        
        // Kostka 1u (1 x 1 x 1) - Kolor żółty
        const geom1u = new THREE.BoxGeometry(1, 1, 1);
        const mat1u = new THREE.MeshBasicMaterial({ color: 0xf1c40f });
        this.box1u = new THREE.Mesh(geom1u, mat1u);
        this.box1u.position.set(this.originX - 20, 0.5, this.originZ - 20);
        this.scene.add(this.box1u);

        // Kostka 2u (2 x 2 x 2) - Kolor niebieski
        const geom2u = new THREE.BoxGeometry(2, 2, 2);
        const mat2u = new THREE.MeshBasicMaterial({ color: 0x3498db });
        this.box2u = new THREE.Mesh(geom2u, mat2u);
        this.box2u.position.set(this.originX, 1.0, this.originZ - 30);
        this.scene.add(this.box2u);

        // Kostka 5u (5 x 5 x 5) - Kolor czerwony (będzie poruszać się po X/Z)
        const geom5u = new THREE.BoxGeometry(5, 5, 5);
        const mat5u = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        this.box5u = new THREE.Mesh(geom5u, mat5u);
        this.box5u.position.set(this.originX + 20, 2.5, this.originZ + 20);
        this.scene.add(this.box5u);
    },

    update() {
        if (!this.renderer || !this.scene || !this.camera) return;

        // 1. Walidacja konwencji - ruch testowego boksu 5u po osiach X/Z przy użyciu funkcji trygonometrycznych
        const time = Date.now() * 0.0015;
        this.box5u.position.x = this.originX + 20 + Math.sin(time) * 40;
        this.box5u.position.z = this.originZ + 20 + Math.cos(time) * 40;

        // 2. Pobranie pozycji punktu centralnego (gracza lub sterowanej encji) z logiki 2D
        const player = World.getEntitiesByType('player')[0];
        let focusX = this.originX;
        let focusZ = this.originZ;

        if (player && player.transform) {
            focusX = player.transform.x;
            focusZ = player.transform.y; // world2D.y mapuje się na world3D.z
        }

        // 3. Pozycjonowanie kamery z zachowaniem isometric feelingu
        // Kąt tiltu od pionu / rzut izometryczny: ~35.26 stopni (Math.asin(Math.tan(30 * Math.PI / 180)))
        const tiltAngle = 35.264 * Math.PI / 180;
        // Obrót wokół osi Y (yaw) dla izometrii: 45 stopni
        const yawAngle = 45 * Math.PI / 180;
        
        const distance = 1000; // Stały dystans odsunięcia kamery (nie wpływa na skalowanie w Ortho, ale pozycjonuje)

        this.camera.position.x = focusX + Math.cos(yawAngle) * Math.cos(tiltAngle) * distance;
        this.camera.position.y = Math.sin(tiltAngle) * distance;
        this.camera.position.z = focusZ + Math.sin(yawAngle) * Math.cos(tiltAngle) * distance;
        
        // Kamera patrzy bezpośrednio na środek aktualnej pozycji gracza/świata 2D
        this.camera.lookAt(focusX, 0, focusZ);

        // 4. Render klatki
        this.renderer.render(this.scene, this.camera);
    }
};
