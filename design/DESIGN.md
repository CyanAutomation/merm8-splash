# Design System Specification

## 1. Overview & Creative North Star: "The Kinetic Console"

This design system is engineered for the high-performance developer. It rejects the static, "flat" web in favor of a **Kinetic Console** aesthetic—a digital environment that feels like a live, breathing piece of hardware. 

The Creative North Star is **Technical Elegance**. We move beyond standard SaaS templates by embracing intentional asymmetry and "Obsidian Layering." By utilizing high-contrast neon accents against a deep, multi-tonal dark canvas, we create a UI that feels both authoritative and hyper-modern. The experience is defined by the tension between razor-sharp typography and soft, ambient glassmorphism.

---

## 2. Colors & Surface Architecture

The palette is rooted in a "Deep Space" grayscale, punctuated by high-energy "Cyber-Pop" accents.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning. Structural definition must be achieved through:
1.  **Tonal Shifts**: A `surface-container-low` section sitting on a `background` base.
2.  **Negative Space**: Using the Spacing Scale (specifically `8` to `16`) to create "islands" of content.
3.  **Luminous Gradients**: Using a 1px linear-gradient (Primary to Transparent) to "edge-light" a card rather than boxing it in.

### Surface Hierarchy & Nesting
Treat the interface as a physical stack of semi-conductive materials. 
- **Base Layer (`surface` / `#131316`)**: The foundation.
- **Section Layer (`surface-container-low`)**: Large content blocks.
- **Component Layer (`surface-container-high`)**: Modular cards.
- **Active/Hover Layer (`surface-container-highest`)**: Interactive focus.

### The Glass & Gradient Rule
For floating modals or high-level navigation, utilize **Glassmorphism**:
- **Background**: `surface_variant` at 60% opacity.
- **Effect**: `backdrop-blur: 24px`.
- **Accent**: A `primary` to `primary_container` gradient (Pink/Purple) for primary CTAs to inject "soul" into the technical layout.

---

## 3. Typography: Editorial Technicality

We use **Inter** as our workhorse, but treated with an editorial eye for scale.

*   **The Display Scale**: `display-lg` (3.5rem) should be used with tight letter-spacing (-0.02em) to create a bold, "headline-news" impact for technical breakthroughs.
*   **The Functional Pair**: Large `headline-sm` titles (1.5rem) should always be paired with `body-md` (0.875rem) to create a clear hierarchy that guides the developer’s eye through complex documentation.
*   **Data Accents**: While not in the primary scale, use **Fira Code** for inline code snippets and terminal outputs to maintain the "Technical" brand pillar.

---

## 4. Elevation & Depth: Tonal Layering

Shadows and lines are replaced by light and material properties.

### The Layering Principle
Depth is achieved by "stacking" the surface tiers. A card (`surface-container-highest`) placed on a section (`surface-container-low`) creates an immediate visual lift without a single drop shadow.

### Ambient Shadows
When a physical "float" is required (e.g., a dropdown):
- **Blur**: 40px - 60px.
- **Opacity**: 6% of the `on-surface` color.
- **Color**: Tint the shadow with 2% of the `secondary` (Teal) to mimic the glow of a monitor in a dark room.

### The "Ghost Border" Fallback
If accessibility demands a container edge, use a **Ghost Border**:
- **Stroke**: 1px.
- **Token**: `outline-variant` at 15% opacity. 
- **Rule**: Never use 100% opaque borders for decorative containment.

---

## 5. Components

### Buttons
- **Primary**: Gradient background (`primary` to `primary_container`), `rounded-md`, `label-md` (uppercase, bold).
- **Secondary**: `surface-container-highest` background with a `secondary` Ghost Border.
- **Tertiary**: Transparent background, `on-surface` text, underlines only on hover.

### Cards (The Modular Unit)
- **Style**: No borders. Use `surface-container` background. 
- **Padding**: Scale `6` (1.5rem) for internal breathing room.
- **Interaction**: On hover, shift background to `surface-container-high` and add a 1px top-edge highlight using the `primary` token at 30% opacity.

### Input Fields
- **Base**: `surface-container-lowest` background.
- **Focus**: Transition the "Ghost Border" to 50% `secondary` opacity and add a subtle `secondary` outer glow (4px blur).
- **Error**: Use `error` text and a 1px bottom-border in `error` color; do not box the entire input in red.

### Chips
- **Status**: Small `label-sm` text with a 10% opacity background of the status color (e.g., `secondary` for "Success").
- **Spacing**: Scale `1.5` (0.375rem) horizontal padding.

---

## 6. Do’s and Don'ts

### Do:
- **Do** use `surface_bright` sparingly as a "spotlight" background for featured content.
- **Do** allow content to overflow horizontally in terminal-style components to emphasize the "Developer Tool" nature.
- **Do** use high-contrast `on-surface` (#E4E1E6) for maximum readability against dark backgrounds.

### Don't:
- **Don't** use 1px solid grey dividers. Use vertical white space (Scale `8`+) or tonal background shifts.
- **Don't** use standard "Drop Shadows." Use tonal layering or ambient, tinted glows.
- **Don't** use pure black (#000000). Always use the `surface` token (#131316) to maintain depth and prevent OLED "smearing."
- **Don't** center-align long-form technical text. Keep it strictly left-aligned for a "console" feel.