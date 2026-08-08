import customtkinter as ctk
import pyperclip
from data.loader import load_prompts, Prompt

class MainWindow(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Prompt Manager")
        self.geometry("1000x700")
        
        # Appearance mode and color theme
        ctk.set_appearance_mode("Dark")
        ctk.set_default_color_theme("blue")

        self.prompts = load_prompts()
        self.filtered_prompts = self.prompts

        # Grid layout
        self.grid_columnconfigure(0, weight=1) # Sidebar
        self.grid_columnconfigure(1, weight=3) # Detail Panel
        self.grid_rowconfigure(0, weight=1)

        # 1. Sidebar (List of prompts)
        self.sidebar_frame = ctk.CTkFrame(self, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(2, weight=1)
        self.sidebar_frame.grid_columnconfigure(0, weight=1)

        self.sidebar_label = ctk.CTkLabel(self.sidebar_frame, text="Prompt Library", font=ctk.CTkFont(size=18, weight="bold"))
        self.sidebar_label.grid(row=0, column=0, padx=20, pady=20)

        self.search_entry = ctk.CTkEntry(self.sidebar_frame, placeholder_text="Search prompts...")
        self.search_entry.grid(row=1, column=0, padx=15, pady=5, sticky="ew")
        self.search_entry.bind("<KeyRelease>", self.on_search)

        self.listbox = ctk.CTkScrollableFrame(self.sidebar_frame)
        self.listbox.grid(row=2, column=0, sticky="nsew", padx=10, pady=10)

        self.prompt_buttons = []

        # 2. Detail Panel
        self.detail_frame = ctk.CTkFrame(self)
        self.detail_frame.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        self.detail_frame.grid_rowconfigure(1, weight=1)
        self.detail_frame.grid_columnconfigure(0, weight=1)

        self.title_label = ctk.CTkLabel(self.detail_frame, text="Select a prompt", font=ctk.CTkFont(size=24, weight="bold"))
        self.title_label.grid(row=0, column=0, padx=20, pady=20, sticky="w")

        self.textbox = ctk.CTkTextbox(self.detail_frame, wrap="word", font=ctk.CTkFont(family="Consolas", size=13))
        self.textbox.grid(row=1, column=0, sticky="nsew", padx=20, pady=10)

        self.copy_button = ctk.CTkButton(self.detail_frame, text="Copy Prompt", command=self.on_copy, state="disabled", font=ctk.CTkFont(weight="bold"))
        self.copy_button.grid(row=2, column=0, padx=20, pady=20, sticky="e")

        self.current_prompt = None

        self.populate_list(self.prompts)

    def on_search(self, event):
        query = self.search_entry.get().lower()
        self.filtered_prompts = [p for p in self.prompts if query in p.name.lower() or (p.slug and query in p.slug.lower())]
        self.populate_list(self.filtered_prompts)

    def populate_list(self, prompts):
        # Clear existing
        for btn in self.prompt_buttons:
            btn.destroy()
        self.prompt_buttons.clear()

        for prompt in prompts:
            btn = ctk.CTkButton(
                self.listbox,
                text=f"{prompt.name}\\n[{prompt.category}]",
                anchor="w",
                fg_color="transparent",
                hover_color=("gray70", "gray30"),
                text_color=("gray10", "gray90"),
                command=lambda p=prompt: self.select_prompt(p)
            )
            btn.pack(fill="x", pady=2, padx=2)
            self.prompt_buttons.append(btn)

    def select_prompt(self, prompt: Prompt):
        self.current_prompt = prompt
        self.title_label.configure(text=prompt.name)
        self.textbox.delete("1.0", "end")
        self.textbox.insert("1.0", prompt.text)
        self.copy_button.configure(state="normal")
        self.copy_button.configure(text="Copy Prompt")

    def on_copy(self):
        if self.current_prompt:
            pyperclip.copy(self.current_prompt.text)
            self.copy_button.configure(text="Copied!")
            self.after(2000, lambda: self.copy_button.configure(text="Copy Prompt") if self.copy_button.cget("text") == "Copied!" else None)
