import { compileSchema, defineSchema } from "@portabletext/schema";
import { describe, expect, test } from "vitest";
import { pteToTextspec } from "./pte-to-textspec";
import type { EditorSelection } from "./types";

const schema = compileSchema(
  defineSchema({
    decorators: [{ name: "strong" }, { name: "em" }, { name: "underline" }],
    annotations: [{ name: "link" }],
    styles: [
      { name: "normal" },
      { name: "h1" },
      { name: "h2" },
      { name: "h3" },
      { name: "blockquote" },
    ],
    lists: [{ name: "bullet" }, { name: "number" }],
    inlineObjects: [{ name: "emoji" }],
    blockObjects: [{ name: "image" }],
  }),
);

describe("pteToTextspec", () => {
  test("plain text with cursor", () => {
    const result = pteToTextspec(
      { schema },
      [
        {
          _type: "block",
          _key: "b0",
          style: "normal",
          markDefs: [],
          children: [{ _type: "span", _key: "s0", text: "foo", marks: [] }],
        },
      ],
      {
        anchor: {
          path: [{ _key: "b0" }, "children", { _key: "s0" }],
          offset: 3,
        },
        focus: {
          path: [{ _key: "b0" }, "children", { _key: "s0" }],
          offset: 3,
        },
      },
    );

    expect(result).toBe("P: foo|");
  });

  test("empty text with cursor", () => {
    const result = pteToTextspec(
      { schema },
      [
        {
          _type: "block",
          _key: "b0",
          style: "normal",
          markDefs: [],
          children: [{ _type: "span", _key: "s0", text: "", marks: [] }],
        },
      ],
      {
        anchor: {
          path: [{ _key: "b0" }, "children", { _key: "s0" }],
          offset: 0,
        },
        focus: {
          path: [{ _key: "b0" }, "children", { _key: "s0" }],
          offset: 0,
        },
      },
    );

    expect(result).toBe("P: |");
  });

  test("styled blocks", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "h1",
        markDefs: [],
        children: [{ _type: "span", _key: "s0", text: "title", marks: [] }],
      },
    ]);

    expect(result).toBe("H1: title");
  });

  test("blockquote", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "blockquote",
        markDefs: [],
        children: [{ _type: "span", _key: "s0", text: "quoted", marks: [] }],
      },
    ]);

    expect(result).toBe("BLOCKQUOTE: quoted");
  });

  test("decorator marks", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "normal",
        markDefs: [],
        children: [
          { _type: "span", _key: "s0", text: "foo ", marks: [] },
          { _type: "span", _key: "s1", text: "bar", marks: ["strong"] },
          { _type: "span", _key: "s2", text: " baz", marks: [] },
        ],
      },
    ]);

    expect(result).toBe("P: foo [strong:bar] baz");
  });

  test("nested marks", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "normal",
        markDefs: [],
        children: [
          {
            _type: "span",
            _key: "s0",
            text: "bar",
            marks: ["strong", "em"],
          },
        ],
      },
    ]);

    expect(result).toBe("P: [em:[strong:bar]]");
  });

  test("annotation", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "normal",
        markDefs: [{ _key: "mk0", _type: "link", href: "https://example.com" }],
        children: [
          {
            _type: "span",
            _key: "s0",
            text: "click here",
            marks: ["mk0"],
          },
        ],
      },
    ]);

    expect(result).toBe('P: [@link href="https://example.com":click here]');
  });

  test("inline object", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "normal",
        markDefs: [],
        children: [
          { _type: "span", _key: "s0", text: "foo ", marks: [] },
          { _type: "emoji", _key: "s1", value: "😄" },
          { _type: "span", _key: "s2", text: " bar", marks: [] },
        ],
      },
    ]);

    expect(result).toBe('P: foo {emoji value="😄"} bar');
  });

  test("block object", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "image",
        _key: "b0",
        src: "photo.jpg",
      },
    ]);

    expect(result).toBe('{IMAGE src="photo.jpg"}');
  });

  test("list items", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "normal",
        markDefs: [],
        listItem: "bullet",
        level: 1,
        children: [
          { _type: "span", _key: "s0", text: "First item", marks: [] },
        ],
      },
    ]);

    expect(result).toBe('P level=1 listItem="bullet": First item');
  });

  test("multiple blocks", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "h1",
        markDefs: [],
        children: [{ _type: "span", _key: "s0", text: "title", marks: [] }],
      },
      {
        _type: "block",
        _key: "b1",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: "s1", text: "content", marks: [] }],
      },
    ]);

    expect(result).toBe("H1: title\nP: content");
  });

  test("range selection", () => {
    const selection: EditorSelection = {
      anchor: { path: [{ _key: "b0" }, "children", { _key: "s0" }], offset: 0 },
      focus: { path: [{ _key: "b0" }, "children", { _key: "s0" }], offset: 3 },
    };

    const result = pteToTextspec(
      { schema },
      [
        {
          _type: "block",
          _key: "b0",
          style: "normal",
          markDefs: [],
          children: [{ _type: "span", _key: "s0", text: "foo", marks: [] }],
        },
      ],
      selection,
    );

    expect(result).toBe("P: ^foo|");
  });

  test("backward selection", () => {
    const selection: EditorSelection = {
      anchor: { path: [{ _key: "b0" }, "children", { _key: "s0" }], offset: 3 },
      focus: { path: [{ _key: "b0" }, "children", { _key: "s0" }], offset: 0 },
    };

    const result = pteToTextspec(
      { schema },
      [
        {
          _type: "block",
          _key: "b0",
          style: "normal",
          markDefs: [],
          children: [{ _type: "span", _key: "s0", text: "foo", marks: [] }],
        },
      ],
      selection,
    );

    expect(result).toBe("P: |foo^");
  });

  test("no selection", () => {
    const result = pteToTextspec({ schema }, [
      {
        _type: "block",
        _key: "b0",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: "s0", text: "foo", marks: [] }],
      },
    ]);

    expect(result).toBe("P: foo");
  });
});
