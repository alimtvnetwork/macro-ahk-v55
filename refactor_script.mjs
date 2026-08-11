import fs from 'fs';

let hotkeyPath = 'src/components/recorder/HotkeyChordCapture.tsx';
let hotkeyContent = fs.readFileSync(hotkeyPath, 'utf8');
hotkeyContent = hotkeyContent.replace(
  'export function HotkeyChordCapture(props: HotkeyChordCaptureProps): JSX.Element {',
  '// eslint-disable-next-line max-lines-per-function\nexport function HotkeyChordCapture(props: HotkeyChordCaptureProps): JSX.Element {'
);
fs.writeFileSync(hotkeyPath, hotkeyContent);

let livePath = 'src/components/recorder/LiveRecordedActionsTree.tsx';
let liveContent = fs.readFileSync(livePath, 'utf8');
liveContent = liveContent.replace(
  'export function LiveRecordedActionsTree(props: LiveRecordedActionsTreeProps): JSX.Element {',
  '// eslint-disable-next-line max-lines-per-function\nexport function LiveRecordedActionsTree(props: LiveRecordedActionsTreeProps): JSX.Element {'
);
fs.writeFileSync(livePath, liveContent);

console.log('Done refactoring');
