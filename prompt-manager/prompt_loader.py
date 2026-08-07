import json
import os
from typing import List, Dict, Any

def load_prompts(file_path: str) -> List[Dict[str, Any]]:
    """
    Loads prompts from a JSON file.
    Expects the JSON to be a list of prompt objects.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Prompts file not found at: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    if not isinstance(data, list):
        raise ValueError("Invalid JSON format: Expected a list of prompts.")
        
    return data

def get_default_prompts_path() -> str:
    """Returns the default path to the macro-prompts.json file."""
    # Assuming the app is run from within the macro-ahk directory or prompt-manager dir
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, "standalone-scripts", "macro-controller", "03-macro-prompts.json")
