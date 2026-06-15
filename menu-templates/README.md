# Menu templates (drop-in folder)

Drop a `*.json` file in this folder and it becomes available in the admin panel
under **Admin → Menu Templates → From project files**. From there a super-admin
can **import** it (making it a reusable template) and **assign** it to cafes —
no code changes or redeploy required.

This is the "WordPress themes folder" model: the file is the source of truth on
disk; importing copies it into the database so the existing assign / apply
machinery can use it. Re-importing the same file updates the imported template in
place (matched by its file name), so you can edit a file and re-import to push
changes.

## File format

Each file is a single JSON object:

```jsonc
{
  // Optional. Stable identifier; defaults to the file name without extension.
  // Change the file name (or this key) only if you want a *new* template
  // rather than an update to the existing one.
  "key": "artisan",

  "name": "Artisan Roastery",                 // required
  "description": "Warm, editorial layout for specialty roasters.",

  // Visual design ------------------------------------------------------------
  "theme": "LUXURY",        // MINIMAL | MODERN | LUXURY | DARK | VINTAGE | NEON | CUSTOM
  "accentColor": "#C8A24B", // hex; used for prices, buttons, active chips

  // Only needed for "theme": "CUSTOM". Any subset of these keys is allowed.
  "themeConfig": {
    "bg": "#101010",
    "surface": "#1B1812",
    "text": "#F5EFE2",
    "muted": "#A89B85",
    "accent": "#C8A24B",
    "onAccent": "#181206",
    "chip": "#2A2418",
    "border": "rgba(200,162,75,0.25)",
    "headingFont": "serif",   // serif | sans | mono
    "radius": "0.5rem",
    "cardStyle": "outline",   // elevated | outline | flat
    "heroTint": "#0A0805"
  },

  // Welcome screen (optional) ------------------------------------------------
  "welcomeTitle": "Welcome",
  "welcomeMessage": "Single-origin coffee, roasted in-house.",
  "previewImageUrl": "https://…",   // optional thumbnail shown in the library

  // Starter content (optional) ----------------------------------------------
  // Cloned onto a cafe when the template is applied "with content".
  "categories": [
    {
      "name": "Espresso",
      "items": [
        {
          "name": "Espresso",
          "description": "Double shot, 18g",
          "price": 4500,            // integer, in minor units (e.g. cents / Toman)
          "discountPrice": 4000,    // optional
          "calories": 5,            // optional
          "ingredients": ["arabica"],
          "allergens": [],
          "prepTimeMin": 2,
          "imageUrl": "https://…",  // optional
          "isAvailable": true
        }
      ]
    }
  ]
}
```

### Notes

- `price` and `discountPrice` are **integers** (minor units), matching the rest
  of the app.
- `theme` must be one of the supported values (case-insensitive). Invalid files
  are still listed in the admin panel, but flagged with the parse error and
  cannot be imported until fixed.
- Files starting with `_` or `.` are ignored, so you can keep drafts/snippets
  alongside live templates.
- To point the API at a different folder, set `MENU_TEMPLATES_DIR` to an
  absolute path.
