def apply_line_replacement(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Sort replacements in reverse order so we don't mess up line numbers
    replacements.sort(key=lambda x: x[0], reverse=True)
    
    for start, end, new_lines in replacements:
        lines[start-1:end] = [new_lines]
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

rep1 = """function RecorderControlBarButtons({
  isPaused,
  playEnabled,
  pauseEnabled,
  stopEnabled,
  handlePlay,
  pause,
  stop,
}: {
  readonly isPaused: boolean;
  readonly playEnabled: boolean;
  readonly pauseEnabled: boolean;
  readonly stopEnabled: boolean;
  readonly handlePlay: () => void;
  readonly pause: () => Promise<void>;
  readonly stop: () => Promise<void>;
}) {
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={!playEnabled}
        onClick={handlePlay}
        className="h-8 px-3"
        aria-label={isPaused ? "Resume recording" : "Start recording"}
        data-testid="recorder-control-play"
      >
        <Play className="h-3.5 w-3.5 mr-1" />
        {isPaused ? "Resume" : "Play"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={!pauseEnabled}
        onClick={() => {
          void pause(); 
        }}
        className="h-8 px-3"
        aria-label="Pause recording"
        data-testid="recorder-control-pause"
      >
        <Pause className="h-3.5 w-3.5 mr-1" />
        Pause
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={!stopEnabled}
        onClick={() => {
          void stop(); 
        }}
        className="h-8 px-3"
        aria-label="Stop recording"
        data-testid="recorder-control-stop"
      >
        <Square className="h-3.5 w-3.5 mr-1" />
        Stop
      </Button>
    </>
  );
}

export function RecorderControlBar({ className }: RecorderControlBarProps) {\n"""

rep2 = """    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-card/80 p-1.5",
        className,
      )}
      role="toolbar"
      aria-label="Recorder controls"
      data-testid="recorder-control-bar"
    >
      <RecorderControlBarButtons
        isPaused={isPaused}
        playEnabled={playEnabled}
        pauseEnabled={pauseEnabled}
        stopEnabled={stopEnabled}
        handlePlay={handlePlay}
        pause={pause}
        stop={stop}
      />
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider ml-1"
        data-testid="recorder-control-phase"
      >
        {phase}
      </Badge>
      <KeywordEventsPanel className="ml-1" />
    </div>\n"""

apply_line_replacement("src/components/recorder/RecorderControlBar.tsx", [
    (29, 29, rep1),
    (54, 91, rep2)
])
print("Done control bar")
