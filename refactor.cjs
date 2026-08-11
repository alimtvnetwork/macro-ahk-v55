const fs = require('fs');
let code = fs.readFileSync('src/components/recorder/HotkeyChordCapture.tsx', 'utf8');

const hook = `
function useHotkeyCapture(
  value: readonly string[],
  onChange: (next: readonly string[]) => void,
  boxRef: React.RefObject<HTMLDivElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const [active, setActive] = React.useState(false);
  const [lastChord, setLastChord] = React.useState<string | null>(null);

  const onKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (!active) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setActive(false);
      boxRef.current?.blur();
      return;
    }
    if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
      return;
    }
    const chord = eventToChord(e);
    if (chord === null) return;
    e.preventDefault();
    e.stopPropagation();
    setLastChord(chord);
    onChange([...value, chord]);
  }, [active, value, onChange, boxRef]);

  React.useEffect(() => {
    if (!active) return;
    const box = boxRef.current;
    if (box === null) return;
    box.addEventListener(Events.KEYDOWN, onKeyDown);
    return () => box.removeEventListener(Events.KEYDOWN, onKeyDown);
  }, [active, onKeyDown, boxRef]);

  React.useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = containerRef.current;
      if (root === null) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setActive(false);
      boxRef.current?.blur();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active, containerRef, boxRef]);

  return { active, setActive, lastChord };
}
`;

code = code.replace(/const \[active, setActive\] = useState\(false\);[\s\S]*?onChange\(next\);\n  \};/m, 
`const boxRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { active, setActive, lastChord } = useHotkeyCapture(value, onChange, boxRef, containerRef);

  const removeChord = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };`);

code += hook;
fs.writeFileSync('src/components/recorder/HotkeyChordCapture.tsx', code);
