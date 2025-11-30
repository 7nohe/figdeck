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
  layoutMode: "NONE" as const,
  layoutWrap: "NO_WRAP" as const,
  primaryAxisSizingMode: "FIXED" as const,
  counterAxisSizingMode: "FIXED" as const,
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
    const frame = { ...mockFrameNode, children: [] as unknown[] };
    frame.appendChild = mock((child: unknown) => {
      frame.children.push(child);
    });
    return frame;
  }),
  createRectangle: mock(() => ({ ...mockRectangleNode })),
  loadFontAsync: mock(async () => {}),
};

// Now import the modules
import {
  renderBulletList,
  renderCodeBlock,
  renderHeading,
  renderParagraph,
  renderTable,
} from "./block-renderers";

describe("renderHeading", () => {
  const defaultStyle: ResolvedTextStyle = {
    fontSize: 48,
    fills: undefined,
    fontStyle: "Bold",
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

  it("should render list with item spans", async () => {
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
    // When itemSpans are provided, a frame is created
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
});

describe("renderTable", () => {
  const baseFills: Paint[] = [
    { type: "SOLID", color: { r: 0, g: 0, b: 0 } },
  ];

  it("should render table with headers and rows", async () => {
    const headers = [[{ text: "Name" }], [{ text: "Value" }]];
    const rows = [
      [[{ text: "foo" }], [{ text: "1" }]],
      [[{ text: "bar" }], [{ text: "2" }]],
    ];

    const result = await renderTable(headers, rows, [], 16, baseFills, 100, 200);

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
    const headers = [[{ text: "Left" }], [{ text: "Center" }], [{ text: "Right" }]];
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
    const result = renderCodeBlock(
      { code: "plain code" },
      14,
      100,
      200,
    );

    expect(result.node).toBeDefined();
    expect(result.node.name).toBe("Code");
  });

  it("should position code block at specified coordinates", () => {
    const result = renderCodeBlock(
      { language: "js", code: "x" },
      14,
      150,
      300,
    );

    expect(result.node.x).toBe(150);
    expect(result.node.y).toBe(300);
  });

  it("should apply code block styling", () => {
    const result = renderCodeBlock(
      { code: "test" },
      16,
      0,
      0,
    );

    const frame = result.node as unknown as typeof mockFrameNode;
    expect(frame.cornerRadius).toBe(8);
    expect(frame.layoutMode).toBe("VERTICAL");
    expect(frame.paddingLeft).toBe(20);
    expect(frame.paddingRight).toBe(20);
    expect(frame.paddingTop).toBe(16);
    expect(frame.paddingBottom).toBe(16);
  });

  it("should return BlockRenderResult with node and height", () => {
    const result = renderCodeBlock(
      { code: "code" },
      14,
      0,
      0,
    );

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
