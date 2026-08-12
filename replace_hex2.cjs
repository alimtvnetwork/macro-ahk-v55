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

const mappings = [
  { rgx: /#(?:60a5fa|7cc4ff|93c5fd|007acc|3daee9)/gi, rep: 'hsl(var(--accent))' },
  { rgx: /#(?:fde68a|f97316)/gi, rep: 'hsl(var(--warning))' },
  { rgx: /#(?:ae7ce8|c9a8ef|2d1b4e|4f46e5)/gi, rep: 'hsl(var(--primary))' },
  { rgx: /#(?:fca5a5|6b2c34|ffd7dc|4a2230|f5c9c9|fecaca)/gi, rep: 'hsl(var(--destructive))' },
  { rgx: /#(?:6b5a8a|4b5563)/gi, rep: 'hsl(var(--muted-foreground))' },
  { rgx: /#(?:2d3348)/gi, rep: 'hsl(var(--muted))' },
  { rgx: /#(?:2f4a2f|d6f5d6)/gi, rep: 'hsl(var(--success))' },
  { rgx: /#(?:313147)/gi, rep: 'hsl(var(--border))' },
  { rgx: /#(?:1a0b2e|1a1625)/gi, rep: 'hsl(var(--background))' },
];

let filesChanged = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  for (const m of mappings) {
    content = content.replace(m.rgx, m.rep);
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    filesChanged++;
  }
}

console.log('Hex pass 2 modified files:', filesChanged);
