const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}

const files = walk('standalone-scripts/macro-controller/src/ui');
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Background colors
  content = content.replace(/#(1a1a2e|1e1e2e|111)\b/g, 'hsl(var(--background))');
  content = content.replace(/#1e3a5f\b/gi, 'hsl(var(--secondary))');
  
  // Foreground colors
  content = content.replace(/#(fff|ffffff)\b/gi, 'hsl(var(--foreground))');
  content = content.replace(/#(e2e8f0|e5e7eb|d9d9d9|e8e8e8|f1f5f9|f8fafc)\b/gi, 'hsl(var(--foreground))');
  
  // Muted foreground
  content = content.replace(/#(94a3b8|64748b|475569|6b7280|9ca3af)\b/gi, 'hsl(var(--muted-foreground))');

  // Specific semantic colors
  content = content.replace(/#(4ade80|22c55e|10b981|15803d)\b/gi, 'hsl(var(--success))');
  content = content.replace(/#(f87171|ef4444|dc2626|b91c1c)\b/gi, 'hsl(var(--destructive))');
  content = content.replace(/#(fbbf24|f59e0b|d97706)\b/gi, 'hsl(var(--warning))');
  content = content.replace(/#(3b82f6|2563eb|1d4ed8)\b/gi, 'hsl(var(--primary))');
  content = content.replace(/#(8b5cf6|7c3aed|6d28d9)\b/gi, 'hsl(var(--primary))');
  
  // Also replace literal tailwind colors if they exist
  content = content.replace(/bg-black/g, 'bg-background');
  content = content.replace(/text-white/g, 'text-foreground');

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
  }
});
console.log('Changed ' + changedFiles + ' files');
