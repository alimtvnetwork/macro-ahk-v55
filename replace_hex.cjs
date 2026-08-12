const fs = require('fs');
const path = require('path');

const uiDir = 'd:\\work\\macro-ahk\\standalone-scripts\\macro-controller\\src\\ui';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk(uiDir);

const cssPropRegex = /(background|background-color|color|border(?:-[a-z]+)?|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,8})/gi;

let filesChanged = 0;
let totalReplaced = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  content = content.replace(cssPropRegex, (match, prop, hex) => {
    // Map based on the property and hex
    const propLower = prop.toLowerCase();
    
    // Some known colors
    if (/c4b5fd|a78bfa|67e8f9|f0f|0ff|93c5fd|60a5fa|7cc4ff|3daee9|4f46e5|6366f1|007acc/i.test(hex)) {
      return propLower.includes('background') ? `${prop}:hsl(var(--primary) / 0.1)` : `${prop}:hsl(var(--primary))`;
    }
    if (/facc15|fb923c|f97316|c2410c|b45309|fde68a/i.test(hex)) {
      return `${prop}:hsl(var(--warning))`;
    }
    if (/86efac|34d399|059669|16a34a|047857|065f46|bbf7d0|d6f5d6|2f4a2f/i.test(hex)) {
      return `${prop}:hsl(var(--success))`;
    }
    if (/663333|991b1b|7f1d1d|fca5a5|fecaca|ffd7dc/i.test(hex)) {
      return `${prop}:hsl(var(--destructive))`;
    }
    
    if (propLower.includes('background')) {
       // if it's light, maybe it's a hover or chip
       if (/fff|f[0-9a-f]{2}|e[0-9a-f]{2}|d[0-9a-f]{2}/i.test(hex)) {
          return `${prop}:hsl(var(--card))`;
       }
       return `${prop}:hsl(var(--background))`;
    }
    if (propLower.includes('border')) {
       return `${prop}:hsl(var(--border))`;
    }
    if (propLower.includes('color')) {
       // text color
       if (/000|111|222|333|444|555|666|777|888/i.test(hex)) {
          return `${prop}:hsl(var(--muted-foreground))`;
       }
       return `${prop}:hsl(var(--foreground))`;
    }
    
    // Default fallback
    return `${prop}:hsl(var(--foreground))`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    filesChanged++;
  }
}

console.log('Hex pass modified files:', filesChanged);
