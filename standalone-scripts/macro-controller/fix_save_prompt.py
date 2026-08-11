import sys

file_path = r"D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\save-prompt-task-next.ts"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

def replace_line(line_idx, new_text):
    lines[line_idx] = new_text + "\n"

# 169:       event.stopPropagation(); goButton.click();
replace_line(168, "      event.stopPropagation();\n      goButton.click();")

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
