// generate_stages.js v6
// Stages 1-25: hand-crafted maps (preserved from editor)
// Stages 26-300: procedural with hand-crafted-style shapes
// All stages include initialFill field
// Run: node generate_stages.js

const fs = require('fs');

// --- HSL to hex ---
function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1/6) return p + (q-p)*6*t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q-p)*(2/3-t)*6;
            return p;
        };
        r = hue2rgb(p, q, h+1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h-1/3);
    }
    const ri = Math.min(255, Math.round(r*255));
    const gi = Math.min(255, Math.round(g*255));
    const bi = Math.min(255, Math.round(b*255));
    return ((ri << 16) | (gi << 8) | bi).toString(16).padStart(6, '0');
}

const PALETTES = [
    [0xFF3333, 0x3388FF, 0x00E080, 0xFFCC00, 0x9900FF, 0xFF8800],
    [0xFF0088, 0x00E5FF, 0x88FF00, 0xFFAA00, 0x5500FF, 0xFF2200],
    [0x00FFFF, 0x0044FF, 0x00FF66, 0xFF00CC, 0xFFFF88, 0xFF0000],
    [0xFF8800, 0xCC0033, 0xFFD700, 0x00CC44, 0x9900FF, 0x0088FF],
    [0xFFCC00, 0x66FF00, 0x00FFCC, 0x0088FF, 0xAA00FF, 0xFF0066],
];
const THEME_KEYS = ['NEON', 'GLASS', 'MATTE', 'RETRO', 'METAL'];

// --- Map utilities ---
function emptyMap() {
    return Array.from({length: 8}, () => new Array(8).fill(false));
}

function fillRect(map, x, z, rw, rh) {
    for (let i = x; i < Math.min(x + rw, 8); i++)
        for (let j = z; j < Math.min(z + rh, 8); j++)
            map[i][j] = true;
}

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

// Check if all 'true' cells form one connected component
function isConnected(map) {
    let sx = -1, sz = -1, total = 0;
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++)
        if (map[x][z]) { total++; if (sx < 0) { sx = x; sz = z; } }
    if (total === 0) return false;
    const vis = Array.from({length: 8}, () => new Array(8).fill(false));
    const q = [[sx, sz]]; vis[sx][sz] = true; let cnt = 1;
    while (q.length) {
        const [cx, cz] = q.shift();
        for (const [dx, dz] of DIRS) {
            const nx = cx+dx, nz = cz+dz;
            if (nx>=0&&nx<8&&nz>=0&&nz<8&&map[nx][nz]&&!vis[nx][nz]) {
                vis[nx][nz] = true; cnt++; q.push([nx, nz]);
            }
        }
    }
    return cnt === total;
}

function countTiles(map) {
    let c = 0;
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) if (map[x][z]) c++;
    return c;
}

function neighborCount(map, x, z) {
    return DIRS.filter(([dx,dz]) => {
        const nx=x+dx, nz=z+dz;
        return nx>=0&&nx<8&&nz>=0&&nz<8&&map[nx][nz];
    }).length;
}

// Trim shape to at most maxTiles by removing boundary cells (fewest neighbors first)
// while maintaining connectivity
function trimToMaxTiles(map, maxTiles) {
    let count = countTiles(map);
    if (count <= maxTiles) return;

    while (count > maxTiles) {
        // Build sorted candidate list: fewest neighbors first
        let candidates = [];
        for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
            if (!map[x][z]) continue;
            candidates.push({ x, z, nb: neighborCount(map, x, z) });
        }
        candidates.sort((a, b) => a.nb - b.nb);

        let removed = false;
        for (const c of candidates) {
            map[c.x][c.z] = false;
            if (isConnected(map)) { count--; removed = true; break; }
            map[c.x][c.z] = true; // restore if disconnects
        }
        if (!removed) break; // cannot trim further safely
    }
}

// Remove peninsula cells (< 2 neighbors) iteratively, stop at minCells
function removePeninsulas(map, minCells) {
    let changed = true;
    while (changed) {
        changed = false;
        let count = countTiles(map);
        for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
            if (!map[x][z]) continue;
            if (count <= minCells) break;
            if (neighborCount(map, x, z) < 2) {
                map[x][z] = false; count--; changed = true;
            }
        }
    }
}

// --- Board shape generation (24 types, always 8×8 canvas) ---
// All shapes are drawn on full 8×8 grid; maxTiles trims them for early stages.
// Consecutive stages always use a different shape (24-cycle).
function getBoardShape(stage) {
    const maxTiles = Math.min(64, 15 + Math.floor((stage - 1) / 10) * 5);
    const st = (stage - 1) % 24;
    const map = emptyMap();

    switch (st) {
        case 0: // Full 8×8 block
            fillRect(map, 0, 0, 8, 8);
            break;

        case 1: // Center 6×6 block
            fillRect(map, 1, 1, 6, 6);
            break;

        case 2: // Plus / cross 2-wide
            fillRect(map, 0, 3, 8, 2);
            fillRect(map, 3, 0, 2, 8);
            break;

        case 3: // X-shape (thick diagonals)
            for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++)
                if (Math.abs(x - z) <= 1 || Math.abs(x - (7 - z)) <= 1) map[x][z] = true;
            break;

        case 4: // Diamond (Manhattan distance)
            for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++)
                if (Math.abs(x - 3.5) + Math.abs(z - 3.5) < 4.5) map[x][z] = true;
            break;

        case 5: // Outer frame 2-wide border
            fillRect(map, 0, 0, 8, 8);
            for (let x = 2; x < 6; x++) for (let z = 2; z < 6; z++) map[x][z] = false;
            break;

        case 6: // L — top-left corner (2-wide arms)
            fillRect(map, 0, 5, 8, 3);
            fillRect(map, 0, 0, 3, 8);
            break;

        case 7: // L — top-right corner (2-wide arms)
            fillRect(map, 0, 5, 8, 3);
            fillRect(map, 5, 0, 3, 8);
            break;

        case 8: // L — bottom-left corner (2-wide arms)
            fillRect(map, 0, 0, 8, 3);
            fillRect(map, 0, 0, 3, 8);
            break;

        case 9: // L — bottom-right corner (2-wide arms)
            fillRect(map, 0, 0, 8, 3);
            fillRect(map, 5, 0, 3, 8);
            break;

        case 10: // T — top bar + center stem down
            fillRect(map, 0, 5, 8, 3);
            fillRect(map, 3, 0, 2, 8);
            break;

        case 11: // T — bottom bar + center stem up
            fillRect(map, 0, 0, 8, 3);
            fillRect(map, 3, 0, 2, 8);
            break;

        case 12: // T — left bar + center beam right
            fillRect(map, 0, 0, 3, 8);
            fillRect(map, 0, 3, 8, 2);
            break;

        case 13: // T — right bar + center beam left
            fillRect(map, 5, 0, 3, 8);
            fillRect(map, 0, 3, 8, 2);
            break;

        case 14: // H-shape
            fillRect(map, 0, 0, 3, 8);
            fillRect(map, 5, 0, 3, 8);
            fillRect(map, 0, 3, 8, 2);
            break;

        case 15: // U-shape (open top)
            fillRect(map, 0, 0, 8, 3);
            fillRect(map, 0, 0, 3, 8);
            fillRect(map, 5, 0, 3, 8);
            break;

        case 16: // C-shape (open right)
            fillRect(map, 0, 0, 3, 8);
            fillRect(map, 0, 0, 8, 3);
            fillRect(map, 0, 5, 8, 3);
            break;

        case 17: // S/Z-shape (two offset rectangles)
            fillRect(map, 0, 0, 5, 4);
            fillRect(map, 3, 4, 5, 4);
            break;

        case 18: // Staircase (3 steps, top-left to bottom-right)
            fillRect(map, 0, 0, 3, 8);
            fillRect(map, 3, 2, 3, 6);
            fillRect(map, 6, 4, 2, 4);
            break;

        case 19: // Arrow pointing right (V-shape)
            for (let z = 0; z < 8; z++) {
                const tip = Math.floor(Math.abs(z - 3.5));
                for (let x = tip; x < 8; x++) map[x][z] = true;
            }
            break;

        case 20: // Donut (2-wide border)
            fillRect(map, 0, 0, 8, 8);
            for (let x = 2; x < 6; x++) for (let z = 2; z < 6; z++) map[x][z] = false;
            break;

        case 21: // Diagonal band (NW→SE, 2-wide)
            for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++)
                if (Math.abs(x - z) <= 2) map[x][z] = true;
            break;

        case 22: // I-beam (two bars + center bridge)
            fillRect(map, 0, 0, 8, 2);
            fillRect(map, 0, 6, 8, 2);
            fillRect(map, 3, 0, 2, 8);
            break;

        case 23: // Zigzag snake (3 offset segments)
            fillRect(map, 0, 0, 8, 3);
            fillRect(map, 0, 3, 5, 2);
            fillRect(map, 3, 5, 5, 3);
            break;
    }

    // Trim to tile budget (removes boundary cells first, maintains connectivity)
    trimToMaxTiles(map, maxTiles);

    // Remove peninsula cells (< 2 neighbors); keep at least 60% of budget
    removePeninsulas(map, Math.max(4, Math.floor(maxTiles * 0.6)));

    // Connectivity check with compact-square fallback
    if (!isConnected(map) || countTiles(map) < 4) {
        const fb = emptyMap();
        const side = Math.min(8, Math.ceil(Math.sqrt(maxTiles)) + 1);
        fillRect(fb, 0, 0, side, side);
        trimToMaxTiles(fb, maxTiles);
        let maxX = 0, maxZ = 0;
        for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) if (fb[x][z]) {
            if (x > maxX) maxX = x; if (z > maxZ) maxZ = z;
        }
        return { w: maxX + 1, h: maxZ + 1, map: fb };
    }

    let maxX = 0, maxZ = 0;
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) if (map[x][z]) {
        if (x > maxX) maxX = x; if (z > maxZ) maxZ = z;
    }
    return { w: maxX + 1, h: maxZ + 1, map };
}

// --- Wave-based difficulty ---
function getWaveDifficulty(stage) {
    const wavePos  = ((stage - 1) % 5) + 1;   // 1..5
    const globalT  = (stage - 1) / 299;        // 0..1
    const waveFactor = wavePos / 5;            // 0.2..1.0
    return globalT * 0.55 + waveFactor * 0.45;
}

function calculateStageDifficulty(stage) {
    const shape = getBoardShape(stage);
    const d = getWaveDifficulty(stage);
    const globalT = (stage - 1) / 299;

    // --- Spawn rate (how many blocks between each CORE appearance) ---
    // Lower = COREs appear more often = easier to collect
    const spawnRate = Math.round(Math.max(3, 10 - d * 7));

    // --- Spawn amount per turn ---
    const spawnAmount = Math.max(1, 1 + Math.floor(d * 2));

    // --- Target cores ---
    // ~2x the old formula: stage 1 ≈ 2, stage 150 ≈ 9, stage 300 ≈ 20
    const targetCores = Math.min(20, Math.max(2,
        Math.round(d * 20 * (0.3 + 0.7 * globalT))
    ));

    // --- Turn limit: derived from clearability ---
    // Player needs at least (targetCores * spawnRate / spawnAmount) turns to see enough COREs.
    // Multiply by 2.5 for comfortable margin (board filling, matching time, suboptimal play).
    const minTurnsNeeded = Math.ceil(targetCores * spawnRate / spawnAmount * 2.5);
    const turnLimit = Math.max(15, minTurnsNeeded);

    // --- Obstacle rate ---
    let obstacleRate = 0;
    if (stage > 10) {
        let or = Math.max(2, Math.round(12 - d * 10));
        if (or === spawnRate) or = Math.max(2, or + 1);
        obstacleRate = or;
    }

    return {
        w: shape.w,
        h: shape.h,
        map: shape.map,
        colors:      Math.min(6, Math.max(2, 2 + Math.floor(d * 4))),
        spawnAmount,
        spawnRate,
        targetCores,
        obstacleRate,
        turnLimit,
    };
}

// --- Visuals (golden-angle hue rotation for maximum variety) ---
function generateVisuals(stage) {
    const colorPhase = Math.floor((stage - 1) / 5);
    const stylePhase = Math.floor((stage - 1) / 10);
    const baseHue = (colorPhase * 137) % 360;
    return {
        bg:           hslToHex(baseHue/360, 0.5, 0.08),
        grid:         hslToHex(baseHue/360, 0.9, 0.6),
        plane:        hslToHex(baseHue/360, 0.3, 0.15),
        paletteIndex: colorPhase % PALETTES.length,
        theme:        THEME_KEYS[stylePhase % THEME_KEYS.length]
    };
}

// --- Hand-crafted maps for stages 1-25 ---
// Format: [map, w, h, cores, turns, spawnRate, spawn, obstacles, initialFill]
// initialFill = fraction of valid tiles pre-filled at stage start
const HANDCRAFTED = [
  // Stage 1 — small 3x3 center cluster
  { map:["00000000","00000000","00000000","00111000","00111000","00111000","00000000","00000000"], w:8,h:8, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:0,initialFill:0.30 },
  // Stage 2 — 2x4 center bar
  { map:["0000000","0000000","0000000","0011110","0011110","0000000","0000000"], w:7,h:7, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:0,initialFill:0.30 },
  // Stage 3 — L-shape small
  { map:["00000000","00000000","00000000","00011110","00011110","00011000","00011000","00000000"], w:8,h:8, cores:2,turns:40,spawnRate:8,spawn:1,obstacles:0,initialFill:0.30 },
  // Stage 4 — hollow square
  { map:["00000000","00000000","00111100","00110100","00101100","00111100","00000000","00000000"], w:8,h:8, cores:2,turns:35,spawnRate:7,spawn:1,obstacles:0,initialFill:0.35 },
  // Stage 5 — diamond
  { map:["00000000","00000000","00011000","00111100","00111100","00011000","00000000"], w:8,h:7, cores:3,turns:53,spawnRate:7,spawn:1,obstacles:0,initialFill:0.35 },
  // Stage 6 — H-fragment
  { map:["00000000","00000000","00011011","00011111","00011111","00011011","00000000","00000000"], w:8,h:8, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:0,initialFill:0.35 },
  // Stage 7 — offset steps
  { map:["00000000","00000000","00000000","00111000","00111000","00001110","00001110","00000000"], w:8,h:8, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:0,initialFill:0.35 },
  // Stage 8 — two separate 2x3 pillars
  { map:["00000000","00000000","01100110","01100110","01100110","00000000","00000000","00000000"], w:8,h:8, cores:2,turns:40,spawnRate:8,spawn:1,obstacles:0,initialFill:0.35 },
  // Stage 9 — tiny wide strip
  { map:["00011101","00010101","00010111"], w:8,h:3, cores:2,turns:35,spawnRate:7,spawn:1,obstacles:0,initialFill:0.35 },
  // Stage 10 — mini ring/bracket
  { map:["00000000","00000000","00000111","00000101","00000101","00000111","00000111","00000000"], w:8,h:8, cores:3,turns:53,spawnRate:7,spawn:1,obstacles:0,initialFill:0.35 },
  // Stage 11 — diagonal ribbon
  { map:["00000000","00000000","00000000","00011100","00011110","00001111","00000111","00000011"], w:8,h:8, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:11,initialFill:0.35 },
  // Stage 12 — broken H
  { map:["00000000","00001110","11101110","11100000","00001100","00001100","00001100","00000000"], w:8,h:8, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:10,initialFill:0.35 },
  // Stage 13 — fat L
  { map:["00000000","00000000","00000000","01111111","01111111","01100000","01100000","01100000"], w:8,h:8, cores:2,turns:40,spawnRate:8,spawn:1,obstacles:9,initialFill:0.35 },
  // Stage 14 — staircase
  { map:["00000000","00000100","00001100","00011110","00111111","00110011","00000000","00000000"], w:8,h:8, cores:3,turns:53,spawnRate:7,spawn:1,obstacles:8,initialFill:0.35 },
  // Stage 15 — E-shape / comb
  { map:["00000000","00000000","01111110","00000110","01111110","00000110","01111110","00000000"], w:8,h:8, cores:3,turns:53,spawnRate:7,spawn:1,obstacles:8,initialFill:0.35 },
  // Stage 16 — checkerboard bands
  { map:["00000000","01010100","01010100","01010100","00101010","00101010","00101010","00000000"], w:8,h:8, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:11,initialFill:0.35 },
  // Stage 17 — C-bracket
  { map:["00000011","00000011","00111111","00100000","00100000","00111111","00000011","00000011"], w:8,h:8, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:10,initialFill:0.35 },
  // Stage 18 — two offset rectangles
  { map:["11100000","11100000","11100000","00000000","00011111","00011111","00011111","00011111"], w:8,h:8, cores:2,turns:40,spawnRate:8,spawn:1,obstacles:9,initialFill:0.35 },
  // Stage 19 — double bracket (pair of mini squares)
  { map:["00000000","00111000","00101000","00111000","00001110","00001010","00001110","00000000"], w:8,h:8, cores:3,turns:53,spawnRate:7,spawn:1,obstacles:8,initialFill:0.35 },
  // Stage 20 — arrow shape
  { map:["00000000","00010000","00111000","00010100","00001110","00000100","00000000","00000000"], w:8,h:8, cores:3,turns:53,spawnRate:7,spawn:1,obstacles:8,initialFill:0.35 },
  // Stage 21 — thin cross/T
  { map:["00000000","00000000","00001000","00011100","00001000","00001000","00001000","00000000"], w:8,h:8, cores:2,turns:45,spawnRate:9,spawn:1,obstacles:11,initialFill:0.30 },
  // Stage 22 — diagonal Z
  { map:["00000000","00000000","00111000","00101100","00110110","00011011","00001101","00000111"], w:8,h:8, cores:2,turns:40,spawnRate:8,spawn:1,obstacles:10,initialFill:0.35 },
  // Stage 23 — symmetric butterfly
  { map:["00000000","00001110","00001010","00111010","00100000","00111010","00001010","00001110"], w:8,h:8, cores:2,turns:40,spawnRate:8,spawn:1,obstacles:9,initialFill:0.35 },
  // Stage 24 — ring / square frame
  { map:["00000000","01111111","01000001","01011101","01011101","01000001","01111111","00000000"], w:8,h:8, cores:3,turns:53,spawnRate:7,spawn:1,obstacles:8,initialFill:0.35 },
  // Stage 25 — S-curve
  { map:["00000000","01100000","01111000","00011000","00000110","00011110","00011000","00000000"], w:8,h:8, cores:4,turns:70,spawnRate:7,spawn:1,obstacles:8,initialFill:0.35 },
];

// --- Hand-crafted-style map library for stages 26-300 ---
// 55 unique 8x8 map patterns, cycled and varied with difficulty scaling
const MAP_LIBRARY = [
  // 26 — plus-ring combo
  ["00000000","00011000","00111100","01111110","01100110","00111100","00011000","00000000"],
  // 27 — two diagonal lines
  ["10000001","11000011","01100110","00111100","00111100","01100110","11000011","10000001"],
  // 28 — stacked T
  ["00000000","01111110","00011000","00011000","01111110","00011000","00011000","00000000"],
  // 29 — pinwheel
  ["11100000","11100000","00011100","00011100","00000011","11100011","11100000","00000000"],
  // 30 — anchor
  ["00011000","00111100","00011000","01111110","01111110","00111100","01011010","11000011"],
  // 31 — window grid (connected)
  ["00000000","01111110","01100110","01111110","01111110","01100110","01111110","00000000"],
  // 32 — bracket pair
  ["01100110","11000011","10000001","10000001","10000001","10000001","11000011","01100110"],
  // 33 — thick frame
  ["11111111","11111111","11000011","11000011","11000011","11000011","11111111","11111111"],
  // 34 — H thick
  ["01100110","01100110","01111110","01111110","01111110","01111110","01100110","01100110"],
  // 35 — spiral arm
  ["00000000","01111100","01000000","01011100","01010000","01111100","00000000","00000000"],
  // 36 — two L's mirrored
  ["01100000","01100000","01111100","00000000","00111110","00000110","00000110","00000000"],
  // 37 — arrow left+right
  ["00011000","00111100","01111110","11111111","11111111","01111110","00111100","00011000"],
  // 38 — I-beam horizontal
  ["00011000","00011000","11111111","11111111","11111111","11111111","00011000","00011000"],
  // 39 — three stripes
  ["00000000","11111111","00000000","11111111","00000000","11111111","00000000","00000000"],
  // 40 — connected quad-blocks
  ["01111110","01111110","11111111","11000011","11000011","11111111","01111110","01111110"],
  // 41 — maze fragment
  ["11110000","10010000","10011110","10000010","11110010","00010010","00011110","00000000"],
  // 42 — Z thick
  ["11111100","00001100","00011000","00110000","01100000","11000000","11111100","00000000"],
  // 43 — triangle
  ["00011000","00111100","01111110","11111111","00000000","00000000","00000000","00000000"],
  // 44 — double ring
  ["01111110","10000001","10111101","10100101","10100101","10111101","10000001","01111110"],
  // 45 — filled oval
  ["00111100","01111110","11111111","11111111","11111111","11111111","01111110","00111100"],
  // 46 — S-curve wide
  ["11110000","11110000","01111100","00111100","00111110","00011111","00001111","00000000"],
  // 47 — S-snake wide
  ["11110000","11110000","00001100","00001100","11110000","11110000","00001111","00001111"],
  // 48 — nested Ls
  ["11111111","10000000","10111110","10100000","10101110","10100010","10111110","10000000"],
  // 49 — fat plus
  ["00011000","00011000","11111111","11111111","11111111","11111111","00011000","00011000"],
  // 50 — star of tiles
  ["00011000","01111110","11111111","01111110","01111110","11111111","01111110","00011000"],
  // 51 — thin zigzag
  ["11000000","01100000","00110000","00011000","00001100","00000110","00000011","00000001"],
  // 52 — wide step-L
  ["11111000","10001000","10011000","10110000","11100000","00000000","00000000","00000000"],
  // 53 — crescent
  ["00111100","01111110","11000011","11000001","11000001","11000011","01111110","00111100"],
  // 54 — letter N (thick, connected)
  ["11000110","11001110","11011110","11111110","11110110","11100110","11000110","11000110"],
  // 55 — tiling T
  ["11111111","00011000","00011000","11111111","00011000","00011000","11111111","00000000"],
  // 56 — corner notches
  ["11100111","11000011","10000001","00000000","00000000","10000001","11000011","11100111"],
  // 57 — fat X
  ["11000011","11100111","01111110","00111100","00111100","01111110","11100111","11000011"],
  // 58 — thin L reverse
  ["00000111","00000100","00000100","00000100","11111100","10000000","10000000","00000000"],
  // 59 — rounded ring (2-wide border)
  ["00111100","01100110","11000011","11000011","11000011","11000011","01100110","00111100"],
  // 60 — pipe cross
  ["00010000","00010000","11111111","00010000","00010000","00010000","11111111","00010000"],
  // 61 — thick diagonal
  ["11000000","11100000","01110000","00111000","00011100","00001110","00000111","00000011"],
  // 62 — two L columns
  ["10011001","10011001","10011001","10011001","11111111","00000000","00000000","00000000"],
  // 63 — eye shape
  ["00111100","01100110","11000011","11111111","11111111","11000011","01100110","00111100"],
  // 64 — nested rectangles
  ["11111111","10000001","10111101","10100101","10100101","10111101","10000001","11111111"],
  // 65 — half + reverse half
  ["11110000","11110000","11110000","11110000","00001111","00001111","00001111","00001111"],
  // 66 — diamond filled
  ["00011000","00111100","01111110","11111111","11111111","01111110","00111100","00011000"],
  // 67 — H-bridge
  ["11000011","11000011","11111111","11000011","11000011","11111111","11000011","11000011"],
  // 68 — thick border
  ["11111111","11000011","11000011","11000011","11000011","11000011","11000011","11111111"],
  // 69 — T top
  ["11111111","11111111","00011000","00011000","00011000","00011000","00011000","00000000"],
  // 70 — staircase reverse
  ["00000011","00000111","00001110","00011100","00111000","01110000","11100000","00000000"],
  // 71 — comb horizontal
  ["11111111","10101010","10101010","11111111","01010101","01010101","11111111","00000000"],
  // 72 — arch (connected)
  ["00111100","01100110","11000011","11000011","11000011","00000000","00000000","00000000"],
  // 73 — double bracket H
  ["11001100","11001100","11111111","11001100","11001100","11111111","11001100","11001100"],
  // 74 — lightning bolt
  ["00011110","00011000","00110000","01111110","00000110","00001100","11110000","00000000"],
  // 75 — circle (approx)
  ["00111100","01100110","11000011","11000011","11000011","11000011","01100110","00111100"],
  // 76 — pinstripe cross
  ["00111100","00111100","11111111","11111111","11111111","11111111","00111100","00111100"],
  // 77 — hourglass
  ["11111111","01111110","00111100","00011000","00011000","00111100","01111110","11111111"],
  // 78 — interlocked U
  ["11000011","11000011","11000011","11111111","11111111","00011000","00011000","00011000"],
  // 79 — asymmetric blob
  ["00111100","01111110","11111110","11111111","01111100","00111000","00011000","00000000"],
  // 80 — column pair wide
  ["01111110","01000010","01000010","01000010","01000010","01000010","01000010","01111110"],
];

// --- Difficulty parameters for stages 26-300 ---
function getDiffParams(stage) {
    const t = (stage - 1) / 299; // 0..1
    const wave = ((stage - 1) % 5) / 4; // 0..1 within each 5-stage wave
    const d = t * 0.55 + wave * 0.45;

    const spawnRate = Math.round(Math.max(3, 10 - d * 7));
    const spawnAmount = Math.max(1, 1 + Math.floor(d * 2));
    const targetCores = Math.min(20, Math.max(2, Math.round(d * 20 * (0.3 + 0.7 * t))));
    const minTurns = Math.ceil(targetCores * spawnRate / spawnAmount * 2.5);
    const turnLimit = Math.max(15, minTurns);
    const obstacleRate = stage <= 25 ? 0 : Math.max(2, Math.round(12 - d * 10));
    const colors = Math.min(6, Math.max(2, 2 + Math.floor(d * 4)));
    // initialFill: starts 0.30 for early stages, climbs to 0.45 for late stages
    const initialFill = parseFloat((0.30 + t * 0.15).toFixed(2));

    return { spawnRate, spawnAmount, targetCores, turnLimit, obstacleRate, colors, initialFill };
}

// Convert row-string map to {w, h}
function mapDims(mapRows) {
    return { w: mapRows[0].length, h: mapRows.length };
}

// --- Generate 300 stages ---
const stages = [];

// Stages 1-25: hand-crafted
for (let i = 0; i < 25; i++) {
    const hc = HANDCRAFTED[i];
    const vis = generateVisuals(i + 1);
    stages.push({
        id:       i + 1,
        w:        hc.w,
        h:        hc.h,
        map:      hc.map,
        colors:   hc.cores <= 2 ? 2 : 3,
        spawn:    hc.spawn,
        spawnRate: hc.spawnRate,
        cores:    hc.cores,
        obstacles: hc.obstacles,
        turns:    hc.turns,
        initialFill: hc.initialFill,
        theme:    vis.theme,
        palette:  vis.paletteIndex,
        bg:       vis.bg,
        grid:     vis.grid,
        plane:    vis.plane,
    });
}

// Stages 26-300: procedural using MAP_LIBRARY
for (let i = 26; i <= 300; i++) {
    const p = getDiffParams(i);
    const vis = generateVisuals(i);

    // Pick map from library, cycling through with offset so stage 26 = map index 0
    const mapIdx = (i - 26) % MAP_LIBRARY.length;
    const mapRows = MAP_LIBRARY[mapIdx];
    const dims = mapDims(mapRows);

    stages.push({
        id:       i,
        w:        dims.w,
        h:        dims.h,
        map:      mapRows,
        colors:   p.colors,
        spawn:    p.spawnAmount,
        spawnRate: p.spawnRate,
        cores:    p.targetCores,
        obstacles: p.obstacleRate,
        turns:    p.turnLimit,
        initialFill: p.initialFill,
        theme:    vis.theme,
        palette:  vis.paletteIndex,
        bg:       vis.bg,
        grid:     vis.grid,
        plane:    vis.plane,
    });
}

fs.writeFileSync('stages.json', JSON.stringify({ stages }, null, 2));
console.log(`Generated stages.json with ${stages.length} stages.`);

// --- Verification report ---
console.log('\n=== Clearability check (stages 1–20): minTurns vs turnLimit ===');
for (let i = 1; i <= 20; i++) {
    const diff = calculateStageDifficulty(i);
    const minT = Math.ceil(diff.targetCores * diff.spawnRate / diff.spawnAmount);
    const ratio = (diff.turnLimit / minT).toFixed(2);
    let cells = 0;
    for (let x=0;x<8;x++) for (let z=0;z<8;z++) if(diff.map[x][z]) cells++;
    console.log(`  Stage ${String(i).padStart(3)}: cells=${String(cells).padStart(2)} cores=${String(diff.targetCores).padStart(2)} spawnRate=${diff.spawnRate} minTurns=${String(minT).padStart(3)} turns=${String(diff.turnLimit).padStart(3)} ratio=${ratio}x`);
}
console.log('\n=== Key milestones ===');
[1,50,100,150,200,250,300].forEach(i => {
    const d = getWaveDifficulty(i);
    const diff = calculateStageDifficulty(i);
    const minT = Math.ceil(diff.targetCores * diff.spawnRate / diff.spawnAmount);
    const obs = diff.obstacleRate === 0 ? 'none' : `1/${diff.obstacleRate}`;
    console.log(`  Stage ${String(i).padStart(3)}: d=${d.toFixed(3)} cores=${diff.targetCores} spawnRate=${diff.spawnRate} spawn=${diff.spawnAmount} minTurns=${minT} turns=${diff.turnLimit} (${(diff.turnLimit/minT).toFixed(1)}x) obstacles=${obs}`);
});
