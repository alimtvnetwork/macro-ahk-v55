import customtkinter as ctk
from clipboard_service import copy_to_clipboard

class PromptCard(ctk.CTkFrame):
    def __init__(self, master, prompt_data, **kwargs):
        super().__init__(master, **kwargs)
        self.prompt_data = prompt_data
        self.configure(corner_radius=8, border_width=1, border_color="#333333")
        
        # Determine prompt details
        # Fallback if structure varies
        self.slug = prompt_data.get("Slug", "unknown-slug")
        self.role = prompt_data.get("Role", "generic")
        self.body = prompt_data.get("Body", "")
        
        # Header frame
        self.header_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.header_frame.pack(fill="x", padx=10, pady=(10, 5))
        
        self.slug_label = ctk.CTkLabel(
            self.header_frame, 
            text=self.slug, 
            font=ctk.CTkFont(size=14, weight="bold")
        )
        self.slug_label.pack(side="left")
        
        self.role_badge = ctk.CTkLabel(
            self.header_frame,
            text=self.role.upper(),
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#2b6cb0",
            corner_radius=4,
            padx=6,
            pady=2
        )
        self.role_badge.pack(side="left", padx=10)
        
        self.copy_btn = ctk.CTkButton(
            self.header_frame,
            text="Copy",
            width=60,
            height=24,
            command=self.copy_prompt
        )
        self.copy_btn.pack(side="right")
        
        # Body preview
        body_preview = self.body.replace("\n", " ").strip()
        if len(body_preview) > 100:
            body_preview = body_preview[:97] + "..."
            
        self.body_label = ctk.CTkLabel(
            self,
            text=body_preview,
            font=ctk.CTkFont(size=12),
            text_color="gray70",
            anchor="w",
            justify="left"
        )
        self.body_label.pack(fill="x", padx=10, pady=(0, 10))

    def copy_prompt(self):
        success = copy_to_clipboard(self.body)
        if success:
            self.copy_btn.configure(text="Copied!", fg_color="#2b9933")
            self.after(2000, lambda: self.copy_btn.configure(text="Copy", fg_color=["#3B8ED0", "#1F6AA5"]))
