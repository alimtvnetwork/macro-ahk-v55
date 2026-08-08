import json
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class Prompt:
    name: str
    text: str
    id: Optional[str] = None
    slug: Optional[str] = None
    version: Optional[str] = None
    category: str = "Uncategorized"

def load_prompts() -> List[Prompt]:
    """Loads prompts from the aggregated JSON file."""
    # Resolve the root directory of the repo relative to this file
    # This file is at d:/work/macro-ahk/standalone-scripts/prompt-manager/data/loader.py
    # Parent 1: data
    # Parent 2: prompt-manager
    # Parent 3: standalone-scripts
    # Parent 4: macro-ahk
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    
    paths_to_try = [
        root_dir / "chrome-extension" / "prompts" / "macro-prompts.json",
        root_dir / "standalone-scripts" / "macro-controller" / "03-macro-prompts.json"
    ]
    
    for path in paths_to_try:
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                prompts_list = data.get('prompts', [])
                result = []
                for p_dict in prompts_list:
                    result.append(Prompt(
                        name=p_dict.get('name', 'Untitled'),
                        text=p_dict.get('text', ''),
                        id=p_dict.get('id'),
                        slug=p_dict.get('slug'),
                        version=p_dict.get('version'),
                        category=p_dict.get('category', 'Uncategorized')
                    ))
                return result
            except Exception as e:
                print(f"Error loading {path}: {e}")
                
    return []
