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
    } else if (full.endsWith('.ts') || full.endsWith('.css') || full.endsWith('.tsx')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk(uiDir);

function replaceColors(content) {
  // Mapping specific hardcoded values to semantic tokens
  // Strip frame
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.02\)/g, 'hsl(var(--strip-frame-bg))');
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.10\)/g, 'hsl(var(--strip-frame-bg) / 0.1)'); // Actually it might be border? Let's use border.
  content = content.replace(/border:1px solid rgba\(255,\s*255,\s*255,\s*0\.10\)/g, 'border:1px solid hsl(var(--border))');
  
  // Chip bg and border
  // For other generic colors
  // foregrounds
  content = content.replace(/color:\s*#(?:e5e5e5|eee|ddd|e6edf7|cbd5e1|c4b5fd|a78bfa|67e8f9|facc15|34d399|22d3ee)/gi, 'color:hsl(var(--foreground))');
  
  // Actually, wait, replacing specific colors with `foreground` might break syntax highlighting colors like #facc15.
  // It's safer to use regex that prompts me, or I can just use a generalized regex if it's safe.
  
  return content;
}

// Let's just gather all color literals across the files to see them.
const colorRegex = /(bg-black|text-white|bg-\[#[a-fA-F0-9]+\]|text-\[#[a-fA-F0-9]+\]|#[a-fA-F0-9]{3,6}|rgba?\([^)]+\))/g;
let allColors = new Set();
let filesToChange = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  let fileHasColor = false;
  while ((match = colorRegex.exec(content)) !== null) {
    if (
        !match[0].startsWith('rgba') && 
        !match[0].startsWith('rgb') &&
        !match[0].startsWith('#') &&
        !match[0].startsWith('bg-') &&
        !match[0].startsWith('text-')
    ) {
      continue; // Skip things that aren't colors, wait regex handles this.
    }
    
    // Ignore small numbers that happen to be matched? # followed by hex. 
    // e.g., #1 or #22 from markdown might match if we aren't careful.
    if (match[0].startsWith('#') && !/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/i.test(match[0])) {
       continue; // like #abc-9 or #1
    }

    allColors.add(match[0]);
    fileHasColor = true;
  }
  if (fileHasColor) {
    filesToChange.push(file);
  }
});

console.log('Unique colors found:', Array.from(allColors).sort());
console.log('Files with colors:', filesToChange.length);
