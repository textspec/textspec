import { describe, expect, test } from "vitest";
import { parse } from "./parser";
import { serialize } from "./serializer";

describe("Edge Cases", () => {
  describe("unicode", () => {
    test("chinese text", () => {
      expect(parse("P: 你好世界|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "你好世界" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 4 },
          focus: { path: [0, 0], offset: 4 },
        },
      });
    });

    test("emoji", () => {
      expect(parse("P: Hello 🌍🎉|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "Hello 🌍🎉" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 10 },
          focus: { path: [0, 0], offset: 10 },
        },
      });
    });

    test("unicode escape sequences", () => {
      expect(parse("P: \\u0041\\u0042\\u0043|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "ABC" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("mixed unicode and ascii", () => {
      expect(parse("P: Hello 世界 test 🎉|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "Hello 世界 test 🎉" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 16 },
          focus: { path: [0, 0], offset: 16 },
        },
      });
    });

    test("round-trips unicode", () => {
      const input = "P: 你好世界 🎉|";
      expect(parse(serialize(parse(input)))).toEqual(parse(input));
    });
  });

  describe("whitespace", () => {
    test("empty text block", () => {
      expect(parse("P: |")).toEqual({
        blocks: [{ kind: "textBlock", type: "P", children: [] }],
        selection: {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [0, 0], offset: 0 },
        },
      });
    });

    test("escaped space", () => {
      expect(parse("P: a\\sb|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "a b" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("leading space via escape", () => {
      expect(parse("P: \\sfoo|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: " foo" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 4 },
          focus: { path: [0, 0], offset: 4 },
        },
      });
    });

    test("trailing space via escape", () => {
      expect(parse("P: foo\\s|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo " }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 4 },
          focus: { path: [0, 0], offset: 4 },
        },
      });
    });

    test("blank lines between blocks", () => {
      expect(parse("P: foo|\n\nP: bar")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "bar" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });
  });

  describe("selection boundaries", () => {
    test("at start of text", () => {
      expect(parse("P: |foo")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [0, 0], offset: 0 },
        },
      });
    });

    test("at end of text", () => {
      expect(parse("P: foo|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("before mark", () => {
      expect(parse("P: foo|[strong:bar]")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "text", text: "foo" },
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [{ kind: "text", text: "bar" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("after mark", () => {
      expect(parse("P: [strong:bar]|foo")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [{ kind: "text", text: "bar" }],
              },
              { kind: "text", text: "foo" },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("inside mark at start", () => {
      expect(parse("P: [strong:|bar]")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [{ kind: "text", text: "bar" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 0, 0], offset: 0 },
          focus: { path: [0, 0, 0], offset: 0 },
        },
      });
    });

    test("inside mark at end", () => {
      expect(parse("P: [strong:bar|]")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [{ kind: "text", text: "bar" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 0, 0], offset: 3 },
          focus: { path: [0, 0, 0], offset: 3 },
        },
      });
    });

    test("spanning mark boundary", () => {
      expect(parse("P: fo^o[strong:ba|r]")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "text", text: "foo" },
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [{ kind: "text", text: "bar" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 2 },
          focus: { path: [0, 1, 0], offset: 2 },
        },
      });
    });
  });

  describe("nested structures", () => {
    test("deeply nested marks", () => {
      expect(parse("P: [strong:[em:[underline:foo]]]|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [
                  {
                    kind: "mark",
                    type: "em",
                    mode: "decorator",
                    children: [
                      {
                        kind: "mark",
                        type: "underline",
                        mode: "decorator",
                        children: [{ kind: "text", text: "foo" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("nested containers", () => {
      expect(
        parse("UL:\n  LI:\n    P: foo\n    UL:\n      LI:\n        P: bar|"),
      ).toEqual({
        blocks: [
          {
            kind: "containerBlock",
            type: "UL",
            children: [
              {
                kind: "containerBlock",
                type: "LI",
                children: [
                  {
                    kind: "textBlock",
                    type: "P",
                    children: [{ kind: "text", text: "foo" }],
                  },
                  {
                    kind: "containerBlock",
                    type: "UL",
                    children: [
                      {
                        kind: "containerBlock",
                        type: "LI",
                        children: [
                          {
                            kind: "textBlock",
                            type: "P",
                            children: [{ kind: "text", text: "bar" }],
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
        selection: {
          anchor: { path: [0, 0, 1, 0, 0, 0], offset: 3 },
          focus: { path: [0, 0, 1, 0, 0, 0], offset: 3 },
        },
      });
    });

    test("list with multiple items", () => {
      expect(parse("UL:\n  LI: a\n  LI: b\n  LI: c|")).toEqual({
        blocks: [
          {
            kind: "containerBlock",
            type: "UL",
            children: [
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "a" }],
              },
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "b" }],
              },
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "c" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 2, 0], offset: 1 },
          focus: { path: [0, 2, 0], offset: 1 },
        },
      });
    });
  });

  describe("escape sequences", () => {
    test("escaped brackets", () => {
      expect(parse("P: \\[not a mark\\]|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "[not a mark]" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 12 },
          focus: { path: [0, 0], offset: 12 },
        },
      });
    });

    test("escaped braces", () => {
      expect(parse("P: \\{not an object\\}|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "{not an object}" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 15 },
          focus: { path: [0, 0], offset: 15 },
        },
      });
    });

    test("escaped selection markers", () => {
      expect(parse("P: \\|pipe\\^caret|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "|pipe^caret" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 11 },
          focus: { path: [0, 0], offset: 11 },
        },
      });
    });

    test("escaped backslash", () => {
      expect(parse("P: back\\\\slash|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "back\\slash" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 10 },
          focus: { path: [0, 0], offset: 10 },
        },
      });
    });

    test("tab escape", () => {
      expect(parse("P: col1\\tcol2|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "col1\tcol2" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 9 },
          focus: { path: [0, 0], offset: 9 },
        },
      });
    });

    test("newline escape", () => {
      expect(parse("P: line1\\nline2|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "line1\nline2" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 11 },
          focus: { path: [0, 0], offset: 11 },
        },
      });
    });
  });

  describe("raw blocks", () => {
    test("empty code block", () => {
      expect(parse("CODE!:\nP: after|")).toEqual({
        blocks: [
          { kind: "rawBlock", type: "CODE", lines: [] },
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "after" }],
          },
        ],
        selection: {
          anchor: { path: [1, 0], offset: 5 },
          focus: { path: [1, 0], offset: 5 },
        },
      });
    });

    test("literal brackets in code", () => {
      expect(parse("CODE!:\n  const arr = [1, 2, 3]|")).toEqual({
        blocks: [
          { kind: "rawBlock", type: "CODE", lines: ["const arr = [1, 2, 3]"] },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 21 },
          focus: { path: [0, 0], offset: 21 },
        },
      });
    });

    test("literal braces in code", () => {
      expect(parse("CODE!:\n  const obj = { a: 1 }|")).toEqual({
        blocks: [
          { kind: "rawBlock", type: "CODE", lines: ["const obj = { a: 1 }"] },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 20 },
          focus: { path: [0, 0], offset: 20 },
        },
      });
    });

    test("escaped pipe in code", () => {
      expect(parse("CODE!:\n  a \\| b|")).toEqual({
        blocks: [{ kind: "rawBlock", type: "CODE", lines: ["a | b"] }],
        selection: {
          anchor: { path: [0, 0], offset: 5 },
          focus: { path: [0, 0], offset: 5 },
        },
      });
    });

    test("escaped caret in code", () => {
      expect(parse("CODE!:\n  x\\^2|")).toEqual({
        blocks: [{ kind: "rawBlock", type: "CODE", lines: ["x^2"] }],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("math block", () => {
      expect(parse("MATH!:\n  E = mc\\^2|")).toEqual({
        blocks: [{ kind: "rawBlock", type: "MATH", lines: ["E = mc^2"] }],
        selection: {
          anchor: { path: [0, 0], offset: 8 },
          focus: { path: [0, 0], offset: 8 },
        },
      });
    });
  });

  describe("block objects", () => {
    test("no attributes", () => {
      expect(parse("{HR}|")).toEqual({
        blocks: [{ kind: "blockObject", type: "HR", attrs: {} }],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      });
    });

    test("multiple attributes", () => {
      expect(parse('{IMAGE src="foo.jpg" alt="bar" width=100}|')).toEqual({
        blocks: [
          {
            kind: "blockObject",
            type: "IMAGE",
            attrs: { src: "foo.jpg", alt: "bar", width: 100 },
          },
        ],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      });
    });

    test("selection spanning blocks", () => {
      expect(parse("P: ^foo\n{HR}|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
          { kind: "blockObject", type: "HR", attrs: {} },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [1], offset: 1 },
        },
      });
    });
  });

  describe("inline objects", () => {
    test("at start", () => {
      expect(parse("P: {emoji} foo|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "inlineObject", type: "emoji", attrs: {} },
              { kind: "text", text: " foo" },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 4 },
          focus: { path: [0, 1], offset: 4 },
        },
      });
    });

    test("at end", () => {
      expect(parse("P: foo {emoji}|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "text", text: "foo " },
              { kind: "inlineObject", type: "emoji", attrs: {} },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 2], offset: 0 },
          focus: { path: [0, 2], offset: 0 },
        },
      });
    });

    test("complex attributes", () => {
      expect(parse('P: {mention id="u1" name="Alice" active=true}|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "inlineObject",
                type: "mention",
                attrs: { id: "u1", name: "Alice", active: true },
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });
  });

  describe("marks", () => {
    test("empty content", () => {
      expect(parse("P: [strong:|]")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "mark", type: "strong", mode: "decorator", children: [] },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 0, 0], offset: 0 },
          focus: { path: [0, 0, 0], offset: 0 },
        },
      });
    });

    test("nested mark in content", () => {
      expect(parse("P: [strong:foo [em:bar] baz]|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [
                  { kind: "text", text: "foo " },
                  {
                    kind: "mark",
                    type: "em",
                    mode: "decorator",
                    children: [{ kind: "text", text: "bar" }],
                  },
                  { kind: "text", text: " baz" },
                ],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("mark with inline object", () => {
      expect(parse("P: [strong:foo {emoji} bar]|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [
                  { kind: "text", text: "foo " },
                  { kind: "inlineObject", type: "emoji", attrs: {} },
                  { kind: "text", text: " bar" },
                ],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("annotation mode", () => {
      expect(parse('P: [@link href="url":text]|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "link",
                mode: "annotation",
                attrs: { href: "url" },
                children: [{ kind: "text", text: "text" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("overlay mode", () => {
      expect(parse('P: [~highlight id="h1":text]|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "highlight",
                mode: "overlay",
                attrs: { id: "h1" },
                children: [{ kind: "text", text: "text" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });
  });

  describe("line endings", () => {
    test("CRLF", () => {
      expect(parse("P: foo|\r\nP: bar")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "bar" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("LF", () => {
      expect(parse("P: foo|\nP: bar")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "bar" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });
  });

  describe("attribute edge cases", () => {
    test("escaped quotes in string", () => {
      expect(parse('P: {div title="He said \\"hello\\""}|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "inlineObject",
                type: "div",
                attrs: { title: 'He said "hello"' },
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("unicode in string", () => {
      expect(parse('P: {div title="你好"}|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "inlineObject", type: "div", attrs: { title: "你好" } },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("newline escape in string", () => {
      expect(parse('P: {div text="line1\\nline2"}|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "inlineObject",
                type: "div",
                attrs: { text: "line1\nline2" },
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("boolean false", () => {
      expect(parse("P: {input disabled=false}|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "inlineObject",
                type: "input",
                attrs: { disabled: false },
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });
  });
});
