import sys

path = 'original_modal.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

lines[1430] = '      e.preventDefault();\n      refs.activeEditor.cancel();\n'
lines[1466] = '    e.preventDefault();\n    first.focus();\n'
lines[1472] = '    e.preventDefault();\n    last.focus();\n'
lines[1478] = '    e.preventDefault();\n    first.focus();\n'
lines[1872] = '  row.appendChild(label);\n  row.appendChild(input);\n  row.appendChild(preview);\n  row.appendChild(error);\n'
lines[1898] = '  row.appendChild(label);\n  row.appendChild(input);\n  row.appendChild(error);\n'
lines[1925] = '  bar.appendChild(cancelBtn);\n  bar.appendChild(saveBtn);\n'
lines[1926] = '  wrap.appendChild(nameInput);\n  wrap.appendChild(tokenEls.row);\n  wrap.appendChild(valuesEls.row);\n  wrap.appendChild(bodyInput);\n  wrap.appendChild(bar);\n'
lines[1940] = '    refs.activeEditor = null;\n    void renderAllRoles(refs);\n'

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
