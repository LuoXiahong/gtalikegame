import { Entity } from './Entity.js';

export class NPC extends Entity {
    constructor(id, x, y, color, waypoints = null) {
        super(id, 'npc', x, y);
        this.transform.width = 18;
        this.transform.height = 18;
        this.physics = { velX: 0, velY: 0, speed: 80, friction: 1 };
        this.visual.color = color;

        // Jeśli punkty drogi (waypoints) nie są przekazane, generujemy domyślną pętlę 3 punktów
        const pts = waypoints || [
            { x: x, y: y },
            { x: x + 120, y: y },
            { x: x + 60, y: y + 80 }
        ];

        // Komponent: Sztuczna Inteligencja (FSM)
        this.ai = { 
            state: 'idle', 
            timer: 1 + Math.random() * 2,
            waypoints: pts,
            currentWaypointIndex: 0
        };
    }
}
