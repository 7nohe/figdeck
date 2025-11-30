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
