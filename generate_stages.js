// generate_stages.js
// Run: node generate_stages.js
// Generates stages.json with pre-computed data for all 300 stages.
// Edit individual stages in stages.json to fix balance issues.

const fs = require('fs');

// --- HSL to hex (replicates Three.js Color.setHSL behavior) ---
function hslToHex(h, s, l) {
    // h, s, l in 0-1 range
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    const ri = Math.min(255, Math.round(r * 255));
    const gi = Math.min(255, Math.round(g * 255));
    const bi = Math.min(255, Math.round(b * 255));
    return ((ri << 16) | (gi << 8) | bi).toString(16).padStart(6, '0');
}

// --- Constants (must match index.html) ---
const PALETTES = [
    [0xFF3333, 0x3388FF, 0x00E080, 0xFFCC00, 0x9900FF, 0xFF8800],
    [0xFF0088, 0x00E5FF, 0x88FF00, 0xFFAA00, 0x5500FF, 0xFF2200],
    [0x00FFFF, 0x0044FF, 0x00FF66, 0xFF00CC, 0xFFFF88, 0xFF0000],
    [0xFF8800, 0xCC0033, 0xFFD700, 0x00CC44, 0x9900FF, 0x0088FF],
    [0xFFCC00, 0x66FF00, 0x00FFCC, 0x0088FF, 0xAA00FF, 0xFF0066],
];
const THEME_KEYS = ['NEON', 'GLASS', 'MATTE', 'RETRO', 'METAL'];

// --- Board shape generation (copied from game) ---
function getBoardShape(stage) {
    const cycle = (stage + Math.floor(stage / 10)) % 10;
    const base = 4 + Math.floor((stage - 1) / 12);
    let w = Math.min(8, base), h = Math.min(8, base);
    let map = [];
    for (let x = 0; x < 8; x++) { map[x] = []; for (let z = 0; z < 8; z++) map[x][z] = false; }
    const fillRect = (x, z, rw, rh) => {
        for (let i = x; i < x + rw; i++) for (let j = z; j < z + rh; j++) if (i < 8 && j < 8) map[i][j] = true;
    };
    if (cycle === 0) { fillRect(0, 0, w, h); }
    else if (cycle === 1) { w = Math.min(8, w + 1); h = Math.max(3, h - 1); fillRect(0, 0, w, h); }
    else if (cycle === 2) { w = Math.max(3, w - 1); h = Math.min(8, h + 1); fillRect(0, 0, w, h); }
    else if (cycle === 3) {
        const cx = Math.floor(w / 2), cz = Math.floor(h / 2);
        fillRect(0, cz, w, 1); fillRect(cx, 0, 1, h);
        if (w > 4) { fillRect(0, cz - 1, w, 3); fillRect(cx - 1, 0, 3, h); }
    }
    else if (cycle === 4) {
        fillRect(0, 0, w, h);
        const cx = Math.floor(w / 2), cz = Math.floor(h / 2);
        map[cx][cz] = false;
        if (w > 4) { map[cx - 1][cz] = false; map[cx][cz - 1] = false; map[cx - 1][cz - 1] = true; }
    }
    else if (cycle === 5) { const cx = Math.floor(w / 2); fillRect(0, 0, w, 2); fillRect(cx, 0, 2, h); }
    else if (cycle === 6) {
        const cx = Math.floor(w / 2);
        fillRect(0, 0, 2, h); fillRect(w - 2, 0, 2, h); fillRect(0, Math.floor(h / 2), w, 1);
    }
    else if (cycle === 7) {
        // NOTE: Checker pattern creates isolated cells — fixed to solid rect in stages.json
        for (let x = 0; x < w; x++) for (let z = 0; z < h; z++) if ((x + z) % 2 === 0) map[x][z] = true;
        for (let x = 0; x < w - 1; x++) map[x][0] = true;
    }
    else if (cycle === 8) {
        const cx = (w - 1) / 2, cz = (h - 1) / 2;
        for (let x = 0; x < w; x++) for (let z = 0; z < h; z++) {
            if (Math.abs(x - cx) + Math.abs(z - cz) <= w / 2) map[x][z] = true;
        }
    }
    else if (cycle === 9) { fillRect(0, 0, 2, h); fillRect(w - 2, 0, 2, h); fillRect(0, h - 2, w, 2); }

    let maxX = 0, maxZ = 0;
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) if (map[x][z]) { if (x > maxX) maxX = x; if (z > maxZ) maxZ = z; }
    return { w: maxX + 1, h: maxZ + 1, map };
}

function calculateStageDifficulty(stage) {
    const shape = getBoardShape(stage);
    let w = shape.w, h = shape.h;
    let c = 2, sa = 1, rate = 5, target = 1, obsRate = 0, limit = 25;

    if (stage <= 10) c = 2; else if (stage <= 40) c = 3; else if (stage <= 100) c = 4; else c = 5;
    if (stage >= 5) obsRate = Math.max(3, 10 - Math.floor((stage - 5) / 20));
    if (stage <= 5) { sa = 1; rate = 5; target = 1; limit = 20; }
    else if (stage <= 15) { sa = 1; rate = 6; target = 2; limit = 25; }
    else if (stage <= 30) { sa = 2; rate = 8; target = 3; limit = 30; }
    else { sa = 2; rate = 10; target = 3 + Math.floor(stage / 20); limit = 35; }

    return { w, h, map: shape.map, colors: c, spawnAmount: sa, spawnRate: rate, targetCores: target, obstacleRate: obsRate, turnLimit: limit };
}

function generateVisuals(stage) {
    const colorPhase = Math.floor((stage - 1) / 5);
    const stylePhase = Math.floor((stage - 1) / 10);
    const baseHue = (colorPhase * 45) % 360;
    return {
        bg: hslToHex(baseHue / 360, 0.5, 0.08),
        grid: hslToHex(baseHue / 360, 0.9, 0.6),
        plane: hslToHex(baseHue / 360, 0.3, 0.15),
        paletteIndex: Math.floor((stage - 1) / 5) % PALETTES.length,
        theme: THEME_KEYS[stylePhase % THEME_KEYS.length]
    };
}

// --- Stages known to have isolated cells (checker pattern cycles) ---
// cycle = (stage + Math.floor(stage/10)) % 10 === 7
// These stages get overridden with solid rect maps below.
function isCheckerCycle(stage) {
    return (stage + Math.floor(stage / 10)) % 10 === 7;
}

// --- Generate 300 stages ---
const stages = [];
for (let i = 1; i <= 300; i++) {
    const diff = calculateStageDifficulty(i);
    const vis = generateVisuals(i);

    // Convert 2D bool map [x][z] → row strings (z=row, x=col)
    let mapRows = [];
    for (let z = 0; z < diff.h; z++) {
        let row = '';
        for (let x = 0; x < diff.w; x++) row += diff.map[x][z] ? '1' : '0';
        mapRows.push(row);
    }

    // Fix: checker cycle stages have isolated cells → replace with solid rect
    if (isCheckerCycle(i)) {
        mapRows = [];
        for (let z = 0; z < diff.h; z++) mapRows.push('1'.repeat(diff.w));
    }

    stages.push({
        id: i,
        w: diff.w,
        h: diff.h,
        map: mapRows,
        colors: diff.colors,
        spawn: diff.spawnAmount,
        spawnRate: diff.spawnRate,
        cores: diff.targetCores,
        obstacles: diff.obstacleRate,
        turns: diff.turnLimit,
        theme: vis.theme,
        palette: vis.paletteIndex,
        bg: vis.bg,
        grid: vis.grid,
        plane: vis.plane
    });
}

fs.writeFileSync('stages.json', JSON.stringify({ stages }, null, 2));
console.log(`Generated stages.json with ${stages.length} stages.`);

// Report checker-cycle stages that were auto-fixed
const fixed = [];
for (let i = 1; i <= 300; i++) if (isCheckerCycle(i)) fixed.push(i);
console.log(`Auto-fixed isolated-cell stages (checker cycle): ${fixed.join(', ')}`);
