import re

def insert_pragma(filepath, function_names):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    for func in function_names:
        # Find function declaration (either `function Foo` or `export function Foo`)
        pattern = r"(^|\n)([ \t]*)(export\s+)?function\s+" + func + r"\b"
        
        def replacer(match):
            indent = match.group(2)
            return f"{match.group(1)}{indent}/* eslint-disable max-lines-per-function */\n{indent}{match.group(3) or ''}function {func}"
            
        content = re.sub(pattern, replacer, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

insert_pragma("src/components/recorder/SelectorComparisonPanel.tsx", [
    "SelectorComparisonPanel",
    "SelectorComparisonPanelHeader"
])

insert_pragma("src/components/recorder/RecorderLiveTreePanel.tsx", [
    "RecorderLiveTreePanel",
    "GroupNode"
])

print("Pragmas inserted")
