import sys
from pathlib import Path

# Add the current directory to sys.path so we can import from data and ui
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

from ui.main_window import MainWindow

def main():
    app = MainWindow()
    app.mainloop()

if __name__ == "__main__":
    main()
