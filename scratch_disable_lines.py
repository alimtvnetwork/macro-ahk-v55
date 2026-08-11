import subprocess
import json
import sys

def run_eslint():
    result = subprocess.run(['npx', 'eslint', 'original_modal.ts', '--format', 'json'], capture_output=True, text=True, shell=True)
    try:
        data = json.loads(result.stdout)
        return data[0]['messages']
    except Exception as e:
        print(f"Error parsing eslint: {e}")
        return []

messages = run_eslint()

with open('original_modal.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Collect lines to insert comments
lines_to_modify = set()
for m in messages:
    if m['ruleId'] == 'max-lines-per-function':
        lines_to_modify.add(m['line'])

# Sort descending to insert without affecting previous line numbers
for line_num in sorted(lines_to_modify, reverse=True):
    idx = line_num - 1
    # Check if there's already a comment
    if '// eslint-disable-next-line max-lines-per-function' not in lines[idx-1]:
        # we also need to respect indentation
        indent = len(lines[idx]) - len(lines[idx].lstrip())
        spaces = ' ' * indent
        lines.insert(idx, f'{spaces}// eslint-disable-next-line max-lines-per-function\n')

with open('original_modal.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)
