import sys

file_path = r"D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\seed-diagnostics-panel.ts"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

def replace_line(line_idx, new_text):
    lines[line_idx] = new_text + "\n"

# 129:   top.appendChild(codeSpan); top.appendChild(timeSpan);
replace_line(128, "  top.appendChild(codeSpan);\n  top.appendChild(timeSpan);")

# 136:   row.appendChild(top); row.appendChild(detail);
replace_line(135, "  row.appendChild(top);\n  row.appendChild(detail);")

# 342:   row.appendChild(dot); row.appendChild(name); row.appendChild(detail);
replace_line(341, "  row.appendChild(dot);\n  row.appendChild(name);\n  row.appendChild(detail);")

# 392:   top.appendChild(codeSpan); top.appendChild(timeSpan);
replace_line(391, "  top.appendChild(codeSpan);\n  top.appendChild(timeSpan);")

# 396:   row.appendChild(top); row.appendChild(body);
replace_line(395, "  row.appendChild(top);\n  row.appendChild(body);")

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
