import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ResolvedTextStyle } from "./styles";

// Mock Figma API before importing modules that use it
const mockTextNode = {
  name: "",
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  fills: [] as Paint[],
  type: "TEXT",
  fontName: { family: "Inter", style: "Regular" } as FontName,
  fontSize: 16,
  characters: "",
  setRangeFontName: mock(() => {}),
  setRangeFontSize: mock(() => {}),
  setRangeFills: mock(() => {}),
  setRangeTextDecoration: mock(() => {}),
  setRangeHyperlink: mock(() => {}),
  setRangeListOptions: mock(() => {}),
};

const mockFrameNode = {
  name: "",
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  fills: [] as Paint[],
  type: "FRAME",
  children: [] as unknown[],
  layoutMode: "NONE" as "NONE" | "HORIZONTAL" | "VERTICAL",
  layoutWrap: "NO_WRAP" as const,
  primaryAxisSizingMode: "FIXED" as "FIXED" | "AUTO",
  counterAxisSizingMode: "FIXED" as "FIXED" | "AUTO",
  itemSpacing: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
  cornerRadius: 0,
  appendChild: mock((child: unknown) => {
    mockFrameNode.children.push(child);
  }),
};

const mockRectangleNode = {
  name: "",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fills: [] as Paint[],
  type: "RECTANGLE",
  cornerRadius: 0,
  resize: mock(() => {}),
};

// Reset mocks before each test
beforeEach(() => {
  mockTextNode.x = 0;
  mockTextNode.y = 0;
  mockTextNode.characters = "";
  mockTextNode.fills = [];
  mockTextNode.fontName = { family: "Inter", style: "Regular" };
  mockTextNode.fontSize = 16;

  mockFrameNode.x = 0;
  mockFrameNode.y = 0;
  mockFrameNode.children = [];
  mockFrameNode.fills = [];
  mockFrameNode.name = "";

  mockRectangleNode.fills = [];
});

// Set up global figma mock
(globalThis as { figma?: unknown }).figma = {
  createText: mock(() => ({ ...mockTextNode })),
  createFrame: mock(() => {
    const frame: {
      children: unknown[];
      width: number;
      height: number;
      appendChild: ReturnType<typeof mock>;
      resize: ReturnType<typeof mock>;
      [key: string]: unknown;
    } = {
      ...mockFrameNode,
      children: [] as unknown[],
      width: 100,
      height: 50,
      appendChild: mock(() => {}),
      resize: mock(() => {}),
    };
    frame.appendChild = mock((child: unknown) => {
      frame.children.push(child);
    });
    frame.resize = mock((w: number, h: number) => {
      frame.width = w;
      frame.height = h;
    });
    return frame;
  }),
  createRectangle: mock(() => ({ ...mockRectangleNode })),
  loadFontAsync: mock(async () => {}),
};

// Now import the modules
import {
  parseGitHubAlert,
  renderBulletList,
  renderCallout,
  renderCodeBlock,
  renderHeading,
  renderParagraph,
  renderTable,
} from "./block-renderers";

const defaultFont = {
  family: "Inter",
  regular: "Regular",
  bold: "Bold",
  italic: "Italic",
  boldItalic: "Bold Italic",
};

describe("renderHeading", () => {
  const defaultStyle: ResolvedTextStyle = {
    fontSize: 48,
    fills: undefined,
    fontStyle: "Bold",
    font: defaultFont,
  };

  it("should render plain text heading", async () => {
    const result = await renderHeading(
      "Test Heading",
      undefined,
      defaultStyle,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    expect(result.height).toBeGreaterThan(0);
  });

  it("should position heading at specified coordinates", async () => {
    const result = await renderHeading(
      "Test Heading",
      undefined,
      defaultStyle,
      150,
      250,
    );

    expect(result.node.x).toBe(150);
    expect(result.node.y).toBe(250);
  });

  it("should render heading with spans", async () => {
    const spans = [{ text: "Bold ", bold: true }, { text: "Normal" }];

    const result = await renderHeading(
      "Bold Normal",
      spans,
      defaultStyle,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    expect(result.height).toBeGreaterThan(0);
  });

  it("should apply custom fills when provided", async () => {
    const styleWithFill: ResolvedTextStyle = {
      fontSize: 48,
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
      fontStyle: "Bold",
      font: defaultFont,
    };

    const result = await renderHeading(
      "Red Heading",
      undefined,
      styleWithFill,
      100,
      200,
    );

    expect(result.node).toBeDefined();
  });
});

describe("renderParagraph", () => {
  const defaultStyle: ResolvedTextStyle = {
    fontSize: 24,
    fills: undefined,
    fontStyle: "Regular",
    font: defaultFont,
  };

  it("should render plain text paragraph", async () => {
    const result = await renderParagraph(
      "This is a paragraph.",
      undefined,
      defaultStyle,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    expect(result.height).toBeGreaterThan(0);
  });

  it("should position paragraph at specified coordinates", async () => {
    const result = await renderParagraph(
      "Test paragraph",
      undefined,
      defaultStyle,
      120,
      300,
    );

    expect(result.node.x).toBe(120);
    expect(result.node.y).toBe(300);
  });

  it("should render paragraph with spans", async () => {
    const spans = [
      { text: "Normal " },
      { text: "italic", italic: true },
      { text: " text" },
    ];

    const result = await renderParagraph(
      "Normal italic text",
      spans,
      defaultStyle,
      100,
      200,
    );

    expect(result.node).toBeDefined();
  });

  it("should render paragraph with link", async () => {
    const spans = [
      { text: "Click " },
      { text: "here", href: "https://example.com" },
    ];

    const result = await renderParagraph(
      "Click here",
      spans,
      defaultStyle,
      100,
      200,
    );

    expect(result.node).toBeDefined();
  });
});

describe("renderBulletList", () => {
  const defaultStyle: ResolvedTextStyle = {
    fontSize: 24,
    fills: undefined,
    fontStyle: "Regular",
    font: defaultFont,
  };

  it("should render unordered list with plain items", async () => {
    const items = ["First item", "Second item", "Third item"];

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      false,
      1,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    expect(result.height).toBeGreaterThan(0);
  });

  it("should render ordered list with plain items", async () => {
    const items = ["First", "Second", "Third"];

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      true,
      1,
      100,
      200,
    );

    expect(result.node).toBeDefined();
  });

  it("should render ordered list starting from custom number", async () => {
    const items = ["Item 5", "Item 6"];

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      true,
      5,
      100,
      200,
    );

    expect(result.node).toBeDefined();
  });

  it("should render list with item spans (no inline code) as TextNode with native list", async () => {
    const items = ["Bold item", "Normal item"];
    const itemSpans = [
      [{ text: "Bold item", bold: true }],
      [{ text: "Normal item" }],
    ];

    const result = await renderBulletList(
      items,
      itemSpans,
      defaultStyle,
      false,
      1,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    // Without inline code, uses native Figma list (TextNode)
    expect(result.node.type).toBe("TEXT");
  });

  it("should render list with inline code as Frame", async () => {
    const items = ["Item with code", "Normal item"];
    const itemSpans = [
      [{ text: "Item with " }, { text: "code", code: true }],
      [{ text: "Normal item" }],
    ];

    const result = await renderBulletList(
      items,
      itemSpans,
      defaultStyle,
      false,
      1,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    // With inline code, uses Frame-based layout
    expect(result.node.type).toBe("FRAME");
  });

  it("should position list at specified coordinates", async () => {
    const items = ["Item"];

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      false,
      1,
      150,
      300,
    );

    expect(result.node.x).toBe(150);
    expect(result.node.y).toBe(300);
  });

  it("should render flat BulletItem[] without nesting as TextNode", async () => {
    const items = [
      { text: "First item", spans: [{ text: "First item" }] },
      { text: "Second item", spans: [{ text: "Second item" }] },
    ];

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      false,
      1,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    // Flat BulletItem[] without nesting uses native Figma list
    expect(result.node.type).toBe("TEXT");
  });

  it("should offset span formatting when ordered list starts at custom number", async () => {
    const items = [
      { text: "First", spans: [{ text: "First", bold: true }] },
      { text: "Second", spans: [{ text: "Second", italic: true }] },
    ];

    // Reset shared mock to isolate this test's calls
    const sharedFontMock = mockTextNode.setRangeFontName as ReturnType<
      typeof mock
    >;
    sharedFontMock.mockReset();

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      true,
      5,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    const textNode = result.node as unknown as typeof mockTextNode;
    expect(textNode.characters).toBe("5. First\n6. Second");

    // Ensure span formatting accounts for numeric prefixes
    const calls = (textNode.setRangeFontName as ReturnType<typeof mock>).mock
      .calls;
    expect(calls[0]).toEqual([
      3,
      8,
      { family: defaultFont.family, style: defaultFont.bold },
    ]);
    expect(calls[1]).toEqual([
      12,
      18,
      { family: defaultFont.family, style: defaultFont.italic },
    ]);
  });

  it("should render nested BulletItem[] as Frame", async () => {
    const items = [
      {
        text: "Parent item",
        spans: [{ text: "Parent item" }],
        children: [
          { text: "Child item 1", spans: [{ text: "Child item 1" }] },
          { text: "Child item 2", spans: [{ text: "Child item 2" }] },
        ],
      },
      { text: "Another parent", spans: [{ text: "Another parent" }] },
    ];

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      false,
      1,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    // Nested BulletItem[] uses Frame-based layout
    expect(result.node.type).toBe("FRAME");
  });

  it("should render deeply nested BulletItem[] as Frame", async () => {
    const items = [
      {
        text: "Level 0",
        spans: [{ text: "Level 0" }],
        children: [
          {
            text: "Level 1",
            spans: [{ text: "Level 1" }],
            children: [
              {
                text: "Level 2",
                spans: [{ text: "Level 2" }],
                children: [{ text: "Level 3", spans: [{ text: "Level 3" }] }],
              },
            ],
          },
        ],
      },
    ];

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      false,
      1,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    expect(result.node.type).toBe("FRAME");
  });

  it("should render BulletItem[] with special formatting as Frame", async () => {
    const items = [
      {
        text: "Item with code",
        spans: [{ text: "Item with " }, { text: "code", code: true }],
      },
      { text: "Normal item", spans: [{ text: "Normal item" }] },
    ];

    const result = await renderBulletList(
      items,
      undefined,
      defaultStyle,
      false,
      1,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    // BulletItem[] with inline code uses Frame-based layout
    expect(result.node.type).toBe("FRAME");
  });
});

describe("renderTable", () => {
  const baseFills: Paint[] = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];

  it("should render table with headers and rows", async () => {
    const headers = [[{ text: "Name" }], [{ text: "Value" }]];
    const rows = [
      [[{ text: "foo" }], [{ text: "1" }]],
      [[{ text: "bar" }], [{ text: "2" }]],
    ];

    const result = await renderTable(
      headers,
      rows,
      [],
      16,
      baseFills,
      100,
      200,
    );

    expect(result).toBeDefined();
    expect(result.name).toBe("Table");
    expect(result.type).toBe("FRAME");
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it("should render table without position when not specified", async () => {
    const headers = [[{ text: "Col" }]];
    const rows = [[[{ text: "data" }]]];

    const result = await renderTable(headers, rows, [], 16, baseFills);

    expect(result).toBeDefined();
    expect(result.name).toBe("Table");
  });

  it("should apply table layout properties", async () => {
    const headers = [[{ text: "A" }]];
    const rows: never[] = [];

    const result = await renderTable(headers, rows, [], 16, baseFills, 0, 0);

    expect(result.layoutMode).toBe("VERTICAL");
    expect(result.cornerRadius).toBe(4);
    expect(result.clipsContent).toBe(true);
  });

  it("should handle alignment correctly", async () => {
    const headers = [
      [{ text: "Left" }],
      [{ text: "Center" }],
      [{ text: "Right" }],
    ];
    const rows = [[[{ text: "a" }], [{ text: "b" }], [{ text: "c" }]]];
    const align = ["left", "center", "right"] as const;

    const result = await renderTable(
      headers,
      rows,
      align as unknown as ("left" | "center" | "right" | null)[],
      16,
      baseFills,
      0,
      0,
    );

    expect(result).toBeDefined();
    // Table should have header row + 1 body row = 2 children
    expect(result.children.length).toBe(2);
  });

  it("should render empty table with no rows", async () => {
    const headers = [[{ text: "Empty" }]];
    const rows: never[] = [];

    const result = await renderTable(headers, rows, [], 16, baseFills, 0, 0);

    expect(result).toBeDefined();
    // Only header row
    expect(result.children.length).toBe(1);
  });

  it("should render table with formatted cell content", async () => {
    const headers = [[{ text: "Feature", bold: true }]];
    const rows = [[[{ text: "bold", bold: true }, { text: " text" }]]];

    const result = await renderTable(headers, rows, [], 16, baseFills, 0, 0);

    expect(result).toBeDefined();
  });
});

describe("renderCodeBlock", () => {
  it("should render code block with language", () => {
    const result = renderCodeBlock(
      { language: "typescript", code: "const x = 1;" },
      14,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    expect(result.height).toBeGreaterThan(0);
    expect(result.node.name).toBe("Code (typescript)");
  });

  it("should render code block without language", () => {
    const result = renderCodeBlock({ code: "plain code" }, 14, 100, 200);

    expect(result.node).toBeDefined();
    expect(result.node.name).toBe("Code");
  });

  it("should position code block at specified coordinates", () => {
    const result = renderCodeBlock({ language: "js", code: "x" }, 14, 150, 300);

    expect(result.node.x).toBe(150);
    expect(result.node.y).toBe(300);
  });

  it("should apply code block styling", () => {
    const result = renderCodeBlock({ code: "test" }, 16, 0, 0);

    const frame = result.node as unknown as typeof mockFrameNode;
    expect(frame.cornerRadius).toBe(8);
    expect(frame.layoutMode).toBe("VERTICAL");
    expect(frame.paddingLeft).toBe(20);
    expect(frame.paddingRight).toBe(20);
    expect(frame.paddingTop).toBe(16);
    expect(frame.paddingBottom).toBe(16);
  });

  it("should return BlockRenderResult with node and height", () => {
    const result = renderCodeBlock({ code: "code" }, 14, 0, 0);

    expect(result).toHaveProperty("node");
    expect(result).toHaveProperty("height");
    expect(typeof result.height).toBe("number");
  });

  it("should handle multi-line code", () => {
    const multiLineCode = `function hello() {
  console.log("world");
}`;
    const result = renderCodeBlock(
      { language: "javascript", code: multiLineCode },
      14,
      0,
      0,
    );

    expect(result.node).toBeDefined();
  });
});

describe("parseGitHubAlert", () => {
  it("should parse NOTE alert", () => {
    const spans = [{ text: "[!NOTE]\nThis is a note." }];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("NOTE");
    expect(result?.bodySpans[0].text).toBe("This is a note.");
  });

  it("should parse TIP alert", () => {
    const spans = [{ text: "[!TIP]\nThis is a tip." }];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("TIP");
  });

  it("should parse IMPORTANT alert", () => {
    const spans = [{ text: "[!IMPORTANT]\nImportant info." }];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("IMPORTANT");
  });

  it("should parse WARNING alert", () => {
    const spans = [{ text: "[!WARNING]\nWarning message." }];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("WARNING");
  });

  it("should parse CAUTION alert", () => {
    const spans = [{ text: "[!CAUTION]\nCaution message." }];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("CAUTION");
  });

  it("should be case-insensitive", () => {
    const spans = [{ text: "[!note]\nLowercase note." }];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("NOTE");
  });

  it("should return null for non-alert blockquote", () => {
    const spans = [{ text: "This is a regular quote." }];
    const result = parseGitHubAlert(spans);

    expect(result).toBeNull();
  });

  it("should return null for empty spans", () => {
    const result = parseGitHubAlert([]);

    expect(result).toBeNull();
  });

  it("should strip marker from body spans", () => {
    const spans = [
      { text: "[!NOTE] " },
      { text: "Bold text", bold: true },
      { text: " normal" },
    ];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("NOTE");
    // Marker should be stripped, formatting preserved
    expect(result?.bodySpans.some((s) => s.bold === true)).toBe(true);
  });

  it("should handle marker with leading whitespace", () => {
    const spans = [{ text: "  [!TIP]\nTip content." }];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("TIP");
  });

  it("should preserve formatting in body spans", () => {
    const spans = [
      { text: "[!WARNING]\n" },
      { text: "Important ", bold: true },
      { text: "link", href: "https://example.com" },
    ];
    const result = parseGitHubAlert(spans);

    expect(result).not.toBeNull();
    expect(result?.bodySpans.some((s) => s.bold)).toBe(true);
    expect(
      result?.bodySpans.some((s) => s.href === "https://example.com"),
    ).toBe(true);
  });
});

describe("renderCallout", () => {
  it("should render NOTE callout", async () => {
    const alert = {
      type: "NOTE" as const,
      bodySpans: [{ text: "This is a note." }],
    };

    const result = await renderCallout(alert, 16);

    expect(result).toBeDefined();
    expect(result.name).toBe("Callout (NOTE)");
    expect(result.type).toBe("FRAME");
  });

  it("should render WARNING callout", async () => {
    const alert = {
      type: "WARNING" as const,
      bodySpans: [{ text: "Warning message." }],
    };

    const result = await renderCallout(alert, 16);

    expect(result).toBeDefined();
    expect(result.name).toBe("Callout (WARNING)");
  });

  it("should render CAUTION callout", async () => {
    const alert = {
      type: "CAUTION" as const,
      bodySpans: [{ text: "Dangerous action." }],
    };

    const result = await renderCallout(alert, 16);

    expect(result).toBeDefined();
    expect(result.name).toBe("Callout (CAUTION)");
  });

  it("should position callout at specified coordinates", async () => {
    const alert = {
      type: "TIP" as const,
      bodySpans: [{ text: "Tip content." }],
    };

    const result = await renderCallout(alert, 16, undefined, 100, 200);

    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it("should render callout with empty body", async () => {
    const alert = {
      type: "IMPORTANT" as const,
      bodySpans: [],
    };

    const result = await renderCallout(alert, 16);

    expect(result).toBeDefined();
    expect(result.name).toBe("Callout (IMPORTANT)");
  });

  it("should apply horizontal layout", async () => {
    const alert = {
      type: "NOTE" as const,
      bodySpans: [{ text: "Content" }],
    };

    const result = await renderCallout(alert, 16);

    expect(result.layoutMode).toBe("HORIZONTAL");
  });

  it("should create accent bar and content frame", async () => {
    const alert = {
      type: "TIP" as const,
      bodySpans: [{ text: "Tip" }],
    };

    const result = await renderCallout(alert, 16);

    // Should have accent bar and content frame as children
    expect(result.children.length).toBe(2);
  });
});
