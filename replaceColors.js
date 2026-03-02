const fs = require('fs');
const path = require('path');

function replaceColorsInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Global Hex
    content = content.replace(/#6366F1/gi, '#EA7362');
    content = content.replace(/#e0e7ff/gi, '#FFD6B6');
    content = content.replace(/#c7d2fe/gi, '#FFD6B6');
    content = content.replace(/#ffffff/gi, '#FFD6B6');
    content = content.replace(/#070B14/gi, '#3A1818');
    content = content.replace(/#0C1222/gi, '#4A1E1E');
    content = content.replace(/#0A0F1E/gi, '#5C2626');
    content = content.replace(/#f8fafc/gi, '#FFD6B6');
    content = content.replace(/#cbd5e1/gi, '#FFD6B6');
    content = content.replace(/#475569/gi, '#FFD6B6');
    content = content.replace(/#1e293b/gi, '#B74242');
    content = content.replace(/#818cf8/gi, '#EA7362');
    content = content.replace(/#a5b4fc/gi, '#FFD6B6');
    content = content.replace(/#e2e8f0/gi, '#FFD6B6');
    content = content.replace(/#64748b/gi, '#FFD6B6');
    content = content.replace(/#94a3b8/gi, '#FFD6B6');
    content = content.replace(/#10B981/gi, '#EA7362');
    content = content.replace(/#F59E0B/gi, '#FFD6B6');
    content = content.replace(/#ef4444/gi, '#B74242');
    content = content.replace(/#8b5cf6/gi, '#B74242');
    content = content.replace(/#f43f5e/gi, '#B74242');
    content = content.replace(/#34d399/gi, '#EA7362');
    content = content.replace(/#f87171/gi, '#B74242');

    // Tailwind overrides
    content = content.replace(/bg-indigo-500/g, 'bg-[#EA7362]');
    content = content.replace(/text-indigo-400/g, 'text-[#FFD6B6]');
    content = content.replace(/text-slate-50/g, 'text-[#FFD6B6]');
    content = content.replace(/text-slate-200/g, 'text-[#FFD6B6]');
    content = content.replace(/text-slate-300/g, 'text-[#FFD6B6]');
    content = content.replace(/text-white/g, 'text-[#FFD6B6]');
    content = content.replace(/text-slate-400/g, 'text-[#FFD6B6]');
    content = content.replace(/text-slate-500/g, 'text-[#FFD6B6] opacity-70');
    content = content.replace(/text-gray-400/g, 'text-[#FFD6B6]');
    content = content.replace(/bg-slate-950/g, 'bg-[#5C2626]');
    content = content.replace(/bg-slate-900\/40/g, 'bg-[#5C2626]/40');
    content = content.replace(/bg-slate-900/g, 'bg-[#5C2626]');
    content = content.replace(/hover:bg-[#EA7362]\/40/g, 'hover:bg-[#EA7362]/40');
    content = content.replace(/hover:bg-emerald-900\/40/g, 'hover:bg-[#EA7362]/40');

    // Generic RGBA mapping based on provided palette
    // 99,102,241 / 6366f1  --> EA7362 (234, 115, 98)
    content = content.replace(/rgba\(99,\s*102,\s*241,\s*([0-9.]+)\)/g, 'rgba(234, 115, 98, $1)');
    // 14,21,40  --> 120,45,45
    content = content.replace(/rgba\(14,\s*21,\s*40,\s*([0-9.]+)\)/g, 'rgba(120, 45, 45, $1)');
    // 10,16,32  --> 5C2626 (92, 38, 38)
    content = content.replace(/rgba\(10,\s*16,\s*32,\s*([0-9.]+)\)/g, 'rgba(92, 38, 38, $1)');
    // 8,12,26   --> 70, 25, 25
    content = content.replace(/rgba\(8,\s*12,\s*26,\s*([0-9.]+)\)/g, 'rgba(70, 25, 25, $1)');
    // 12,18,35  --> 100, 35, 35
    content = content.replace(/rgba\(12,\s*18,\s*35,\s*([0-9.]+)\)/g, 'rgba(100, 35, 35, $1)');
    // 18,26,48  --> 140, 50, 50
    content = content.replace(/rgba\(18,\s*26,\s*48,\s*([0-9.]+)\)/g, 'rgba(140, 50, 50, $1)');
    // 30,40,70  --> B74242 (183, 66, 66)
    content = content.replace(/rgba\(30,\s*40,\s*70,\s*([0-9.]+)\)/g, 'rgba(183, 66, 66, $1)');
    // 255,255,255 -> FFD6B6 (255, 214, 182)
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)/g, 'rgba(255, 214, 182, $1)');
    // 56,189,248 -> B74242 (183, 66, 66)
    content = content.replace(/rgba\(56,\s*189,\s*248,\s*([0-9.]+)\)/g, 'rgba(183, 66, 66, $1)');
    // 124,58,237 -> 5C2626 (92, 38, 38)
    content = content.replace(/rgba\(124,\s*58,\s*237,\s*([0-9.]+)\)/g, 'rgba(92, 38, 38, $1)');
    // 16,185,129 -> EA7362 (234, 115, 98)
    content = content.replace(/rgba\(16,\s*185,\s*129,\s*([0-9.]+)\)/g, 'rgba(234, 115, 98, $1)');
    // 239,68,68 -> B74242 (183, 66, 66)
    content = content.replace(/rgba\(239,\s*68,\s*68,\s*([0-9.]+)\)/g, 'rgba(183, 66, 66, $1)');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

function traverse(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) traverse(full);
        else if (full.endsWith('.js') || full.endsWith('.jsx') || full.endsWith('.css')) {
            replaceColorsInFile(full);
        }
    }
}

traverse(`d:\\HyperZx2.0\\IUT\\Events\\DevSprint Hackathon '26\\IUT Food WebApp\\frontend\\student-ui\\src`);
traverse(`d:\\HyperZx2.0\\IUT\\Events\\DevSprint Hackathon '26\\IUT Food WebApp\\frontend\\admin-dashboard\\src`);
