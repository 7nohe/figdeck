import { describe, expect, it } from "bun:test";
import type {
  Blockquote,
  List,
  Paragraph,
  PhrasingContent,
  TableRow,
  Text,
} from "mdast";
import {
  extractBlockquoteContent,
  extractBulletItems,
  extractListItemSpans,
  extractSpans,
  extractTableRow,
  extractText,
  spansToText,
} from "./spans";

// Helper to create mdast nodes
function textNode(value: string): Text {
  return { type: "text", value };
}

function paragraph(children: PhrasingContent[]): Paragraph {
  return { type: "paragraph", children };
}

describe("extractText", () => {
  it("should extract text from text node", () => {
    expect(extractText(textNode("Hello"))).toBe("Hello");
  });

  it("should extract text from node with children", () => {
    const node = {
      type: "paragraph",
      children: [textNode("Hello "), textNode("World")],
    } as Paragraph;
    expect(extractText(node)).toBe("Hello World");
  });
});

describe("extractSpans", () => {
  it("should extract plain text span", () => {
    const nodes: PhrasingContent[] = [textNode("Hello World")];
    const spans = extractSpans(nodes);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual({ text: "Hello World" });
  });

  it("should extract bold text", () => {
    const nodes: PhrasingContent[] = [
      {
        type: "strong",
        children: [textNode("bold")],
      },
    ];
    const spans = extractSpans(nodes);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual({ text: "bold", bold: true });
  });

  it("should extract italic text", () => {
    const nodes: PhrasingContent[] = [
      {
        type: "emphasis",
        children: [textNode("italic")],
      },
    ];
    const spans = extractSpans(nodes);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual({ text: "italic", italic: true });
  });

  it("should extract strikethrough text", () => {
    const nodes: PhrasingContent[] = [
      {
        type: "delete",
        children: [textNode("deleted")],
      },
    ];
    const spans = extractSpans(nodes);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual({ text: "deleted", strike: true });
  });

  it("should extract inline code", () => {
    const nodes: PhrasingContent[] = [
      {
        type: "inlineCode",
        value: "code",
      },
    ];
    const spans = extractSpans(nodes);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual({ text: "code", code: true });
  });

  it("should extract link", () => {
    const nodes: PhrasingContent[] = [
      {
        type: "link",
        url: "https://example.com",
        children: [textNode("link text")],
      },
    ];
    const spans = extractSpans(nodes);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual({
      text: "link text",
      href: "https://example.com",
    });
  });

  it("should handle nested formatting", () => {
    const nodes: PhrasingContent[] = [
      {
        type: "strong",
        children: [
          {
            type: "emphasis",
            children: [textNode("bold italic")],
          },
        ],
      },
    ];
    const spans = extractSpans(nodes);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual({ text: "bold italic", bold: true, italic: true });
  });

  it("should handle mixed content", () => {
    const nodes: PhrasingContent[] = [
      textNode("Normal "),
      { type: "strong", children: [textNode("bold")] },
      textNode(" text"),
    ];
    const spans = extractSpans(nodes);

    expect(spans).toHaveLength(3);
    expect(spans[0]).toEqual({ text: "Normal " });
    expect(spans[1]).toEqual({ text: "bold", bold: true });
    expect(spans[2]).toEqual({ text: " text" });
  });

  it("should preserve marks when extracting inline code", () => {
    const nodes: PhrasingContent[] = [
      {
        type: "strong",
        children: [{ type: "inlineCode", value: "bold code" }],
      },
    ];
    const spans = extractSpans(nodes);

    expect(spans[0]).toEqual({ text: "bold code", code: true, bold: true });
  });
});

describe("spansToText", () => {
  it("should concatenate span texts", () => {
    const spans = [
      { text: "Hello " },
      { text: "World", bold: true },
      { text: "!" },
    ];
    expect(spansToText(spans)).toBe("Hello World!");
  });

  it("should handle empty spans", () => {
    expect(spansToText([])).toBe("");
  });
});

describe("extractListItemSpans", () => {
  it("should extract spans from unordered list", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [paragraph([textNode("Item 1")])],
        },
        {
          type: "listItem",
          children: [paragraph([textNode("Item 2")])],
        },
      ],
    };

    const { texts, spans } = extractListItemSpans(list);

    expect(texts).toEqual(["Item 1", "Item 2"]);
    expect(spans).toHaveLength(2);
    expect(spans[0]).toEqual([{ text: "Item 1" }]);
    expect(spans[1]).toEqual([{ text: "Item 2" }]);
  });

  it("should extract spans with formatting from list items", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [
            paragraph([
              textNode("Normal and "),
              { type: "strong", children: [textNode("bold")] },
            ]),
          ],
        },
      ],
    };

    const { texts, spans } = extractListItemSpans(list);

    expect(texts).toEqual(["Normal and bold"]);
    expect(spans[0]).toEqual([
      { text: "Normal and " },
      { text: "bold", bold: true },
    ]);
  });
});

describe("extractTableRow", () => {
  it("should extract spans from table cells", () => {
    const row: TableRow = {
      type: "tableRow",
      children: [
        { type: "tableCell", children: [textNode("Cell 1")] },
        { type: "tableCell", children: [textNode("Cell 2")] },
      ],
    };

    const cells = extractTableRow(row);

    expect(cells).toHaveLength(2);
    expect(cells[0]).toEqual([{ text: "Cell 1" }]);
    expect(cells[1]).toEqual([{ text: "Cell 2" }]);
  });

  it("should preserve formatting in table cells", () => {
    const row: TableRow = {
      type: "tableRow",
      children: [
        {
          type: "tableCell",
          children: [{ type: "strong", children: [textNode("Bold")] }],
        },
      ],
    };

    const cells = extractTableRow(row);

    expect(cells[0]).toEqual([{ text: "Bold", bold: true }]);
  });
});

describe("extractBulletItems", () => {
  it("should extract flat list items", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [paragraph([textNode("Item 1")])],
        },
        {
          type: "listItem",
          children: [paragraph([textNode("Item 2")])],
        },
      ],
    };

    const items = extractBulletItems(list);

    expect(items).toHaveLength(2);
    expect(items[0].text).toBe("Item 1");
    expect(items[1].text).toBe("Item 2");
    expect(items[0].children).toBeUndefined();
    expect(items[1].children).toBeUndefined();
  });

  it("should extract nested list items", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [
            paragraph([textNode("Parent")]),
            {
              type: "list",
              ordered: false,
              children: [
                {
                  type: "listItem",
                  children: [paragraph([textNode("Child 1")])],
                },
                {
                  type: "listItem",
                  children: [paragraph([textNode("Child 2")])],
                },
              ],
            },
          ],
        },
      ],
    };

    const items = extractBulletItems(list);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Parent");
    expect(items[0].children).toHaveLength(2);
    expect(items[0].children?.[0].text).toBe("Child 1");
    expect(items[0].children?.[1].text).toBe("Child 2");
  });

  it("should extract deeply nested list items", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [
            paragraph([textNode("Level 0")]),
            {
              type: "list",
              ordered: false,
              children: [
                {
                  type: "listItem",
                  children: [
                    paragraph([textNode("Level 1")]),
                    {
                      type: "list",
                      ordered: false,
                      children: [
                        {
                          type: "listItem",
                          children: [paragraph([textNode("Level 2")])],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const items = extractBulletItems(list);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Level 0");
    expect(items[0].children).toHaveLength(1);
    expect(items[0].children?.[0].text).toBe("Level 1");
    expect(items[0].children?.[0].children).toHaveLength(1);
    expect(items[0].children?.[0].children?.[0].text).toBe("Level 2");
  });

  it("should extract spans with formatting from list items", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [
            paragraph([
              textNode("Normal "),
              { type: "strong", children: [textNode("bold")] },
              textNode(" text"),
            ]),
          ],
        },
      ],
    };

    const items = extractBulletItems(list);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Normal bold text");
    expect(items[0].spans).toHaveLength(3);
    expect(items[0].spans?.[0].text).toBe("Normal ");
    expect(items[0].spans?.[0].bold).toBeUndefined();
    expect(items[0].spans?.[1].text).toBe("bold");
    expect(items[0].spans?.[1].bold).toBe(true);
    expect(items[0].spans?.[2].text).toBe(" text");
  });

  it("should handle mixed nested and flat items", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [paragraph([textNode("Flat item")])],
        },
        {
          type: "listItem",
          children: [
            paragraph([textNode("Parent with children")]),
            {
              type: "list",
              ordered: false,
              children: [
                {
                  type: "listItem",
                  children: [paragraph([textNode("Child")])],
                },
              ],
            },
          ],
        },
        {
          type: "listItem",
          children: [paragraph([textNode("Another flat item")])],
        },
      ],
    };

    const items = extractBulletItems(list);

    expect(items).toHaveLength(3);
    expect(items[0].text).toBe("Flat item");
    expect(items[0].children).toBeUndefined();
    expect(items[1].text).toBe("Parent with children");
    expect(items[1].children).toHaveLength(1);
    expect(items[1].children?.[0].text).toBe("Child");
    expect(items[2].text).toBe("Another flat item");
    expect(items[2].children).toBeUndefined();
  });

  it("should concatenate multiple paragraphs in a list item", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [
            paragraph([textNode("First paragraph")]),
            paragraph([textNode("Second paragraph")]),
            paragraph([textNode("Third paragraph")]),
          ],
        },
      ],
    };

    const items = extractBulletItems(list);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe(
      "First paragraph\nSecond paragraph\nThird paragraph",
    );
    expect(items[0].spans).toHaveLength(5); // 3 text spans + 2 newline spans
    expect(items[0].spans?.[0].text).toBe("First paragraph");
    expect(items[0].spans?.[1].text).toBe("\n");
    expect(items[0].spans?.[2].text).toBe("Second paragraph");
    expect(items[0].spans?.[3].text).toBe("\n");
    expect(items[0].spans?.[4].text).toBe("Third paragraph");
  });

  it("should concatenate multiple paragraphs with formatting", () => {
    const list: List = {
      type: "list",
      ordered: false,
      children: [
        {
          type: "listItem",
          children: [
            paragraph([
              textNode("Normal "),
              { type: "strong", children: [textNode("bold")] },
            ]),
            paragraph([
              { type: "emphasis", children: [textNode("italic")] },
              textNode(" text"),
            ]),
          ],
        },
      ],
    };

    const items = extractBulletItems(list);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Normal bold\nitalic text");
    // Check formatting is preserved across paragraphs
    const spans = items[0].spans ?? [];
    expect(spans[0].text).toBe("Normal ");
    expect(spans[1].text).toBe("bold");
    expect(spans[1].bold).toBe(true);
    expect(spans[2].text).toBe("\n");
    expect(spans[3].text).toBe("italic");
    expect(spans[3].italic).toBe(true);
    expect(spans[4].text).toBe(" text");
  });
});

describe("extractBlockquoteContent", () => {
  it("should extract text and spans from blockquote", () => {
    const blockquote: Blockquote = {
      type: "blockquote",
      children: [paragraph([textNode("Quote text")])],
    };

    const result = extractBlockquoteContent(blockquote);

    expect(result.text).toBe("Quote text");
    expect(result.spans).toEqual([{ text: "Quote text" }]);
  });

  it("should handle multiple paragraphs with line breaks", () => {
    const blockquote: Blockquote = {
      type: "blockquote",
      children: [
        paragraph([textNode("Line 1")]),
        paragraph([textNode("Line 2")]),
      ],
    };

    const result = extractBlockquoteContent(blockquote);

    expect(result.text).toBe("Line 1\nLine 2");
    expect(result.spans).toHaveLength(3);
    expect(result.spans[0]).toEqual({ text: "Line 1" });
    expect(result.spans[1]).toEqual({ text: "\n" });
    expect(result.spans[2]).toEqual({ text: "Line 2" });
  });

  it("should preserve formatting in blockquote", () => {
    const blockquote: Blockquote = {
      type: "blockquote",
      children: [
        paragraph([
          textNode("Quote with "),
          { type: "strong", children: [textNode("bold")] },
        ]),
      ],
    };

    const result = extractBlockquoteContent(blockquote);

    expect(result.text).toBe("Quote with bold");
    expect(result.spans).toEqual([
      { text: "Quote with " },
      { text: "bold", bold: true },
    ]);
  });
});
