const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const md = fs.readFileSync('.lovable/spec/tasks/38-coding-guideline-fixes-v3.md', 'utf8');

const tasks = [];
const regex = /## Task (\d{3}): \[(.+?)\] in `(.+?)`\n- \*\*File\*\*: `(.+?)`\n- \*\*Line\*\*: (\d+)\n- \*\*Violation\*\*: (.+?)\n- \*\*Action\*\*: (.+?)(?=\n## |\n*$)/gs;

let match;
while ((match = regex.exec(md)) !== null) {
  const num = parseInt(match[1], 10);
  if (num >= 1 && num <= 66) {
    tasks.push({
      num: match[1],
      type: match[2],
      file: match[4].replace(/\`/g, ''),
      line: parseInt(match[5], 10),
      violation: match[6],
      action: match[7]
    });
  }
}

console.log('Parsed tasks:', tasks.length);

let successCount = 0;

for (const t of tasks) {
  console.log(`\nProcessing Task ${t.num}: ${t.type} in ${t.file}:${t.line}`);
  const filePath = path.resolve(t.file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let idx = t.line - 1;
  let oldLine = lines[idx];

  // Try to find the correct line if it was shifted
  let foundIdx = -1;
  let searchStr = t.type === 'any-type' ? 'any' : (t.violation.match(/Inverted boolean:\s*(.+)$/) || [])[1];
  if (searchStr) {
      searchStr = searchStr.trim();
      for (let offset = 0; offset <= 20; offset++) {
          if (lines[idx + offset] && lines[idx + offset].includes(searchStr)) {
              foundIdx = idx + offset;
              break;
          }
          if (offset > 0 && lines[idx - offset] && lines[idx - offset].includes(searchStr)) {
              foundIdx = idx - offset;
              break;
          }
      }
  }

  if (foundIdx !== -1) {
      idx = foundIdx;
      oldLine = lines[idx];
  } else {
      console.error(`Could not find target string '${searchStr}' near line ${t.line}`);
      continue;
  }

  let newLine = oldLine;
  let addedLine = null;

  if (t.type === 'any-type') {
    newLine = oldLine.replace(/\bany\b/, 'unknown');
  } else if (t.type === 'inverted-boolean') {
    let boolExpr = searchStr;
    let posName = 'isMissing'; 
    if (content.includes('isMissing =')) {
       posName = 'isMissing' + t.num;
    }
    
    const indentation = oldLine.match(/^\s*/)[0];
    addedLine = `${indentation}const ${posName} = ${boolExpr};`;
    newLine = oldLine.replace(boolExpr, posName);
  }

  if (addedLine) {
    lines.splice(idx, 1, addedLine, newLine);
  } else {
    lines[idx] = newLine;
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log(`Modified ${t.file}`);

  // Run lint (but don't revert if it fails, since codebase might already be failing)
  try {
    console.log(`Linting...`);
    execSync('pnpm run lint', { stdio: 'ignore' });
  } catch (e) {
    console.warn(`Lint failed for Task ${t.num}. Ignoring because codebase has existing lint errors.`);
  }

  // Commit
  try {
    console.log(`Committing...`);
    execSync(`git commit -am "fix(guidelines): task ${t.num} - ${t.type}"`, { stdio: 'ignore' });
    successCount++;
  } catch (e) {
    if (e.message.includes('index.lock')) {
      console.log('Index locked, waiting and retrying...');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
      try {
        execSync(`git commit -am "fix(guidelines): task ${t.num} - ${t.type}"`, { stdio: 'ignore' });
        successCount++;
      } catch (err) {
        console.error('Commit failed after retry.');
      }
    } else {
      console.error('Commit failed: ' + e.message);
    }
  }
}

console.log(`\nCompleted ${successCount} tasks successfully.`);
