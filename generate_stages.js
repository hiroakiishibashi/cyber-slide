// generate_stages.js v4
// Tile-count-based progression: stage 1-10 max 10 tiles, +5 per 10 stages
// No peninsula cells (each cell needs 2+ neighbors)
// Halved turn limits, significantly more target cores
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

// --- Board shape generation (18 types) ---
// sz: base canvas size 4–8 (same progression as before)
// maxTiles: tile budget = min(64, 10 + floor((stage-1)/10)*5)
function getBoardShape(stage) {
    const sz = Math.min(8, Math.max(4, 3 + Math.floor((stage - 1) / 10)));
    const maxTiles = Math.min(64, 10 + Math.floor((stage - 1) / 10) * 5);
    const st = (stage - 1) % 18;
    const map = emptyMap();

    switch (st) {
        case 0: // Full square
            fillRect(map, 0, 0, sz, sz);
            break;

        case 1: // Wide rectangle
            fillRect(map, 0, 0, sz, Math.max(2, sz - 1));
            break;

        case 2: // Tall rectangle
            fillRect(map, 0, 0, Math.max(2, sz - 1), sz);
            break;

        case 3: { // Plus / cross
            const m = Math.floor(sz / 2);
            fillRect(map, 0, m-1, sz, 2);
            fillRect(map, m-1, 0, 2, sz);
            break;
        }

        case 4: { // L — bottom-left corner
            const a = Math.max(2, Math.ceil(sz * 0.45));
            fillRect(map, 0, 0, sz, a);
            fillRect(map, 0, 0, a, sz);
            break;
        }

        case 5: { // L — top-right corner
            const a = Math.max(2, Math.ceil(sz * 0.45));
            fillRect(map, 0, sz-a, sz, a);
            fillRect(map, sz-a, 0, a, sz);
            break;
        }

        case 6: { // L — bottom-right corner
            const a = Math.max(2, Math.ceil(sz * 0.45));
            fillRect(map, 0, 0, sz, a);
            fillRect(map, sz-a, 0, a, sz);
            break;
        }

        case 7: { // L — top-left corner
            const a = Math.max(2, Math.ceil(sz * 0.45));
            fillRect(map, 0, sz-a, sz, a);
            fillRect(map, 0, 0, a, sz);
            break;
        }

        case 8: { // T — bar on top, center pillar going down
            const pw = Math.max(2, Math.ceil(sz * 0.4));
            const bh = Math.max(2, Math.ceil(sz * 0.4));
            const mx = Math.floor((sz - pw) / 2);
            fillRect(map, 0, sz-bh, sz, bh);
            fillRect(map, mx, 0, pw, sz);
            break;
        }

        case 9: { // T — bar on bottom, center pillar going up
            const pw = Math.max(2, Math.ceil(sz * 0.4));
            const bh = Math.max(2, Math.ceil(sz * 0.4));
            const mx = Math.floor((sz - pw) / 2);
            fillRect(map, 0, 0, sz, bh);
            fillRect(map, mx, 0, pw, sz);
            break;
        }

        case 10: { // U-shape (open top)
            const aw = Math.max(2, Math.ceil(sz * 0.35));
            const bh = Math.max(2, Math.ceil(sz * 0.35));
            fillRect(map, 0, 0, sz, bh);
            fillRect(map, 0, 0, aw, sz);
            fillRect(map, sz-aw, 0, aw, sz);
            break;
        }

        case 11: { // C-shape (open right)
            const aw = Math.max(2, Math.ceil(sz * 0.35));
            const sh = Math.max(2, Math.ceil(sz * 0.35));
            fillRect(map, 0, 0, aw, sz);
            fillRect(map, 0, 0, sz, sh);
            fillRect(map, 0, sz-sh, sz, sh);
            break;
        }

        case 12: { // Diamond (Manhattan distance from center)
            const cx = (sz-1)/2, cz = (sz-1)/2, r = (sz-1)/2 + 0.5;
            for (let x = 0; x < sz; x++)
                for (let z = 0; z < sz; z++)
                    if (Math.abs(x-cx) + Math.abs(z-cz) <= r) map[x][z] = true;
            break;
        }

        case 13: { // Donut (square with center hole)
            fillRect(map, 0, 0, sz, sz);
            const hs = Math.max(0, sz - 4);
            if (hs > 0) {
                for (let x = 2; x < 2+hs; x++)
                    for (let z = 2; z < 2+hs; z++)
                        map[x][z] = false;
            }
            break;
        }

        case 14: { // Staircase
            const step = Math.max(1, Math.floor(sz / 3));
            for (let s = 0; s < 3; s++) {
                const x0 = s * step;
                const z1 = sz - 1 - s * step;
                const z0 = Math.max(0, z1 - step + 1);
                fillRect(map, x0, z0, sz - x0, z1 - z0 + 1);
            }
            break;
        }

        case 15: { // H-shape
            const aw = Math.max(2, Math.ceil(sz * 0.35));
            const bh = Math.max(2, Math.ceil(sz * 0.3));
            const mz = Math.floor((sz - bh) / 2);
            fillRect(map, 0, 0, aw, sz);
            fillRect(map, sz-aw, 0, aw, sz);
            fillRect(map, 0, mz, sz, bh);
            break;
        }

        case 16: { // Arrow pointing right
            const mid = Math.floor((sz-1) / 2);
            for (let z = 0; z < sz; z++) {
                const dist = Math.abs(z - mid);
                fillRect(map, dist, z, sz - dist, 1);
            }
            break;
        }

        case 17: { // S-shape / zigzag
            const segH = Math.ceil(sz / 2);
            const segW = Math.max(2, Math.ceil(sz * 0.65));
            fillRect(map, 0, 0, segW, segH);
            fillRect(map, sz-segW, sz-segH, segW, segH);
            // Bridge the two halves so they're connected
            const bx = Math.floor((sz - segW) / 2);
            fillRect(map, bx, segH-1, segW, 2);
            break;
        }
    }

    // Trim to tile budget (removes boundary/peninsula cells first)
    trimToMaxTiles(map, maxTiles);

    // Remove peninsula cells (cells with < 2 neighbors) — no narrow single-cell connections
    // Keep at least 4 cells as safety floor
    removePeninsulas(map, Math.max(4, Math.floor(maxTiles * 0.6)));

    // Connectivity check with fallback to compact square
    if (!isConnected(map) || countTiles(map) < 4) {
        const fb = emptyMap();
        const side = Math.min(8, Math.ceil(Math.sqrt(maxTiles)) + 1);
        fillRect(fb, 0, 0, side, side);
        trimToMaxTiles(fb, maxTiles);
        let maxX = 0, maxZ = 0;
        for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) if (fb[x][z]) {
            if (x > maxX) maxX = x; if (z > maxZ) maxZ = z;
        }
        return { w: maxX+1, h: maxZ+1, map: fb };
    }

    let maxX = 0, maxZ = 0;
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) if (map[x][z]) {
        if (x > maxX) maxX = x; if (z > maxZ) maxZ = z;
    }
    return { w: maxX+1, h: maxZ+1, map };
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

    // --- Spawn rate ---
    const spawnRate = Math.round(Math.max(3, 10 - d * 7));

    // --- Target cores (significantly more than before) ---
    // Stage 1 ≈ 8, Stage 150 ≈ 40, Stage 300 ≈ 80
    const targetCores = Math.min(80, Math.max(5,
        Math.round(5 + (d * 0.4 + globalT * 0.6) * 75)
    ));

    // --- Turn limit (halved from previous formula) ---
    const turnLimit = Math.round(Math.max(15, (targetCores * 2.5 + 25) / 2));

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
        spawnAmount: Math.max(1, 1 + Math.floor(d * 2)),
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

// --- Generate 300 stages ---
const stages = [];
for (let i = 1; i <= 300; i++) {
    const diff = calculateStageDifficulty(i);
    const vis  = generateVisuals(i);

    let mapRows = [];
    for (let z = 0; z < diff.h; z++) {
        let row = '';
        for (let x = 0; x < diff.w; x++) row += diff.map[x][z] ? '1' : '0';
        mapRows.push(row);
    }

    stages.push({
        id:       i,
        w:        diff.w,
        h:        diff.h,
        map:      mapRows,
        colors:   diff.colors,
        spawn:    diff.spawnAmount,
        spawnRate: diff.spawnRate,
        cores:    diff.targetCores,
        obstacles: diff.obstacleRate,
        turns:    diff.turnLimit,
        theme:    vis.theme,
        palette:  vis.paletteIndex,
        bg:       vis.bg,
        grid:     vis.grid,
        plane:    vis.plane
    });
}

fs.writeFileSync('stages.json', JSON.stringify({ stages }, null, 2));
console.log(`Generated stages.json with ${stages.length} stages.`);

// --- Verification report ---
console.log('\n=== Tile Count & Difficulty (stages 1–30) ===');
for (let i = 1; i <= 30; i++) {
    const shape = getBoardShape(i);
    const diff = calculateStageDifficulty(i);
    const maxT = Math.min(64, 10 + Math.floor((i-1)/10) * 5);
    let cells = 0;
    for (let x=0;x<8;x++) for (let z=0;z<8;z++) if(shape.map[x][z]) cells++;
    console.log(`  Stage ${String(i).padStart(3)}: budget=${String(maxT).padStart(2)} cells=${String(cells).padStart(2)} cores=${String(diff.targetCores).padStart(2)} turns=${String(diff.turnLimit).padStart(3)}`);
}
console.log('\n=== Key milestones ===');
[1,50,100,150,200,250,300].forEach(i => {
    const d = getWaveDifficulty(i);
    const diff = calculateStageDifficulty(i);
    const maxT = Math.min(64, 10 + Math.floor((i-1)/10) * 5);
    let cells = 0;
    for (let x=0;x<8;x++) for (let z=0;z<8;z++) if(diff.map[x][z]) cells++;
    const obs = diff.obstacleRate === 0 ? 'none' : `1/${diff.obstacleRate}`;
    console.log(`  Stage ${String(i).padStart(3)}: d=${d.toFixed(3)} budget=${maxT} cells=${cells} colors=${diff.colors} cores=${diff.targetCores} turns=${diff.turnLimit} obstacles=${obs}`);
});
