import sys

file_path = r"D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\repeat-loop-ui.ts"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

def replace_line(line_idx, new_text):
    lines[line_idx] = new_text + "\n"

# 624:     if (e.key === 'Escape') {
# 625:       e.stopPropagation(); close(); 
# 626:     }
replace_line(624, "      e.stopPropagation();\n      close();")

# 873:   const optA = document.createElement('option'); optA.value = WAIT_MODE_SUBMIT_READY; optA.textContent = 'auto (submit ready)'; modeSel.appendChild(optA);
replace_line(873, "  const optA = document.createElement('option');\n  optA.value = WAIT_MODE_SUBMIT_READY;\n  optA.textContent = 'auto (submit ready)';\n  modeSel.appendChild(optA);")

# 874:   const optB = document.createElement('option'); optB.value = WAIT_MODE_FIXED_DELAY; optB.textContent = 'fixed delay'; modeSel.appendChild(optB);
replace_line(874, "  const optB = document.createElement('option');\n  optB.value = WAIT_MODE_FIXED_DELAY;\n  optB.textContent = 'fixed delay';\n  modeSel.appendChild(optB);")

# 883:   delayInput.type = 'number'; delayInput.min = '1'; delayInput.max = '3600';
replace_line(883, "  delayInput.type = 'number';\n  delayInput.min = '1';\n  delayInput.max = '3600';")

# 892:   const sUnit = document.createElement('span'); sUnit.textContent = 's'; sUnit.style.cssText = 'font-size:10px;opacity:0.7;'; wrap.appendChild(sUnit);
replace_line(892, "  const sUnit = document.createElement('span');\n  sUnit.textContent = 's';\n  sUnit.style.cssText = 'font-size:10px;opacity:0.7;';\n  wrap.appendChild(sUnit);")

# 896:     b.type = 'button'; b.textContent = s + 's'; b.title = 'Set fixed delay to ' + s + 's';
replace_line(896, "    b.type = 'button';\n    b.textContent = s + 's';\n    b.title = 'Set fixed delay to ' + s + 's';")

# 899:       setRepeatWaitMode(WAIT_MODE_FIXED_DELAY); setRepeatDelaySec(s); 
replace_line(899, "      setRepeatWaitMode(WAIT_MODE_FIXED_DELAY);\n      setRepeatDelaySec(s);")

# 1158:       trackedClearInterval(tickId); tickId = null; 
replace_line(1158, "      trackedClearInterval(tickId);\n      tickId = null;")


with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
