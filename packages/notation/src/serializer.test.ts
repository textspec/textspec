import { describe, expect, test } from "vitest";
import { serialize } from "./serializer";
import type { EditorState } from "./types";

describe(serialize.name, () => {
  describe("text blocks", () => {
    test("simple paragraph", () => {
      const state: EditorState = {
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
      };
      expect(serialize(state)).toBe("P: foo|");
    });

    test("multiple blocks", () => {
      const state: EditorState = {
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
          anchor: { path: [1, 0], offset: 3 },
          focus: { path: [1, 0], offset: 3 },
        },
      };
      expect(serialize(state)).toBe("P: foo\nP: bar|");
    });
  });

  describe("marks", () => {
    test("decorator mark", () => {
      const state: EditorState = {
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
          anchor: { path: [0, 0, 0], offset: 3 },
          focus: { path: [0, 0, 0], offset: 3 },
        },
      };
      expect(serialize(state)).toBe("P: [strong:foo|]");
    });

    test("annotation mark", () => {
      const state: EditorState = {
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
          anchor: { path: [0, 0, 0], offset: 3 },
          focus: { path: [0, 0, 0], offset: 3 },
        },
      };
      expect(serialize(state)).toBe(
        'P: [@link href="https://example.com":foo|]',
      );
    });

    test("overlay mark", () => {
      const state: EditorState = {
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
          anchor: { path: [0, 0, 0], offset: 3 },
          focus: { path: [0, 0, 0], offset: 3 },
        },
      };
      expect(serialize(state)).toBe('P: [~highlight id="c1":foo|]');
    });
  });

  describe("inline objects", () => {
    test("with attributes", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [
              { kind: "text", text: "foo " },
              { kind: "inlineObject", type: "emoji", attrs: { value: "😄" } },
              { kind: "text", text: " bar" },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 2], offset: 4 },
          focus: { path: [0, 2], offset: 4 },
        },
      };
      expect(serialize(state)).toBe('P: foo {emoji value="😄"} bar|');
    });
  });

  describe("containers", () => {
    test("with indentation", () => {
      const state: EditorState = {
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
      };
      expect(serialize(state)).toBe("UL:\n  LI: foo|");
    });
  });

  describe("block objects", () => {
    test("with attributes", () => {
      const state: EditorState = {
        blocks: [
          { kind: "blockObject", type: "IMAGE", attrs: { src: "foo.jpg" } },
        ],
        selection: {
          anchor: { path: [0], offset: 0 },
          focus: { path: [0], offset: 1 },
        },
      };
      expect(serialize(state)).toBe('^{IMAGE src="foo.jpg"}|');
    });
  });

  describe("attributes", () => {
    test("sorted alphabetically", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "blockObject",
            type: "IMG",
            attrs: { src: "a", alt: "b", width: 100 },
          },
        ],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      };
      expect(serialize(state)).toBe('{IMG alt="b" src="a" width=100}|');
    });

    test("escaped quotes in string", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "blockObject",
            type: "DIV",
            attrs: { text: 'He said "hello"' },
          },
        ],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      };
      expect(serialize(state)).toBe('{DIV text="He said \\"hello\\""}|');
    });

    test("boolean attributes", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "blockObject",
            type: "INPUT",
            attrs: { disabled: true, readonly: false },
          },
        ],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      };
      expect(serialize(state)).toBe("{INPUT disabled=true readonly=false}|");
    });

    test("number attributes", () => {
      const state: EditorState = {
        blocks: [{ kind: "blockObject", type: "IMG", attrs: { width: 100 } }],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      };
      expect(serialize(state)).toBe("{IMG width=100}|");
    });

    test("JSON object attribute", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "blockObject",
            type: "NODE",
            attrs: { data: { key: "value" } },
          },
        ],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      };
      expect(serialize(state)).toBe('{NODE data={"key":"value"}}|');
    });

    test("JSON array attribute", () => {
      const state: EditorState = {
        blocks: [
          { kind: "blockObject", type: "NODE", attrs: { tags: ["a", "b"] } },
        ],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      };
      expect(serialize(state)).toBe('{NODE tags=["a","b"]}|');
    });

    test("null attribute", () => {
      const state: EditorState = {
        blocks: [{ kind: "blockObject", type: "NODE", attrs: { value: null } }],
        selection: {
          anchor: { path: [0], offset: 1 },
          focus: { path: [0], offset: 1 },
        },
      };
      expect(serialize(state)).toBe("{NODE value=null}|");
    });
  });

  describe("escaping", () => {
    test("brackets in text", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "[foo]" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 5 },
          focus: { path: [0, 0], offset: 5 },
        },
      };
      expect(serialize(state)).toBe("P: \\[foo\\]|");
    });

    test("braces in text", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "{foo}" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 5 },
          focus: { path: [0, 0], offset: 5 },
        },
      };
      expect(serialize(state)).toBe("P: \\{foo\\}|");
    });

    test("pipe and caret in text", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "textBlock",
            type: "P",
            children: [{ kind: "text", text: "a|b^c" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 5 },
          focus: { path: [0, 0], offset: 5 },
        },
      };
      expect(serialize(state)).toBe("P: a\\|b\\^c|");
    });

    test("semicolons in text", () => {
      const state: EditorState = {
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
      };
      expect(serialize(state)).toBe("P: foo\\;\\;bar|");
    });
  });

  describe("single-line format", () => {
    test("multiple blocks with ;; separator", () => {
      const state: EditorState = {
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
      };
      expect(serialize(state, { singleLine: true })).toBe("P: foo|;;H1: bar");
    });

    test("container with inline children", () => {
      const state: EditorState = {
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
      };
      expect(serialize(state, { singleLine: true })).toBe(
        "UL:{LI: foo;;LI: bar|}",
      );
    });

    test("nested containers", () => {
      const state: EditorState = {
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
                ],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 0, 0, 0], offset: 3 },
          focus: { path: [0, 0, 0, 0], offset: 3 },
        },
      };
      expect(serialize(state, { singleLine: true })).toBe("UL:{LI:{P: foo|}}");
    });

    test("multiline is default", () => {
      const state: EditorState = {
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
          anchor: { path: [1, 0], offset: 3 },
          focus: { path: [1, 0], offset: 3 },
        },
      };
      expect(serialize(state)).toBe("P: foo\nP: bar|");
    });
  });

  describe("block attributes", () => {
    test("text block with attribute", () => {
      const state: EditorState = {
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
      };
      expect(serialize(state)).toBe('P align="center": foo|');
    });

    test("text block with multiple attributes", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "textBlock",
            type: "H1",
            attrs: { id: "intro", class: "main" },
            children: [{ kind: "text", text: "title" }],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 5 },
          focus: { path: [0, 0], offset: 5 },
        },
      };
      expect(serialize(state)).toBe('H1 class="main" id="intro": title|');
    });

    test("container with attribute", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "containerBlock",
            type: "OL",
            attrs: { start: 5 },
            children: [
              {
                kind: "textBlock",
                type: "LI",
                children: [{ kind: "text", text: "item" }],
              },
            ],
          },
        ],
        selection: {
          anchor: { path: [0, 0, 0], offset: 4 },
          focus: { path: [0, 0, 0], offset: 4 },
        },
      };
      expect(serialize(state)).toBe("OL start=5:\n  LI: item|");
    });

    test("code block with attribute", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "rawBlock",
            type: "CODE",
            attrs: { lang: "typescript" },
            lines: ["const x = 1"],
          },
        ],
        selection: {
          anchor: { path: [0, 0], offset: 11 },
          focus: { path: [0, 0], offset: 11 },
        },
      };
      expect(serialize(state)).toBe('CODE! lang="typescript":\n  const x = 1|');
    });

    test("single-line container with attribute", () => {
      const state: EditorState = {
        blocks: [
          {
            kind: "containerBlock",
            type: "UL",
            attrs: { style: "disc" },
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
      };
      expect(serialize(state, { singleLine: true })).toBe(
        'UL style="disc":{LI: foo|}',
      );
    });

    test("text block without attrs", () => {
      const state: EditorState = {
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
      };
      expect(serialize(state)).toBe("P: foo|");
    });
  });
});
