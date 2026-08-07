import customtkinter as ctk
import os
import sys

from prompt_loader import load_prompts, get_default_prompts_path
from prompt_card import PromptCard

class PromptManagerApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("Macro AHK - Prompt Manager")
        self.geometry("800x600")
        
        # Configure grid layout
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)
        
        # Header
        self.header_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.header_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=20)
        
        self.title_label = ctk.CTkLabel(
            self.header_frame, 
            text="Prompt Manager", 
            font=ctk.CTkFont(size=24, weight="bold")
        )
        self.title_label.pack(side="left")
        
        # Search bar
        self.search_var = ctk.StringVar()
        self.search_entry = ctk.CTkEntry(
            self.header_frame, 
            placeholder_text="Search prompts...", 
            textvariable=self.search_var,
            width=200
        )
        self.search_entry.pack(side="left", padx=20)
        self.search_var.trace_add("write", lambda *args: self.filter_prompts())
        
        # Role filter
        self.role_var = ctk.StringVar(value="All Roles")
        self.role_option = ctk.CTkOptionMenu(
            self.header_frame,
            values=["All Roles", "PLAN", "NEXT", "GENERIC"],
            variable=self.role_var,
            command=self.filter_prompts
        )
        self.role_option.pack(side="left", padx=10)
        
        self.status_label = ctk.CTkLabel(
            self.header_frame,
            text="Loading...",
            font=ctk.CTkFont(size=12),
            text_color="gray50"
        )
        self.status_label.pack(side="right", pady=5)
        
        # Scrollable frame for prompts
        self.scrollable_frame = ctk.CTkScrollableFrame(self, corner_radius=8)
        self.scrollable_frame.grid(row=1, column=0, sticky="nsew", padx=20, pady=(0, 20))
        self.scrollable_frame.grid_columnconfigure(0, weight=1)
        
        self.prompts = []
        self.cards = []
        
        # Load data
        self.load_data()

    def filter_prompts(self, *args):
        search_query = self.search_var.get().lower()
        role_filter = self.role_var.get().lower()
        
        visible_count = 0
        for card in self.cards:
            matches_search = search_query in card.slug.lower() or search_query in card.body.lower()
            matches_role = role_filter == "all roles" or role_filter == card.role.lower()
            
            if matches_search and matches_role:
                card.grid()
                visible_count += 1
            else:
                card.grid_remove()
                
        self.status_label.configure(text=f"Showing {visible_count} / {len(self.prompts)}")

    def load_data(self):
        try:
            path = get_default_prompts_path()
            if not os.path.exists(path):
                self.status_label.configure(text=f"Error: {path} not found", text_color="red")
                return
                
            self.prompts = load_prompts(path)
            self.status_label.configure(text=f"Loaded {len(self.prompts)} prompts")
            
            # Display prompts
            for i, prompt in enumerate(self.prompts):
                card = PromptCard(self.scrollable_frame, prompt)
                card.grid(row=i, column=0, sticky="ew", pady=(0, 10))
                self.cards.append(card)
                
        except Exception as e:
            self.status_label.configure(text=f"Error loading prompts: {e}", text_color="red")
            print(f"Error: {e}")

if __name__ == "__main__":
    ctk.set_appearance_mode("System")
    ctk.set_default_color_theme("blue")
    
    app = PromptManagerApp()
    app.mainloop()
