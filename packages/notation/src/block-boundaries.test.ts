import { describe, expect, test } from "vitest";
import { ErrorCode, ParseError } from "./errors";
import { parse } from "./parser";
import { serialize } from "./serializer";
import type { EditorState } from "./types";

const cases: Array<{
  input: string;
  ast: EditorState;
  multiline: string;
  singleLine: string;
}> = [
  {
    input: "B:",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
      ],
      selection: null,
    },
    multiline: "B:",
    singleLine: "B:",
  },
  {
    input: "B: ",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
      ],
      selection: null,
    },
    multiline: "B:",
    singleLine: "B:",
  },
  {
    input: "B: |\nB:",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0],
          offset: 0,
        },
        focus: {
          path: [0, 0],
          offset: 0,
        },
      },
    },
    multiline: "B: |\nB:",
    singleLine: "B: |;;B:",
  },
  {
    input: "B: |;;B:",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0],
          offset: 0,
        },
        focus: {
          path: [0, 0],
          offset: 0,
        },
      },
    },
    multiline: "B: |\nB:",
    singleLine: "B: |;;B:",
  },
  {
    input: "LIST:\n  B: |\n  B:",
    ast: {
      blocks: [
        {
          kind: "containerBlock",
          type: "LIST",
          children: [
            {
              kind: "textBlock",
              type: "B",
              children: [],
            },
            {
              kind: "textBlock",
              type: "B",
              children: [],
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0, 0],
          offset: 0,
        },
        focus: {
          path: [0, 0, 0],
          offset: 0,
        },
      },
    },
    multiline: "LIST:\n  B: |\n  B:",
    singleLine: "LIST:{B: |;;B:}",
  },
  {
    input: "LIST:\n  LIST-ITEM:\n    B:\n    B: x|",
    ast: {
      blocks: [
        {
          kind: "containerBlock",
          type: "LIST",
          children: [
            {
              kind: "containerBlock",
              type: "LIST-ITEM",
              children: [
                {
                  kind: "textBlock",
                  type: "B",
                  children: [],
                },
                {
                  kind: "textBlock",
                  type: "B",
                  children: [
                    {
                      kind: "text",
                      text: "x",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0, 1, 0],
          offset: 1,
        },
        focus: {
          path: [0, 0, 1, 0],
          offset: 1,
        },
      },
    },
    multiline: "LIST:\n  LIST-ITEM:\n    B:\n    B: x|",
    singleLine: "LIST:{LIST-ITEM:{B:;;B: x|}}",
  },
  {
    input: "B:\nB: |",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
      ],
      selection: {
        anchor: {
          path: [1, 0],
          offset: 0,
        },
        focus: {
          path: [1, 0],
          offset: 0,
        },
      },
    },
    multiline: "B:\nB: |",
    singleLine: "B:;;B: |",
  },
  {
    input: "B:{B: x|}",
    ast: {
      blocks: [
        {
          kind: "containerBlock",
          type: "B",
          children: [
            {
              kind: "textBlock",
              type: "B",
              children: [
                {
                  kind: "text",
                  text: "x",
                },
              ],
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0, 0],
          offset: 1,
        },
        focus: {
          path: [0, 0, 0],
          offset: 1,
        },
      },
    },
    multiline: "B:\n  B: x|",
    singleLine: "B:{B: x|}",
  },
  {
    input: "B style=h1:",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [],
          attrs: {
            style: "h1",
          },
        },
      ],
      selection: null,
    },
    multiline: 'B style="h1":',
    singleLine: 'B style="h1":',
  },
  {
    input: "B: |\nB:\n  B: x",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
        {
          kind: "containerBlock",
          type: "B",
          children: [
            {
              kind: "textBlock",
              type: "B",
              children: [
                {
                  kind: "text",
                  text: "x",
                },
              ],
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0],
          offset: 0,
        },
        focus: {
          path: [0, 0],
          offset: 0,
        },
      },
    },
    multiline: "B: |\nB:\n  B: x",
    singleLine: "B: |;;B:{B: x}",
  },
  {
    input: "LIST:",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "LIST",
          children: [],
        },
      ],
      selection: null,
    },
    multiline: "LIST:",
    singleLine: "LIST:",
  },
  {
    input: "LIST:;;B: |",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "LIST",
          children: [],
        },
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
      ],
      selection: {
        anchor: {
          path: [1, 0],
          offset: 0,
        },
        focus: {
          path: [1, 0],
          offset: 0,
        },
      },
    },
    multiline: "LIST:\nB: |",
    singleLine: "LIST:;;B: |",
  },
  {
    input: "B: foo ",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo ",
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B: foo\\s",
    singleLine: "B: foo ",
  },
  {
    input: "B: foo\\s",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo ",
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B: foo\\s",
    singleLine: "B: foo ",
  },
  {
    input: "B: foo |",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo ",
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0],
          offset: 4,
        },
        focus: {
          path: [0, 0],
          offset: 4,
        },
      },
    },
    multiline: "B: foo |",
    singleLine: "B: foo |",
  },
  {
    input: "B: foo [strong:bar ]",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo ",
            },
            {
              kind: "mark",
              type: "strong",
              mode: "decorator",
              children: [
                {
                  kind: "text",
                  text: "bar ",
                },
              ],
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B: foo [strong:bar ]",
    singleLine: "B: foo [strong:bar ]",
  },
  {
    input: "B: \\s",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: " ",
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B: \\s",
    singleLine: "B:  ",
  },
  {
    input: "B:  foo",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: " foo",
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B:  foo",
    singleLine: "B:  foo",
  },
  {
    input: "B: foo \\s",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo  ",
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B: foo \\s",
    singleLine: "B: foo  ",
  },
  {
    input: "B: foo ;;B: x|",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo ",
            },
          ],
        },
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "x",
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [1, 0],
          offset: 1,
        },
        focus: {
          path: [1, 0],
          offset: 1,
        },
      },
    },
    multiline: "B: foo\\s\nB: x|",
    singleLine: "B: foo ;;B: x|",
  },
  {
    input: "B: foo\\s|",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo ",
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0],
          offset: 4,
        },
        focus: {
          path: [0, 0],
          offset: 4,
        },
      },
    },
    multiline: "B: foo |",
    singleLine: "B: foo |",
  },
  {
    input: "LIST:{B:}",
    ast: {
      blocks: [
        {
          kind: "containerBlock",
          type: "LIST",
          children: [
            {
              kind: "textBlock",
              type: "B",
              children: [],
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "LIST:\n  B:",
    singleLine: "LIST:{B:}",
  },
  {
    input: "LIST:\n  B:\nB: x|",
    ast: {
      blocks: [
        {
          kind: "containerBlock",
          type: "LIST",
          children: [
            {
              kind: "textBlock",
              type: "B",
              children: [],
            },
          ],
        },
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "x",
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [1, 0],
          offset: 1,
        },
        focus: {
          path: [1, 0],
          offset: 1,
        },
      },
    },
    multiline: "LIST:\n  B:\nB: x|",
    singleLine: "LIST:{B:};;B: x|",
  },
  {
    input: "LIST:\n  B style=h1:\nB: x|",
    ast: {
      blocks: [
        {
          kind: "containerBlock",
          type: "LIST",
          children: [
            {
              kind: "textBlock",
              type: "B",
              children: [],
              attrs: {
                style: "h1",
              },
            },
          ],
        },
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "x",
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [1, 0],
          offset: 1,
        },
        focus: {
          path: [1, 0],
          offset: 1,
        },
      },
    },
    multiline: 'LIST:\n  B style="h1":\nB: x|',
    singleLine: 'LIST:{B style="h1":};;B: x|',
  },
  {
    input: "B: foo ^bar|",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo bar",
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0],
          offset: 4,
        },
        focus: {
          path: [0, 0],
          offset: 7,
        },
      },
    },
    multiline: "B: foo ^bar|",
    singleLine: "B: foo ^bar|",
  },
  {
    input: "UL:\nP: after|",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "UL",
          children: [],
        },
        {
          kind: "textBlock",
          type: "P",
          children: [
            {
              kind: "text",
              text: "after",
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [1, 0],
          offset: 5,
        },
        focus: {
          path: [1, 0],
          offset: 5,
        },
      },
    },
    multiline: "UL:\nP: after|",
    singleLine: "UL:;;P: after|",
  },
  {
    input: "L:\n  M:\n    B:\nB: x|",
    ast: {
      blocks: [
        {
          kind: "containerBlock",
          type: "L",
          children: [
            {
              kind: "containerBlock",
              type: "M",
              children: [
                {
                  kind: "textBlock",
                  type: "B",
                  children: [],
                },
              ],
            },
          ],
        },
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "x",
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [1, 0],
          offset: 1,
        },
        focus: {
          path: [1, 0],
          offset: 1,
        },
      },
    },
    multiline: "L:\n  M:\n    B:\nB: x|",
    singleLine: "L:{M:{B:}};;B: x|",
  },
  {
    input: "L:\n  B: x|\n  B:\n  B: y",
    ast: {
      blocks: [
        {
          kind: "containerBlock",
          type: "L",
          children: [
            {
              kind: "textBlock",
              type: "B",
              children: [
                {
                  kind: "text",
                  text: "x",
                },
              ],
            },
            {
              kind: "textBlock",
              type: "B",
              children: [],
            },
            {
              kind: "textBlock",
              type: "B",
              children: [
                {
                  kind: "text",
                  text: "y",
                },
              ],
            },
          ],
        },
      ],
      selection: {
        anchor: {
          path: [0, 0, 0],
          offset: 1,
        },
        focus: {
          path: [0, 0, 0],
          offset: 1,
        },
      },
    },
    multiline: "L:\n  B: x|\n  B:\n  B: y",
    singleLine: "L:{B: x|;;B:;;B: y}",
  },
  {
    input: "B:\n{IMG}|",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [],
        },
        {
          kind: "blockObject",
          type: "IMG",
          attrs: {},
        },
      ],
      selection: {
        anchor: {
          path: [1],
          offset: 1,
        },
        focus: {
          path: [1],
          offset: 1,
        },
      },
    },
    multiline: "B:\n{IMG}|",
    singleLine: "B:;;{IMG}|",
  },
  {
    input: "B: [s:a] ",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "mark",
              type: "s",
              mode: "decorator",
              children: [
                {
                  kind: "text",
                  text: "a",
                },
              ],
            },
            {
              kind: "text",
              text: " ",
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B: [s:a]\\s",
    singleLine: "B: [s:a] ",
  },
  {
    input: "B: {o} ",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "inlineObject",
              type: "o",
              attrs: {},
            },
            {
              kind: "text",
              text: " ",
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B: {o}\\s",
    singleLine: "B: {o} ",
  },
  {
    input: "B: foo\\\\ ",
    ast: {
      blocks: [
        {
          kind: "textBlock",
          type: "B",
          children: [
            {
              kind: "text",
              text: "foo\\ ",
            },
          ],
        },
      ],
      selection: null,
    },
    multiline: "B: foo\\\\\\s",
    singleLine: "B: foo\\\\ ",
  },
];

const rawCases: typeof cases = [
  {
    input: "CODE!:\n  foo ",
    ast: {
      blocks: [
        {
          kind: "rawBlock",
          type: "CODE",
          lines: ["foo "],
        },
      ],
      selection: null,
    },
    multiline: "CODE!:\n  foo ",
    singleLine: "CODE!:\n  foo ",
  },
];

describe(parse.name, () => {
  for (const { input, ast } of [...cases, ...rawCases]) {
    test(`block boundary: ${JSON.stringify(input)}`, () => {
      expect(parse(input)).toEqual(ast);
    });
  }

  test("missing space before content", () => {
    expect(() => parse("P:foo|")).toThrow(
      new ParseError(ErrorCode.MissingSpaceAfterColon, { line: 1, column: 3 }),
    );
  });
});

describe(serialize.name, () => {
  for (const { input, ast, multiline, singleLine } of cases) {
    test(`block boundary: ${JSON.stringify(input)}`, () => {
      expect(serialize(ast)).toEqual(multiline);
      expect(serialize(ast, { singleLine: true })).toEqual(singleLine);
      expect(
        parse(
          multiline
            .split("\n")
            .map((line) => line.trimEnd())
            .join("\n"),
        ),
      ).toEqual(ast);
    });

    test(`round trip: ${JSON.stringify(input)}`, () => {
      for (const options of [{}, { singleLine: true }]) {
        const output = serialize(ast, options);
        expect(parse(output)).toEqual(ast);
        expect(serialize(parse(output), options)).toEqual(output);
      }
    });
  }
  for (const { input, ast, multiline, singleLine } of rawCases) {
    test(`raw block boundary: ${JSON.stringify(input)}`, () => {
      expect(serialize(ast)).toEqual(multiline);
      expect(serialize(ast, { singleLine: true })).toEqual(singleLine);
      for (const options of [{}, { singleLine: true }]) {
        const output = serialize(ast, options);
        expect(parse(output)).toEqual(ast);
        expect(serialize(parse(output), options)).toEqual(output);
      }
    });
  }
});
