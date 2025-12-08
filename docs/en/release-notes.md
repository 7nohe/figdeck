# Release Notes

## [1.4.0] - 2025-12-08

### New Features

#### Multi-Column Layouts
Added support for multi-column layouts using `:::columns` syntax. Create 2-4 column layouts with customizable gap and width ratios.

**Key Features:**
- Support for 2-4 columns
- Custom gap between columns (default: 32px, max: 200px)
- Flexible width ratios using `fr`, percentage, or pixel values
- Full content support within columns (paragraphs, lists, code, images, tables, blockquotes, headings)
- Automatic fallback to vertical stacking when columns are too narrow (min: 320px)

**Basic Example:**
```markdown
:::columns
:::column
### Left Column

- Item 1
- Item 2

:::column
### Right Column

- Item A
- Item B
:::
```

**With Options:**
```markdown
:::columns gap=64 width=1fr/2fr
:::column
### Sidebar

Navigation content.

:::column
### Main Content

This column takes up twice the width.
:::
```

See `examples/columns.md` for more examples.

#### Absolute Position Support for Images
Added support for absolute positioning of images using `x` and `y` parameters in Marp-style syntax.

**Supported Formats:**
- `![x:100 y:200](./image.png)` - Position at 100px, 200px
- `![x:50% y:50%](./image.png)` - Position at center of slide (percentage of 1920x1080)
- `![w:300 x:100 y:200](./image.png)` - Size + position combined

When `x` or `y` is specified, the image is placed at absolute coordinates instead of auto-layout flow.

See `examples/images.md` for details.

### Documentation
- Added comprehensive documentation for multi-column layouts (English and Japanese)
- Added documentation for image absolute positioning
- Updated `CLAUDE.md` with new features

### Tests
- Added comprehensive tests for multi-column layout parsing
- Added tests for image absolute positioning

---

## [1.3.0] - 2025-12-07

### New Features

#### Rich Text Formatting in Figma Link Text Overrides
Added support for rich text formatting in Figma link block text overrides.

**Supported Formatting:**
- `**bold**`
- `*italic*`
- `~~strikethrough~~`
- `[links](url)`
- Bullet lists
- Blockquotes

**Example:**
```markdown
:::figma
link=https://www.figma.com/design/xxx?node-id=1234-5678
text.title=Cart Feature
text.body=Use this for **cart** and *confirmation* flows.
text.list=
  - Variation A
  - Variation B
:::
```

#### Bullet Item Spacing Customization
Added ability to customize spacing between bullet list items using the `spacing` property.

**Example:**
```yaml
---
bullets:
  size: 20
  spacing: 12  # Gap between items in pixels
---
```

#### Caching and Performance Optimizations
Significantly improved slide generation performance.

**Key Improvements:**
- Added local image caching (avoids reloading the same images)
- Added Figma node caching (improves efficiency during regeneration)
- Cached syntax highlighting for code blocks
- Hash-based change detection for differential updates

#### Plugin UI Improvements
Added a toggle to show/hide advanced connection options. By default, a simple connection screen is displayed, with the ability to expand advanced options (host, port, secret) as needed.

### Fixes

#### Resolved Hyperlink Rendering Issues
Fixed an issue where hyperlinks were not rendering correctly in Figma Slides. Links within text are now properly recognized and clickable.

### Improvements

#### Enhanced Text Rendering
Improved handling of multiline text spans and inline code.

#### Introduction of Shared Package
Extracted shared type definitions and utilities between CLI and Plugin into `@figdeck/shared` package. This reduces code duplication and improves maintainability.

### Documentation
- Added Figma plugin installation instructions to README
- Added WebSocket connection requirements explanation
- Added documentation for rich text formatting in Figma links
- Added documentation for bullet item spacing customization

### Tests
- Added tests for Figma link rich text parsing
- Added tests for hyperlink rendering
- Added tests for local image caching
- Added tests for hash functions

## [1.2.1] - 2025-12-05

### Improvements
- **Enhanced nested bullet list functionality**: Improved to preserve ordered list metadata. This ensures that order information is correctly maintained even when ordered and unordered lists are mixed in nested lists.

## [1.2.0] - 2025-12-05

### New Features

#### Custom Font Configuration
You can now configure font families and variants in YAML frontmatter. Fonts can be set individually for headings (h1, h2), body text, bullet points, and code blocks.

**Key Features:**
- Custom font family configuration
- Individual settings for font variants (Regular, Bold, Italic, Bold Italic)
- Support for both shorthand notation and full configuration
- Automatic fallback when fonts are unavailable

**Example:**
```yaml
---
fonts:
  h1:
    family: "Roboto"
    style: "Medium"        # Base style
    bold: "Bold"           # Bold variant
    italic: "Italic"       # Italic variant
    boldItalic: "Bold Italic"  # Bold Italic variant
  h2: "Open Sans"          # Shorthand notation (uses "Regular")
  body:
    family: "Source Sans Pro"
    style: "Regular"
    bold: "Semibold"       # Custom bold variant
  bullets:
    family: "Inter"
    style: "Regular"
  code:
    family: "Fira Code"
    style: "Regular"
---
```

See `examples/fonts.md` for details.

#### Version Compatibility Check
Introduced protocol versioning for CLI-Plugin communication, enabling detection of version mismatches.

**Key Features:**
- Automatic version check on WebSocket connection
- Version mismatch warning display in Plugin UI
- CLI automatically reads version from `package.json`
- Ensures communication between compatible versions

**Behavior:**
- CLI and Plugin exchange version information on connection
- Warning displayed when major versions differ
- Minor and patch version differences are tolerated

#### Image Size Specification (Marp Style)
Added support for image size specifications. Supports individual width/height settings, fixed sizes, and percentage-based sizing.

**Supported Formats:**
- `![w:400](./image.png)` - Width 400px (height auto-calculated, maintains aspect ratio)
- `![h:300](./image.png)` - Height 300px (width auto-calculated, maintains aspect ratio)
- `![w:400 h:300](./image.png)` - Fixed size 400x300px
- `![w:50%](./image.png)` - 50% of slide width (slide width is 1920px)
- `![w:400 Logo](./image.png)` - Size specification + alt text

See `examples/images.md` for details.

#### Nested Bullet Lists
Added support for multi-level nested bullet lists. Different markers are used for each level to visually represent hierarchy.

**Key Features:**
- Support for up to 4 levels of nesting
- Different markers for each level (•, ◦, ▪, –)
- Support for mixing ordered and unordered lists
- Support for inline formatting (bold, italic, code, links)

**Markers:**
- Level 0: `•` (U+2022)
- Level 1: `◦` (U+25E6)
- Level 2: `▪` (U+25AA)
- Level 3+: `–` (U+2013)

**Example:**
```markdown
- Level 0 item
  - Level 1 item (indented with 2 spaces)
  - Another level 1 item
    - Level 2 item
    - Another level 2 item
      - Level 3 item
- Back to level 0
```

See `examples/bullets.md` for details.

### Improvements

#### Dependency Updates
- Updated esbuild to 0.27.1 for improved compatibility and performance

#### Build Configuration Optimization
- Adjusted Plugin build target to ES2016 to ensure compatibility with Figma Plugin sandbox environment
- Improved automatic transpilation of modern JavaScript syntax

### Documentation
- Added detailed documentation for custom font configuration (English and Japanese)
- Added usage examples and documentation for image size specifications
- Added specifications and usage examples for nested bullet lists
- Added explanations about version compatibility
- Added descriptions of new features to `CLAUDE.md`

### Tests
- Added comprehensive tests for custom font configuration
- Added tests for image size specifications
- Added tests for nested bullet lists
- Added tests for version compatibility checks
