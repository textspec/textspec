import { describe, expect, test } from "vitest";
import { getPointAfter, getPointBefore, getRange } from "./matcher";
import { parse } from "./parser";

describe(getRange.name, () => {
  describe("plain text", () => {
    test("mid block", () => {
      expect(getRange(parse("P: hello world"), "world")).toEqual({
        anchor: { path: [0, 0], offset: 6 },
        focus: { path: [0, 0], offset: 11 },
      });
    });

    test("start of block", () => {
      expect(getRange(parse("P: hello world"), "hello")).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 5 },
      });
    });

    test("inside mark", () => {
      expect(getRange(parse("P: foo [strong:bar] baz"), "bar")).toEqual({
        anchor: { path: [0, 1, 0], offset: 0 },
        focus: { path: [0, 1, 0], offset: 3 },
      });
    });

    test("first match wins", () => {
      expect(getRange(parse("P: foo bar foo"), "foo")).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 3 },
      });
    });

    test("no match", () => {
      expect(getRange(parse("P: hello"), "world")).toEqual(null);
    });

    test("single character", () => {
      expect(getRange(parse("P: abc"), "b")).toEqual({
        anchor: { path: [0, 0], offset: 1 },
        focus: { path: [0, 0], offset: 2 },
      });
    });
  });

  describe("mark structure", () => {
    test("positions outside mark", () => {
      expect(
        getRange(parse("P: foo [strong:bar] baz"), "[strong:bar]"),
      ).toEqual({
        anchor: { path: [0, 0], offset: 4 },
        focus: { path: [0, 2], offset: 0 },
      });
    });

    test("decorator mark", () => {
      expect(getRange(parse("P: [em:text]"), "[em:text]")).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 1], offset: 0 },
      });
    });

    test("annotation mark", () => {
      expect(
        getRange(parse('P: [@link href="x":text]'), "[@link:text]"),
      ).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 1], offset: 0 },
      });
    });

    test("overlay mark", () => {
      expect(
        getRange(parse('P: [~comment id="1":text]'), "[~comment:text]"),
      ).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 1], offset: 0 },
      });
    });

    test("nested mark", () => {
      expect(getRange(parse("P: [strong:[em:bar]]"), "[em:bar]")).toEqual({
        anchor: { path: [0, 0, 0], offset: 0 },
        focus: { path: [0, 0, 1], offset: 0 },
      });
    });

    test("outer mark with nested content", () => {
      expect(
        getRange(parse("P: [strong:[em:bar]]"), "[strong:[em:bar]]"),
      ).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 1], offset: 0 },
      });
    });
  });

  describe("partial content", () => {
    test("matches prefix", () => {
      expect(
        getRange(parse('P: foo [@link href="x":bar baz] qux'), "[@link:bar]"),
      ).toEqual({
        anchor: { path: [0, 0], offset: 4 },
        focus: { path: [0, 2], offset: 0 },
      });
    });

    test("non-prefix returns null", () => {
      expect(getRange(parse("P: [strong:abc]"), "[strong:xyz]")).toEqual(null);
    });
  });

  describe("attributes", () => {
    test("exact match", () => {
      expect(
        getRange(parse('P: [@link href="a":foo]'), '[@link href="a":foo]'),
      ).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 1], offset: 0 },
      });
    });

    test("wrong value returns null", () => {
      expect(
        getRange(parse('P: [@link href="a":foo]'), '[@link href="b":foo]'),
      ).toEqual(null);
    });

    test("omitted attrs match any", () => {
      expect(getRange(parse('P: [@link href="a":foo]'), "[@link:foo]")).toEqual(
        {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [0, 1], offset: 0 },
        },
      );
    });

    test("subset of attrs", () => {
      expect(
        getRange(
          parse('P: [@link href="a" target="_blank":foo]'),
          '[@link href="a":foo]',
        ),
      ).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 1], offset: 0 },
      });
    });
  });

  describe("inline objects", () => {
    test("finds object", () => {
      expect(
        getRange(parse('P: foo {emoji value="x"} bar'), '{emoji value="x"}'),
      ).toEqual({
        anchor: { path: [0, 1], offset: 0 },
        focus: { path: [0, 1], offset: 1 },
      });
    });

    test("wrong attrs returns null", () => {
      expect(
        getRange(parse('P: {emoji value="a"}'), '{emoji value="b"}'),
      ).toEqual(null);
    });
  });

  describe("multiple blocks", () => {
    test("in second block", () => {
      expect(getRange(parse("P: first;;P: second"), "second")).toEqual({
        anchor: { path: [1, 0], offset: 0 },
        focus: { path: [1, 0], offset: 6 },
      });
    });

    test("mid block to mid block", () => {
      expect(
        getRange(parse("P: hello foo;;P: bar world"), "foo;;P: bar"),
      ).toEqual({
        anchor: { path: [0, 0], offset: 6 },
        focus: { path: [1, 0], offset: 3 },
      });
    });

    test("spanning three blocks", () => {
      expect(
        getRange(
          parse("P: start;;P: middle;;P: end"),
          "P: start;;P: middle;;P: end",
        ),
      ).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [2, 0], offset: 3 },
      });
    });

    test("prefers single block match", () => {
      expect(getRange(parse("P: foo bar;;P: foo bar baz"), "foo bar")).toEqual({
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 7 },
      });
    });
  });

  describe("edge cases", () => {
    test("empty pattern returns null", () => {
      expect(getRange(parse("P: foo"), "P: ")).toEqual(null);
    });
  });
});

describe(getPointBefore.name, () => {
  test("returns anchor of match", () => {
    expect(getPointBefore(parse("P: hello world"), "world")).toEqual({
      path: [0, 0],
      offset: 6,
    });
  });

  test("returns null when no match", () => {
    expect(getPointBefore(parse("P: hello"), "world")).toEqual(null);
  });

  test("works with mark structure", () => {
    expect(
      getPointBefore(parse("P: foo [strong:bar] baz"), "[strong:bar]"),
    ).toEqual({
      path: [0, 0],
      offset: 4,
    });
  });
});

describe(getPointAfter.name, () => {
  test("returns focus of match", () => {
    expect(getPointAfter(parse("P: hello world"), "world")).toEqual({
      path: [0, 0],
      offset: 11,
    });
  });

  test("returns null when no match", () => {
    expect(getPointAfter(parse("P: hello"), "world")).toEqual(null);
  });

  test("works with mark structure", () => {
    expect(
      getPointAfter(parse("P: foo [strong:bar] baz"), "[strong:bar]"),
    ).toEqual({
      path: [0, 2],
      offset: 0,
    });
  });
});
