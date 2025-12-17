export type FrontmatterDef =
  | FrontmatterStringDef
  | FrontmatterNumberDef
  | FrontmatterBooleanDef
  | FrontmatterObjectDef
  | FrontmatterOneOfDef;

export type FrontmatterDefKind =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "oneOf";

export type FrontmatterStringDef = {
  kind: "string";
  description: string;
  values?: readonly string[];
  pattern?: RegExp;
  patternError?: string;
};

export type FrontmatterNumberDef = {
  kind: "number";
  description: string;
  min?: number;
  max?: number;
};

export type FrontmatterBooleanDef = {
  kind: "boolean";
  description: string;
  allowedValues?: readonly boolean[];
};

export type FrontmatterObjectDef = {
  kind: "object";
  description: string;
  children: Record<string, FrontmatterDef>;
};

export type FrontmatterOneOfDef = {
  kind: "oneOf";
  description: string;
  options: readonly FrontmatterDef[];
};

const COLOR_HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FIGMA_URL_PATTERN = /^https:\/\/(www\.)?figma\.com\//;

export const TRANSITION_STYLES = [
  "none",
  "dissolve",
  "smart-animate",
  "slide-from-left",
  "slide-from-right",
  "slide-from-top",
  "slide-from-bottom",
  "push-from-left",
  "push-from-right",
  "push-from-top",
  "push-from-bottom",
  "move-from-left",
  "move-from-right",
  "move-from-top",
  "move-from-bottom",
  "slide-out-to-left",
  "slide-out-to-right",
  "slide-out-to-top",
  "slide-out-to-bottom",
  "move-out-to-left",
  "move-out-to-right",
  "move-out-to-top",
  "move-out-to-bottom",
] as const;

export const TRANSITION_CURVES = [
  "ease-in",
  "ease-out",
  "ease-in-and-out",
  "linear",
  "gentle",
  "quick",
  "bouncy",
  "slow",
] as const;

export const TRANSITION_TIMING_TYPES = ["on-click", "after-delay"] as const;

const TEXT_STYLE_SCHEMA: Record<string, FrontmatterDef> = {
  size: {
    kind: "number",
    description: "Font size in pixels",
    min: 1,
    max: 200,
  },
  color: {
    kind: "string",
    description: "Text color",
    pattern: COLOR_HEX_PATTERN,
    patternError: "Invalid color format. Use #rgb or #rrggbb",
  },
  x: { kind: "number", description: "Absolute X position" },
  y: { kind: "number", description: "Absolute Y position" },
  spacing: { kind: "number", description: "Gap between items", min: 0 },
};

const FONT_VARIANT_SCHEMA: Record<string, FrontmatterDef> = {
  family: { kind: "string", description: "Font family name" },
  style: { kind: "string", description: 'Base style (default: "Regular")' },
  bold: { kind: "string", description: 'Bold variant (default: "Bold")' },
  italic: { kind: "string", description: 'Italic variant (default: "Italic")' },
  boldItalic: { kind: "string", description: "Bold Italic variant" },
};

const FONT_DEF: FrontmatterDef = {
  kind: "oneOf",
  description: "Font configuration (family string or object)",
  options: [
    { kind: "string", description: "Font family name" },
    {
      kind: "object",
      description: "Font configuration",
      children: FONT_VARIANT_SCHEMA,
    },
  ],
};

const TRANSITION_DEF: FrontmatterDef = {
  kind: "oneOf",
  description: "Slide transition animation",
  options: [
    {
      kind: "string",
      description:
        "Transition shorthand (e.g., dissolve or slide-from-right 0.5)",
      values: TRANSITION_STYLES,
    },
    {
      kind: "object",
      description: "Transition configuration",
      children: {
        style: {
          kind: "string",
          description: "Animation style",
          values: TRANSITION_STYLES,
        },
        duration: {
          kind: "number",
          description: "Duration in seconds (0.01-10)",
          min: 0.01,
          max: 10,
        },
        curve: {
          kind: "string",
          description: "Easing curve",
          values: TRANSITION_CURVES,
        },
        timing: {
          kind: "object",
          description: "Timing configuration",
          children: {
            type: {
              kind: "string",
              description: "Timing type",
              values: TRANSITION_TIMING_TYPES,
            },
            delay: {
              kind: "number",
              description: "Auto-advance delay (seconds) 0-30",
              min: 0,
              max: 30,
            },
          },
        },
      },
    },
  ],
};

export const FRONTMATTER_SPEC: Record<string, FrontmatterDef> = {
  figdeck: {
    kind: "boolean",
    description: "Enable figdeck processing for this file",
  },
  cover: {
    kind: "boolean",
    description: "Treat the first slide as a cover (default: true)",
  },
  background: {
    kind: "oneOf",
    description:
      "Unified background: color, gradient, image, or Figma component",
    options: [
      {
        kind: "string",
        description:
          "Auto-detected: color (#hex), gradient (#color:0%,...), image (path/URL), or Figma component URL",
      },
      {
        kind: "object",
        description: "Explicit background configuration",
        children: {
          color: {
            kind: "string",
            description: "Solid background color",
            pattern: COLOR_HEX_PATTERN,
            patternError: "Invalid color format. Use #rgb or #rrggbb",
          },
          gradient: {
            kind: "string",
            description: "Gradient (e.g., #0d1117:0%,#fff:100%@45)",
            pattern: /^#[0-9a-fA-F]{3,6}:\d+%/,
            patternError:
              "Invalid gradient format. Use #color:0%,#color:100%[@angle]",
          },
          template: {
            kind: "string",
            description: "Figma paint style name",
          },
          image: {
            kind: "string",
            description: "Background image path or URL",
          },
          component: {
            kind: "oneOf",
            description: "Figma Component/Frame as background layer",
            options: [
              {
                kind: "string",
                description: "Figma URL with node-id",
                pattern: FIGMA_URL_PATTERN,
                patternError: "Must be a valid Figma URL with node-id",
              },
              {
                kind: "object",
                description: "Component configuration",
                children: {
                  link: {
                    kind: "string",
                    description: "Figma component/frame link",
                    pattern: FIGMA_URL_PATTERN,
                    patternError: "Must be a valid Figma URL",
                  },
                  fit: {
                    kind: "string",
                    description: "How the component should be scaled",
                    values: ["cover", "contain", "stretch"],
                  },
                  align: {
                    kind: "string",
                    description: "Position alignment",
                    values: [
                      "center",
                      "top-left",
                      "top-right",
                      "bottom-left",
                      "bottom-right",
                    ],
                  },
                  opacity: {
                    kind: "number",
                    description: "Opacity (0-1)",
                    min: 0,
                    max: 1,
                  },
                },
              },
            ],
          },
        },
      },
    ],
  },
  color: {
    kind: "string",
    description: "Base text color for all elements",
    pattern: COLOR_HEX_PATTERN,
    patternError: "Invalid color format. Use #rgb or #rrggbb",
  },
  align: {
    kind: "string",
    description: "Horizontal alignment",
    values: ["left", "center", "right"],
  },
  valign: {
    kind: "string",
    description: "Vertical alignment",
    values: ["top", "middle", "bottom"],
  },
  headings: {
    kind: "object",
    description: "Heading styles configuration",
    children: {
      h1: {
        kind: "object",
        description: "H1 heading style",
        children: TEXT_STYLE_SCHEMA,
      },
      h2: {
        kind: "object",
        description: "H2 heading style",
        children: TEXT_STYLE_SCHEMA,
      },
      h3: {
        kind: "object",
        description: "H3 heading style",
        children: TEXT_STYLE_SCHEMA,
      },
      h4: {
        kind: "object",
        description: "H4 heading style",
        children: TEXT_STYLE_SCHEMA,
      },
    },
  },
  paragraphs: {
    kind: "object",
    description: "Paragraph style configuration",
    children: TEXT_STYLE_SCHEMA,
  },
  bullets: {
    kind: "object",
    description: "Bullet list style configuration",
    children: TEXT_STYLE_SCHEMA,
  },
  code: {
    kind: "object",
    description: "Code block style configuration",
    children: TEXT_STYLE_SCHEMA,
  },
  fonts: {
    kind: "object",
    description: "Custom font configuration",
    children: {
      h1: FONT_DEF,
      h2: FONT_DEF,
      h3: FONT_DEF,
      h4: FONT_DEF,
      body: FONT_DEF,
      bullets: FONT_DEF,
      code: FONT_DEF,
    },
  },
  slideNumber: {
    kind: "oneOf",
    description: "Slide number configuration",
    options: [
      {
        kind: "boolean",
        description: "Boolean shorthand (true = show, false = hide)",
        allowedValues: [true, false],
      },
      {
        kind: "object",
        description: "Slide number configuration",
        children: {
          show: { kind: "boolean", description: "Show/hide slide numbers" },
          position: {
            kind: "string",
            description: "Position of slide number",
            values: ["bottom-right", "bottom-left", "top-right", "top-left"],
          },
          size: {
            kind: "number",
            description: "Font size in pixels",
            min: 1,
            max: 200,
          },
          color: {
            kind: "string",
            description: "Text color",
            pattern: COLOR_HEX_PATTERN,
            patternError: "Invalid color format. Use #rgb or #rrggbb",
          },
          paddingX: { kind: "number", description: "Horizontal padding" },
          paddingY: { kind: "number", description: "Vertical padding" },
          format: {
            kind: "string",
            description: 'Display format (e.g., "{{current}} / {{total}}")',
          },
          link: {
            kind: "string",
            description: "Custom Frame design Figma link",
            pattern: FIGMA_URL_PATTERN,
            patternError: "Must be a valid Figma URL",
          },
          nodeId: { kind: "string", description: "Custom Frame node-id" },
          startFrom: {
            kind: "number",
            description: "Start showing from slide N",
            min: 1,
          },
          offset: {
            kind: "number",
            description: "Number to add to displayed slide number",
          },
        },
      },
    ],
  },
  titlePrefix: {
    kind: "oneOf",
    description: "Title prefix component configuration",
    options: [
      {
        kind: "boolean",
        description: "Disable title prefix",
        allowedValues: [false],
      },
      {
        kind: "object",
        description: "Title prefix component configuration",
        children: {
          link: {
            kind: "string",
            description: "Figma component link",
            pattern: FIGMA_URL_PATTERN,
            patternError: "Must be a valid Figma URL",
          },
          nodeId: { kind: "string", description: "Figma node-id" },
          spacing: {
            kind: "number",
            description: "Gap between prefix and title",
            min: 0,
          },
        },
      },
    ],
  },
  transition: TRANSITION_DEF,
};
