import type {
  PortableTextBlock,
  PortableTextObject,
  PortableTextSpan,
  PortableTextTextBlock,
  Schema,
} from "@portabletext/schema";
import type {
  Attributes,
  Block,
  InlineNode,
  Mark,
  MarkMode,
  Selection,
  TextBlock,
} from "@textspec/notation";
import { serialize } from "@textspec/notation";
import type { EditorSelection, SerializeContext } from "./types";

/**
 * Serialize PTE value and selection into textspec notation.
 */
export function pteToTextspec(
  context: SerializeContext,
  value: Array<PortableTextBlock>,
  selection?: EditorSelection | null,
): string {
  const converter = new ToTextspecConverter(context.schema);
  const blocks = converter.convertBlocks(value);
  const textspecSelection = converter.buildSelection(selection ?? null);

  return serialize({ blocks, selection: textspecSelection });
}

// =============================================================================
// Selection mapping entry
// =============================================================================

/**
 * Maps a PTE child (by block key + child key) to a textspec selection position.
 */
interface ChildMapping {
  /** Textspec child index in the block's children array */
  textspecChildIndex: number;
  /** Whether this PTE child is a text span (vs inline object) */
  isText: boolean;
  /** Whether this span has marks (wrapped in a mark node in textspec) */
  hasMarks: boolean;
  /** Text length (for spans) */
  textLength: number;
}

// =============================================================================
// Converter
// =============================================================================

class ToTextspecConverter {
  private schema: Schema;

  /**
   * Maps "blockKey:childKey" to textspec child mapping info.
   */
  private childMappings: Map<string, ChildMapping> = new Map();

  /**
   * Maps block key to textspec block index.
   */
  private blockIndexMap: Map<string, number> = new Map();

  /**
   * Maps block key to total textspec children count (for "after last child" positions).
   */
  private blockChildCount: Map<string, number> = new Map();

  constructor(schema: Schema) {
    this.schema = schema;
  }

  convertBlocks(blocks: Array<PortableTextBlock>): Array<Block> {
    const result: Array<Block> = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (!block) {
        continue;
      }

      this.blockIndexMap.set(block._key, i);
      result.push(this.convertBlock(block));
    }

    return result;
  }

  buildSelection(selection: EditorSelection | null): Selection | null {
    if (!selection) {
      return null;
    }

    const anchor = this.resolveSelectionPoint(selection.anchor);
    const focus = this.resolveSelectionPoint(selection.focus);

    if (!anchor || !focus) {
      return null;
    }

    return { anchor, focus };
  }

  // ---------------------------------------------------------------------------
  // Block conversion
  // ---------------------------------------------------------------------------

  private convertBlock(block: PortableTextBlock): Block {
    if (this.isTextBlock(block)) {
      return this.convertTextBlock(block);
    }

    return this.convertBlockObject(block as PortableTextObject);
  }

  private convertTextBlock(block: PortableTextTextBlock): TextBlock {
    const children: Array<InlineNode> = [];
    let textspecChildIndex = 0;

    for (const child of block.children) {
      if (this.isSpan(child)) {
        const span = child as PortableTextSpan;
        const marks = span.marks ?? [];
        const hasMarks = marks.length > 0;

        // Register mapping
        this.childMappings.set(`${block._key}:${span._key}`, {
          textspecChildIndex,
          isText: true,
          hasMarks,
          textLength: span.text.length,
        });

        if (!hasMarks) {
          children.push({ kind: "text", text: span.text });
        } else {
          children.push(
            this.wrapInMarks(
              { kind: "text", text: span.text },
              marks,
              block.markDefs ?? [],
            ),
          );
        }
      } else {
        // Inline object
        const obj = child as PortableTextObject;
        const { _type, _key, ...attrs } = obj;

        this.childMappings.set(`${block._key}:${_key}`, {
          textspecChildIndex,
          isText: false,
          hasMarks: false,
          textLength: 0,
        });

        children.push({
          kind: "inlineObject",
          type: _type,
          attrs: attrs as Attributes,
        });
      }

      textspecChildIndex++;
    }

    this.blockChildCount.set(block._key, textspecChildIndex);

    const type = this.styleToBlockType(block.style ?? "normal");

    const result: TextBlock = {
      kind: "textBlock",
      type,
      children,
    };

    // Add list attributes as block attrs
    const attrs: Record<string, string | number> = {};

    if (block.listItem) {
      attrs.listItem = block.listItem;
    }

    if (block.level !== undefined) {
      attrs.level = block.level;
    }

    if (Object.keys(attrs).length > 0) {
      result.attrs = attrs;
    }

    return result;
  }

  private convertBlockObject(block: PortableTextObject): Block {
    const { _type, _key, ...attrs } = block;
    return {
      kind: "blockObject",
      type: _type.toUpperCase(),
      attrs: attrs as Attributes,
    };
  }

  // ---------------------------------------------------------------------------
  // Mark wrapping
  // ---------------------------------------------------------------------------

  /**
   * Wrap a text node in nested marks. Sorts marks alphabetically for
   * deterministic output: decorators by name, annotations by type.
   */
  private wrapInMarks(
    textNode: InlineNode,
    marks: Array<string>,
    markDefs: Array<PortableTextObject>,
  ): InlineNode {
    // Separate decorators and annotations, sort each group
    const decoratorMarks: Array<string> = [];
    const annotationMarks: Array<string> = [];

    for (const mark of marks) {
      const def = markDefs.find((d) => d._key === mark);

      if (def) {
        annotationMarks.push(mark);
      } else {
        decoratorMarks.push(mark);
      }
    }

    decoratorMarks.sort();
    annotationMarks.sort((a, b) => {
      const defA = markDefs.find((d) => d._key === a);
      const defB = markDefs.find((d) => d._key === b);
      return (defA?._type ?? "").localeCompare(defB?._type ?? "");
    });

    // Build from inside out: annotations first (innermost), then decorators
    const sortedMarks = [...annotationMarks, ...decoratorMarks];
    let node = textNode;

    for (let i = sortedMarks.length - 1; i >= 0; i--) {
      const markId = sortedMarks[i];

      if (!markId) {
        continue;
      }

      const def = markDefs.find((d) => d._key === markId);

      if (def) {
        // Annotation
        const { _key: _defKey, _type, ...attrs } = def;
        const mark: Mark = {
          kind: "mark",
          type: _type,
          mode: "annotation" as MarkMode,
          children: [node],
        };

        if (Object.keys(attrs).length > 0) {
          mark.attrs = attrs as Attributes;
        }

        node = mark;
      } else {
        // Decorator
        node = {
          kind: "mark",
          type: markId,
          mode: "decorator" as MarkMode,
          children: [node],
        };
      }
    }

    return node;
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  private resolveSelectionPoint(point: {
    path: [{ _key: string }, "children", { _key: string }];
    offset: number;
  }): { path: Array<number>; offset: number } | undefined {
    const blockKey = point.path[0]._key;
    const childKey = point.path[2]._key;

    const blockIndex = this.blockIndexMap.get(blockKey);

    if (blockIndex === undefined) {
      return undefined;
    }

    const mapping = this.childMappings.get(`${blockKey}:${childKey}`);

    if (!mapping) {
      return undefined;
    }

    // If the cursor is at the end of a marked span or after an inline object,
    // use the "after this textspec child" position. The textspec serializer
    // only renders the cursor outside marks, not inside them at the end.
    if (
      mapping.isText &&
      mapping.hasMarks &&
      point.offset === mapping.textLength
    ) {
      return {
        path: [blockIndex, mapping.textspecChildIndex + 1],
        offset: 0,
      };
    }

    if (!mapping.isText && point.offset === 1) {
      return {
        path: [blockIndex, mapping.textspecChildIndex + 1],
        offset: 0,
      };
    }

    return {
      path: [blockIndex, mapping.textspecChildIndex],
      offset: point.offset,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private styleToBlockType(style: string): string {
    const mapping: Record<string, string> = {
      normal: "P",
      h1: "H1",
      h2: "H2",
      h3: "H3",
      h4: "H4",
      h5: "H5",
      h6: "H6",
      blockquote: "BLOCKQUOTE",
    };

    return mapping[style] ?? style.toUpperCase();
  }

  private isTextBlock(
    block: PortableTextBlock,
  ): block is PortableTextTextBlock {
    return (
      block._type === this.schema.block.name &&
      Array.isArray((block as PortableTextTextBlock).children)
    );
  }

  private isSpan(child: unknown): child is PortableTextSpan {
    return (
      typeof child === "object" &&
      child !== null &&
      "_type" in child &&
      (child as PortableTextSpan)._type === this.schema.span.name
    );
  }
}
