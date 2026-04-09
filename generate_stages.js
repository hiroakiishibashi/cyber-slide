// generate_stages.js v5
// Tile-count-based progression: stage 1-10 max 15 tiles, +5 per 10 stages
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
