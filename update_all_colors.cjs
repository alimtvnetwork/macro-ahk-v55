const fs = require('fs');
const path = require('path');

const cssPath = 'd:\\work\\macro-ahk\\src\\index.css';
let css = fs.readFileSync(cssPath, 'utf8');

if (!css.includes('--strip-frame-bg')) {
  css = css.replace(
    '--radius: 0.5rem;',
    '--radius: 0.5rem;\n\n    --strip-frame-bg: 224 28% 8%;\n    --chip-bg: 224 18% 16%;\n    --chip-border: 224 18% 18%;\n    --editor-callout-bg: 224 24% 12%;'
  );
  
  if (!css.includes('.light {')) {
    const lightTokens = `
  .light {
    --background: 0 0% 100%;
    --foreground: 224 28% 8%;
    --card: 0 0% 100%;
    --card-foreground: 224 28% 8%;
    --popover: 0 0% 100%;
    --popover-foreground: 224 28% 8%;
    --primary: 268 70% 60%;
    --primary-foreground: 0 0% 100%;
    --secondary: 224 18% 96%;
    --secondary-foreground: 224 28% 8%;
    --muted: 224 18% 96%;
    --muted-foreground: 220 10% 45%;
    --accent: 170 55% 48%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 62% 45%;
    --destructive-foreground: 0 0% 100%;
    --border: 224 18% 90%;
    --input: 224 18% 90%;
    --ring: 268 70% 60%;
    
    --strip-frame-bg: 220 14% 96%;
    --chip-bg: 0 0% 100%;
    --chip-border: 224 18% 90%;
    --editor-callout-bg: 0 0% 100%;
  }
`;
    css = css.replace('}\n\n/* ── CSS Sentinel', '}\n' + lightTokens + '\n/* ── CSS Sentinel');
  }
  fs.writeFileSync(cssPath, css);
  console.log('Updated index.css');
}

const uiDir = 'd:\\work\\macro-ahk\\standalone-scripts\\macro-controller\\src\\ui';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (full.endsWith('.ts')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk(uiDir);

const mappings = [
  // Special backgrounds
  { rgx: /rgba\(255,255,255,0\.02\)/gi, rep: 'hsl(var(--strip-frame-bg))' },
  { rgx: /rgba\(255,255,255,0\.10\)/gi, rep: 'hsl(var(--border))' },
  { rgx: /rgba\(255,255,255,0\.14\)/gi, rep: 'hsl(var(--border))' },
  { rgx: /rgba\(255,255,255,0\.15\)/gi, rep: 'hsl(var(--border))' },
  { rgx: /rgba\(255,255,255,0\.06\)/gi, rep: 'hsl(var(--muted))' },
  { rgx: /rgba\(148,163,184,0\.35\)/gi, rep: 'hsl(var(--border))' },
  { rgx: /rgba\(124,58,237,0\.25\)/gi, rep: 'hsl(var(--primary) / 0.25)' },
  { rgx: /rgba\(124,58,237,0\.6\)/gi, rep: 'hsl(var(--primary) / 0.6)' },
  { rgx: /rgba\(124,58,237,0\.08\)/gi, rep: 'hsl(var(--primary) / 0.08)' },
  { rgx: /rgba\(34,211,238,0\.15\)/gi, rep: 'hsl(var(--accent) / 0.15)' },
  { rgx: /rgba\(34,211,238,0\.3\)/gi, rep: 'hsl(var(--accent) / 0.3)' },
  { rgx: /rgba\(255,255,255,\.05\)/gi, rep: 'hsl(var(--border))' },

  // Background colors
  { rgx: /#(?:1a1a1a|1e1b2e|121826|0f1522|0f172a|222|2a2a2a|333|000|0f0f0f|111|111827|1c2336|1c2536|1f2937|1e293b|252a36|2a2540|2d2b3b)/gi, rep: 'hsl(var(--background))' },
  { rgx: /#(?:243050|3a4863|2b3648|2f2f2f|444)/gi, rep: 'hsl(var(--muted))' },
  
  // Text colors
  { rgx: /#(?:e5e5e5|eee|ddd|e6edf7|cbd5e1|e0e0e0|d0d0d0|d1d5db|fff)/gi, rep: 'hsl(var(--foreground))' },
  { rgx: /#(?:8a8a8a|888|7a8699|9aa4b2|9aa7bd|666)/gi, rep: 'hsl(var(--muted-foreground))' },

  // Primary / Accents
  { rgx: /#(?:c4b5fd|a78bfa|3a2f6b|e9d5ff)/gi, rep: 'hsl(var(--primary))' },
  { rgx: /#(?:67e8f9|22d3ee)/gi, rep: 'hsl(var(--accent))' },
  { rgx: /#(?:fb923c|facc15|ffe08a|b45309|c2410c)/gi, rep: 'hsl(var(--warning))' },
  { rgx: /#(?:86efac|34d399|059669|16a34a|047857|065f46|bbf7d0)/gi, rep: 'hsl(var(--success))' },
  { rgx: /#(?:663333|991b1b|7f1d1d)/gi, rep: 'hsl(var(--destructive))' },
];

let filesChanged = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  for (const m of mappings) {
    content = content.replace(m.rgx, m.rep);
  }

  // Also replace any generic '#hex' still lying around in `color:` or `background:` that we missed
  content = content.replace(/background:\s*#[a-fA-F0-9]{3,6}/g, 'background:hsl(var(--background))');
  content = content.replace(/background-color:\s*#[a-fA-F0-9]{3,6}/g, 'background-color:hsl(var(--background))');
  content = content.replace(/color:\s*#[a-fA-F0-9]{3,6}/g, 'color:hsl(var(--foreground))');
  content = content.replace(/border:\s*1px solid #[a-fA-F0-9]{3,6}/g, 'border:1px solid hsl(var(--border))');
  content = content.replace(/border-color:\s*#[a-fA-F0-9]{3,6}/g, 'border-color:hsl(var(--border))');
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    filesChanged++;
  }
}
console.log('Modified files:', filesChanged);
