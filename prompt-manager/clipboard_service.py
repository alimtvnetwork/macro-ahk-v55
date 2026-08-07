import pyperclip

def copy_to_clipboard(text: str) -> bool:
    """
    Copies the given text to the system clipboard.
    Returns True if successful, False otherwise.
    """
    try:
        pyperclip.copy(text)
        return True
    except Exception as e:
        print(f"Failed to copy to clipboard: {e}")
        return False
