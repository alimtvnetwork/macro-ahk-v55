import sys

file_path = r"D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\settings-tab-panels.ts"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

def replace_line(line_idx, new_text):
    lines[line_idx] = new_text + "\n"

# 758:         showToast('Removed override for ' + wsId, 'info'); onChange();
replace_line(757, "        showToast('Removed override for ' + wsId, 'info');\n        onChange();")

# Now we need to reduce buildLoggingPanel which is line 299 to 372.
# Let's see if we can extract makeToggle out of it.
# It is defined at line 304.
# 304:   const makeToggle = function(label: string, checked: boolean): HTMLElement { ... 318:   };
# Let's extract it. We can just read the whole file and rewrite it.

content = "".join(lines)

make_toggle_func = """function makeLoggingToggle(label: string, checked: boolean): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ' + cPanelBorder + ';';
  const lbl = document.createElement('span');
  lbl.style.cssText = 'font-size:11px;color:' + cPanelText + ';';
  lbl.textContent = label;
  const sw = document.createElement('input');
  sw.type = 'checkbox';
  sw.checked = checked;
  sw.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:' + cPrimary + ';';
  row.appendChild(lbl);
  row.appendChild(sw);
  return row;
}

"""

# find buildLoggingPanel
idx = content.find("export function buildLoggingPanel")
content = content[:idx] + make_toggle_func + content[idx:]

# remove makeToggle inside buildLoggingPanel
idx_makeToggle_start = content.find("const makeToggle = function(label: string, checked: boolean): HTMLElement {")
idx_makeToggle_end = content.find("  const masterTitle = document.createElement('div');", idx_makeToggle_start)

content = content[:idx_makeToggle_start] + content[idx_makeToggle_end:]
content = content.replace("makeToggle(", "makeLoggingToggle(")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
