import { compileSchema, defineSchema } from "@portabletext/schema";
import { describe, expect, test } from "vitest";
import { textspecToPte } from "./textspec-to-pte";

function createKeyGenerator() {
  let counter = 0;
  return () => `k${counter++}`;
}

const schema = compileSchema(
  defineSchema({
    decorators: [{ name: "strong" }, { name: "em" }, { name: "underline" }],
    annotations: [{ name: "link" }],
    styles: [
      { name: "normal" },
      { name: "h1" },
      { name: "h2" },
      { name: "h3" },
      { name: "h4" },
      { name: "h5" },
      { name: "h6" },
      { name: "blockquote" },
    ],
    lists: [{ name: "bullet" }, { name: "number" }],
    inlineObjects: [{ name: "emoji" }],
    blockObjects: [{ name: "image" }],
  }),
);

function parse(notation: string) {
  return textspecToPte(
    { keyGenerator: createKeyGenerator(), schema },
    notation,
  );
}

describe("textspecToPte", () => {
  test("plain text", () => {
    const { value, selection } = parse("P: foo|");

    expect(value).toEqual([
      {
        _type: "block",
        _key: "k0",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: "k1", text: "foo", marks: [] }],
      },
    ]);
    expect(selection).toEqual({
      anchor: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 3 },
      focus: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 3 },
    });
  });

  test("empty text with cursor", () => {
    const { value, selection } = parse("P: |");

    expect(value).toEqual([
      {
        _type: "block",
        _key: "k0",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: "k1", text: "", marks: [] }],
      },
    ]);
    expect(selection).toEqual({
      anchor: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 0 },
      focus: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 0 },
    });
  });

  test("styled blocks", () => {
    const { value } = parse("H1: title");

    expect(value[0]).toMatchObject({
      _type: "block",
      style: "h1",
    });
  });

  test("blockquote", () => {
    const { value } = parse("BLOCKQUOTE: quoted text");

    expect(value[0]).toMatchObject({
      _type: "block",
      style: "blockquote",
    });
  });

  test("decorator marks", () => {
    const { value } = parse("P: foo [strong:bar] baz");

    expect(value).toEqual([
      {
        _type: "block",
        _key: "k0",
        style: "normal",
        markDefs: [],
        children: [
          { _type: "span", _key: "k1", text: "foo ", marks: [] },
          { _type: "span", _key: "k2", text: "bar", marks: ["strong"] },
          { _type: "span", _key: "k3", text: " baz", marks: [] },
        ],
      },
    ]);
  });

  test("nested marks", () => {
    const { value } = parse("P: [strong:[em:bar]]");

    expect(value).toEqual([
      {
        _type: "block",
        _key: "k0",
        style: "normal",
        markDefs: [],
        children: [
          {
            _type: "span",
            _key: "k1",
            text: "bar",
            marks: ["strong", "em"],
          },
        ],
      },
    ]);
  });

  test("annotation", () => {
    const { value } = parse('P: [@link href="https://example.com":click here]');

    expect(value).toEqual([
      {
        _type: "block",
        _key: "k0",
        style: "normal",
        markDefs: [{ _key: "k1", _type: "link", href: "https://example.com" }],
        children: [
          { _type: "span", _key: "k2", text: "click here", marks: ["k1"] },
        ],
      },
    ]);
  });

  test("inline object", () => {
    const { value } = parse('P: foo {emoji value="😄"} bar');

    expect(value).toEqual([
      {
        _type: "block",
        _key: "k0",
        style: "normal",
        markDefs: [],
        children: [
          { _type: "span", _key: "k1", text: "foo ", marks: [] },
          { _type: "emoji", _key: "k2", value: "😄" },
          { _type: "span", _key: "k3", text: " bar", marks: [] },
        ],
      },
    ]);
  });

  test("block object", () => {
    const { value } = parse('{IMAGE src="photo.jpg"}');

    expect(value).toEqual([
      {
        _type: "image",
        _key: "k0",
        src: "photo.jpg",
      },
    ]);
  });

  test("list items", () => {
    const { value } = parse('P listItem="bullet" level=1: First item');

    expect(value).toEqual([
      {
        _type: "block",
        _key: "k0",
        style: "normal",
        markDefs: [],
        listItem: "bullet",
        level: 1,
        children: [
          { _type: "span", _key: "k1", text: "First item", marks: [] },
        ],
      },
    ]);
  });

  test("multiple blocks", () => {
    const { value } = parse("H1: title\nP: content|");

    expect(value).toHaveLength(2);
    expect(value[0]).toMatchObject({ style: "h1" });
    expect(value[1]).toMatchObject({ style: "normal" });
  });

  test("collapsed selection", () => {
    const { selection } = parse("P: foo|");

    expect(selection).toEqual({
      anchor: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 3 },
      focus: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 3 },
    });
  });

  test("range selection", () => {
    const { selection } = parse("P: ^foo|");

    expect(selection).toEqual({
      anchor: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 0 },
      focus: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 3 },
    });
  });

  test("backward selection", () => {
    const { selection } = parse("P: |foo^");

    expect(selection).toEqual({
      anchor: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 3 },
      focus: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 0 },
    });
  });

  test("cross-block selection", () => {
    const { selection } = parse("P: ^foo\nP: bar|");

    expect(selection).toEqual({
      anchor: { path: [{ _key: "k0" }, "children", { _key: "k1" }], offset: 0 },
      focus: { path: [{ _key: "k2" }, "children", { _key: "k3" }], offset: 3 },
    });
  });

  test("no selection", () => {
    const { selection } = parse("P: foo");

    expect(selection).toBeNull();
  });
});
