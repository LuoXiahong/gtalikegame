/**
 * Traffic path network from WorldGrid — lanes sit on real street axes (1100 / 1800),
 * segmented at every intersection so cars can turn instead of only running the axis.
 *
 * Right-hand traffic in y-down screen space: the right side of a heading (dx, dy) is
 * (-dy, dx). Southbound therefore keeps west (−x), northbound east (+x), eastbound
 * south (+y), westbound north (−y).
 */
import { WorldGrid } from './WorldGrid.js';

const LANE_OFFSET = 35; // Offset from street center (STREET_WIDTH=200 → safe lane)
const PATH_MARGIN = WorldGrid.PADDING + 50; // 550 — stay on asphalt
const PATH_MAX = 3000 - WorldGrid.PADDING - 50; // 2450

/** Opposite travel direction per lane suffix — used for edge-of-city turnarounds. */
const OPPOSITE_DIR = { S: 'N', N: 'S', E: 'W', W: 'E' };

/** Above this dot product an outgoing edge counts as "straight on", not a turn. */
const STRAIGHT_DOT = 0.7;

/**
 * Intersection node id. `v` is the vertical lane through it (S = southbound at cx−offset,
 * N = northbound at cx+offset), `h` the horizontal one (E = eastbound at cy+offset,
 * W = westbound at cy−offset). Each node is exactly where those two lanes cross, so its
 * two outgoing edges are "continue" and "turn" for either arrival direction — and never
 * a U-turn.
 */
function interId(i, j, v, h) {
    return `I${i}_${j}_${v}${h}`;
}

function buildNetwork() {
    const centers = WorldGrid.getStreetCenters(); // [1100, 1800]
    const nodes = {};
    const lanes = {};

    const addNode = (id, x, y) => {
        nodes[id] = { id, x, y };
        return id;
    };

    centers.forEach((cx, i) => {
        centers.forEach((cy, j) => {
            addNode(interId(i, j, 'S', 'W'), cx - LANE_OFFSET, cy - LANE_OFFSET);
            addNode(interId(i, j, 'S', 'E'), cx - LANE_OFFSET, cy + LANE_OFFSET);
            addNode(interId(i, j, 'N', 'E'), cx + LANE_OFFSET, cy + LANE_OFFSET);
            addNode(interId(i, j, 'N', 'W'), cx + LANE_OFFSET, cy - LANE_OFFSET);
        });
    });

    centers.forEach((cx, i) => {
        // Southbound rides west of centre, northbound east — right-hand traffic.
        const southLane = [addNode(`T_NS${i}_S_in`, cx - LANE_OFFSET, PATH_MARGIN)];
        centers.forEach((cy, j) => {
            southLane.push(interId(i, j, 'S', 'W'), interId(i, j, 'S', 'E'));
        });
        southLane.push(addNode(`T_NS${i}_S_out`, cx - LANE_OFFSET, PATH_MAX));
        lanes[`NS_${i}_S`] = southLane;

        const northLane = [addNode(`T_NS${i}_N_in`, cx + LANE_OFFSET, PATH_MAX)];
        for (let j = centers.length - 1; j >= 0; j--) {
            northLane.push(interId(i, j, 'N', 'E'), interId(i, j, 'N', 'W'));
        }
        northLane.push(addNode(`T_NS${i}_N_out`, cx + LANE_OFFSET, PATH_MARGIN));
        lanes[`NS_${i}_N`] = northLane;
    });

    centers.forEach((cy, j) => {
        // Eastbound rides south of centre, westbound north — right-hand traffic.
        const eastLane = [addNode(`T_EW${j}_E_in`, PATH_MARGIN, cy + LANE_OFFSET)];
        centers.forEach((cx, i) => {
            eastLane.push(interId(i, j, 'S', 'E'), interId(i, j, 'N', 'E'));
        });
        eastLane.push(addNode(`T_EW${j}_E_out`, PATH_MAX, cy + LANE_OFFSET));
        lanes[`EW_${j}_E`] = eastLane;

        const westLane = [addNode(`T_EW${j}_W_in`, PATH_MAX, cy - LANE_OFFSET)];
        for (let i = centers.length - 1; i >= 0; i--) {
            westLane.push(interId(i, j, 'N', 'W'), interId(i, j, 'S', 'W'));
        }
        westLane.push(addNode(`T_EW${j}_W_out`, PATH_MARGIN, cy - LANE_OFFSET));
        lanes[`EW_${j}_W`] = westLane;
    });

    const graph = {};
    const link = (a, b) => {
        if (!graph[a]) graph[a] = [];
        if (!graph[b]) graph[b] = [];
        if (!graph[a].includes(b)) graph[a].push(b);
    };

    Object.values(lanes).forEach(lane => {
        for (let k = 0; k < lane.length - 1; k++) link(lane[k], lane[k + 1]);
    });

    // City edge is a dead end (only grass beyond) — hand the car to the opposite lane
    // of the same street so the network stays strongly connected without despawns.
    Object.keys(lanes).forEach(name => {
        const [axis, index, dir] = name.split('_');
        const opposite = lanes[`${axis}_${index}_${OPPOSITE_DIR[dir]}`];
        const lane = lanes[name];
        link(lane[lane.length - 1], opposite[0]);
    });

    const edges = [];
    Object.keys(graph).forEach(from => {
        graph[from].forEach(to => {
            const a = nodes[from];
            const b = nodes[to];
            edges.push({ from, to, length: Math.hypot(b.x - a.x, b.y - a.y) });
        });
    });

    const paths = {};
    Object.keys(lanes).forEach(name => {
        paths[name] = lanes[name].map(id => nodes[id]);
    });

    return { nodes, lanes, graph, edges, paths };
}

const network = buildNetwork();

export const Waypoints = {
    LANE_OFFSET,
    PATH_MARGIN,
    PATH_MAX,
    /** Lane polylines as point arrays — road sampling (spawns, police) reads these. */
    paths: network.paths,
    /** id → { id, x, y } */
    nodes: network.nodes,
    /** lane name → ordered node ids */
    lanes: network.lanes,
    /** node id → outgoing node ids */
    graph: network.graph,
    /** flat directed edge list with precomputed length */
    edges: network.edges,

    getNode(id) {
        return network.nodes[id] || null;
    },

    getSuccessors(id) {
        return network.graph[id] || [];
    },

    /**
     * Split the outgoing edges of `id` into straight / right / left, given the car
     * arrived from `fromId`. Pure topology — the choice itself belongs to TrafficSystem.
     * @returns {{ straight: string|null, right: string|null, left: string|null, all: string[] }}
     */
    turnOptions(id, fromId) {
        const all = network.graph[id] || [];
        const result = { straight: null, right: null, left: null, all };
        const node = network.nodes[id];
        const from = fromId != null ? network.nodes[fromId] : null;
        if (!node || !from || all.length === 0) return result;

        const inLen = Math.hypot(node.x - from.x, node.y - from.y);
        if (inLen < 1e-6) return result;
        const inX = (node.x - from.x) / inLen;
        const inY = (node.y - from.y) / inLen;

        for (const id2 of all) {
            const next = network.nodes[id2];
            const outLen = Math.hypot(next.x - node.x, next.y - node.y);
            if (outLen < 1e-6) continue;
            const outX = (next.x - node.x) / outLen;
            const outY = (next.y - node.y) / outLen;

            if (inX * outX + inY * outY > STRAIGHT_DOT) {
                result.straight = id2;
            } else if (outX * -inY + outY * inX > 0) {
                result.right = id2;
            } else {
                result.left = id2;
            }
        }
        return result;
    }
};
