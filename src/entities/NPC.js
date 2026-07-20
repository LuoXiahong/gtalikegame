import { Entity } from './Entity.js';
import { PedestrianPaths } from '../world/PedestrianPaths.js';

export class NPC extends Entity {
    constructor(id, x, y, color, waypoints = null) {
        super(id, 'npc', x, y);
        this.transform.width = 18;
        this.transform.height = 18;
        this.physics = { velX: 0, velY: 0, speed: 80, friction: 1 };
        this.visual.color = color;

        // Domyślnie: pętla po chodniku najbliższego bloku (nie skróty przez jezdnię)
        let pts = waypoints;
        if (!pts) {
            const near = PedestrianPaths.nearestSidewalkPoint(x, y);
            // Znajdź pętlę zawierającą ten punkt (po inset)
            const loops = PedestrianPaths.getAllSidewalkLoops();
            let bestLoop = loops[0]?.points || [near];
            let bestD = Infinity;
            loops.forEach(({ points }) => {
                points.forEach(p => {
                    const d = (p.x - near.x) ** 2 + (p.y - near.y) ** 2;
                    if (d < bestD) {
                        bestD = d;
                        bestLoop = points;
                    }
                });
            });
            pts = bestLoop.map(p => ({ x: p.x, y: p.y }));
            // Start na najbliższym punkcie pętli
            let startIdx = 0;
            let startD = Infinity;
            pts.forEach((p, i) => {
                const d = (p.x - x) ** 2 + (p.y - y) ** 2;
                if (d < startD) {
                    startD = d;
                    startIdx = i;
                }
            });
            this.transform.x = pts[startIdx].x;
            this.transform.y = pts[startIdx].y;
            this.ai = {
                state: 'idle',
                timer: 1 + Math.random() * 2,
                waypoints: pts,
                currentWaypointIndex: (startIdx + 1) % pts.length,
                returningToSidewalk: false
            };
            return;
        }

        this.ai = {
            state: 'idle',
            timer: 1 + Math.random() * 2,
            waypoints: pts,
            currentWaypointIndex: 0,
            returningToSidewalk: false
        };
    }
}
