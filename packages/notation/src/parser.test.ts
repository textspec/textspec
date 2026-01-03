import { describe, expect, test } from "vitest";
import { ParseError } from "./errors";
import { parse } from "./parser";

describe(parse.name, () => {
  describe("text blocks", () => {
    test("simple paragraph", () => {
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

    test("paragraph with spaces", () => {
      expect(parse("P: foo bar|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo bar" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 7 },
          focus: { path: [0, 0], offset: 7 },
        },
      });
    });

    test("multiple blocks", () => {
      expect(parse("P: foo|;;P: bar")).toEqual({
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

    test("heading type", () => {
      expect(parse("H1: foo|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "H1",
            children: [{ kind: "text", text: "foo" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });
  });

  describe("selection", () => {
    test("collapsed caret", () => {
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

    test("forward range", () => {
      expect(parse("P: ^foo|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("backward range", () => {
      expect(parse("P: |foo^")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 0 },
        },
      });
    });

    test("no selection", () => {
      expect(parse("P: foo")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
        ],
        selection: null,
      });
    });

    test("multiple focus markers throws", () => {
      expect(() => parse("P: foo|bar|")).toThrow(ParseError);
    });

    test("multiple anchor markers throws", () => {
      expect(() => parse("P: ^foo^bar|")).toThrow(ParseError);
    });
  });

  describe("marks", () => {
    test("decorator mark", () => {
      expect(parse("P: [strong:foo]|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "strong",
                mode: "decorator",
                children: [{ kind: "text", text: "foo" }],
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

    test("annotation mark", () => {
      expect(parse('P: [@link href="https://example.com":foo]|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "link",
                mode: "annotation",
                attrs: { href: "https://example.com" },
                children: [{ kind: "text", text: "foo" }],
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

    test("overlay mark", () => {
      expect(parse('P: [~highlight id="c1":foo]|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "mark",
                type: "highlight",
                mode: "overlay",
                attrs: { id: "c1" },
                children: [{ kind: "text", text: "foo" }],
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

    test("nested marks", () => {
      expect(parse("P: [strong:[em:foo]]|")).toEqual({
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
                    children: [{ kind: "text", text: "foo" }],
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
  });

  describe("inline objects", () => {
    test("inline object with text", () => {
      expect(parse('P: foo {emoji value="x"} bar|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "text", text: "foo " },
              { kind: "inlineObject", type: "emoji", attrs: { value: "x" } },
              { kind: "text", text: " bar" },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 2], offset: 4 },
          focus: { path: [0, 2], offset: 4 },
        },
      });
    });

    test("selection around inline object", () => {
      expect(parse('P: ^{emoji value="x"}|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "inlineObject", type: "emoji", attrs: { value: "x" } },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });
  });

  describe("containers", () => {
    test("simple list", () => {
      expect(parse("UL:\n  LI: foo|")).toEqual({
        blocks: [
          {
            kind: "containerBlock",
            type: "UL",
            children: [
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "foo" }],
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

    test("list with multiple items", () => {
      expect(parse("UL:\n  LI: foo\n  LI: bar|")).toEqual({
        blocks: [
          {
            kind: "containerBlock",
            type: "UL",
            children: [
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "foo" }],
              },
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "bar" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1, 0], offset: 3 },
          focus: { path: [0, 1, 0], offset: 3 },
        },
      });
    });

    test("inline container syntax", () => {
      expect(parse("UL:{LI: foo;;LI: bar|}")).toEqual({
        blocks: [
          {
            kind: "containerBlock",
            type: "UL",
            children: [
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "foo" }],
              },
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "bar" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1, 0], offset: 3 },
          focus: { path: [0, 1, 0], offset: 3 },
        },
      });
    });

    test("empty container throws", () => {
      expect(() => parse("UL:|")).toThrow(ParseError);
    });
  });

  describe("raw blocks", () => {
    test("code block", () => {
      expect(parse("CODE!:\n  foo|")).toEqual({
        blocks: [{ kind: "rawBlock", type: "CODE", lines: ["foo"] }],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("code block with literal brackets", () => {
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

    test("code block with attributes", () => {
      expect(parse('CODE! lang="ts":\n  const x = 1|')).toEqual({
        blocks: [
          {
            kind: "rawBlock",
            type: "CODE",
            attrs: { lang: "ts" },
            lines: ["const x = 1"],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 11 },
          focus: { path: [0, 0], offset: 11 },
        },
      });
    });
  });

  describe("block objects", () => {
    test("image block", () => {
      expect(parse('{IMAGE src="foo.jpg"}|')).toEqual({
        blocks: [
          { kind: "blockObject", type: "IMAGE", attrs: { src: "foo.jpg" } },
        ],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      });
    });

    test("selection around block object", () => {
      expect(parse('^{IMAGE src="foo.jpg"}|')).toEqual({
        blocks: [
          { kind: "blockObject", type: "IMAGE", attrs: { src: "foo.jpg" } },
        ],
        selection: {
          anchor: { path: [0], offset: 0 },
          focus: { path: [0], offset: 1 },
        },
      });
    });
  });

  describe("attributes", () => {
    test("string attribute", () => {
      expect(parse('P: {img src="foo.jpg"}|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "inlineObject", type: "img", attrs: { src: "foo.jpg" } },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("number attribute", () => {
      expect(parse("P: {img width=100}|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "inlineObject", type: "img", attrs: { width: 100 } },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 1], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      });
    });

    test("boolean attribute", () => {
      expect(parse("P: {input disabled=true}|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "inlineObject",
                type: "input",
                attrs: { disabled: true },
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

    test("JSON object attribute", () => {
      expect(parse('P: {node data={"key": "value"}}|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "inlineObject",
                type: "node",
                attrs: { data: { key: "value" } },
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

    test("JSON array attribute", () => {
      expect(parse('P: {node tags=["a", "b"]}|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              {
                kind: "inlineObject",
                type: "node",
                attrs: { tags: ["a", "b"] },
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

    test("block attribute", () => {
      expect(parse('P align="center": foo|')).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            attrs: { align: "center" },
            children: [{ kind: "text", text: "foo" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });
  });

  describe("single-line format", () => {
    test("blocks separated by ;;", () => {
      expect(parse("P: foo|;;H1: bar")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
          {
            kind: "textBlock",
            type: "H1",
            children: [{ kind: "text", text: "bar" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 3 },
          focus: { path: [0, 0], offset: 3 },
        },
      });
    });

    test("selection across ;; blocks", () => {
      expect(parse("P: ^foo;;H1: bar|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo" }],
          },
          {
            kind: "textBlock",
            type: "H1",
            children: [{ kind: "text", text: "bar" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [1, 0], offset: 3 },
        },
      });
    });

    test("escaped semicolons", () => {
      expect(parse("P: foo\\;\\;bar|")).toEqual({
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "foo;;bar" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 8 },
          focus: { path: [0, 0], offset: 8 },
        },
      });
    });
  });

  describe("error cases", () => {
    test("empty document throws", () => {
      expect(() => parse("")).toThrow(ParseError);
    });

    test("unbalanced bracket throws", () => {
      expect(() => parse("P: [strong:foo|")).toThrow(ParseError);
    });

    test("unbalanced brace throws", () => {
      expect(() => parse("P: {emoji|")).toThrow(ParseError);
    });

    test("missing space after colon throws", () => {
      expect(() => parse("P:foo|")).toThrow(ParseError);
    });
  });
});
