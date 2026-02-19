import type {
  PortableTextBlock,
  PortableTextChild,
  PortableTextObject,
  PortableTextSpan,
  PortableTextTextBlock,
} from "@portabletext/schema";
import type {
  Block,
  InlineNode,
  Mark,
  Selection,
  TextBlock,
} from "@textspec/notation";
import { parse } from "@textspec/notation";
import type { EditorSelection, ParseContext, SelectionPoint } from "./types";

/**
 * Parse textspec notation into PTE value and selection.
 */
export function textspecToPte(
  context: ParseContext,
  notation: string,
): {
  value: Array<PortableTextBlock>;
  selection: EditorSelection | null;
} {
  const editorState = parse(notation);
  const converter = new ToPteConverter(context);
  const value = converter.convertBlocks(editorState.blocks);
  const selection = converter.buildSelection(editorState.selection);

  return { value, selection };
}

// =============================================================================
// Selection mapping
// =============================================================================

/**
 * Represents a resolved PTE selection target.
 * - For text positions inside a span: the span key + character offset
 * - For "after node" positions: the last span's key + its text length
 */
interface SelectionTarget {
  blockKey: string;
  childKey: string;
  offset: number;
}

// =============================================================================
// Converter
// =============================================================================

class ToPteConverter {
  private context: ParseContext;

  /**
   * Maps textspec selection points to PTE selection targets.
   * Key format: "blockIndex:childIndex:offset"
   *
   * For text nodes: maps the textspec child index to the PTE span
   * For "after node" positions (childIndex past end): maps to end of last span
   */
  private selectionMap: Map<string, SelectionTarget> = new Map();

  constructor(context: ParseContext) {
    this.context = context;
  }

  convertBlocks(blocks: Array<Block>): Array<PortableTextBlock> {
    const result: Array<PortableTextBlock> = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (!block) {
        continue;
      }

      const converted = this.convertBlock(block, i);

      if (converted) {
        result.push(converted);
      }
    }

    return result;
  }

  buildSelection(selection: Selection | null): EditorSelection | null {
    if (!selection) {
      return null;
    }

    const anchor = this.resolvePoint(selection.anchor);
    const focus = this.resolvePoint(selection.focus);

    if (!anchor || !focus) {
      return null;
    }

    return { anchor, focus };
  }

  // ---------------------------------------------------------------------------
  // Block conversion
  // ---------------------------------------------------------------------------

  private convertBlock(
    block: Block,
    blockIndex: number,
  ): PortableTextBlock | undefined {
    switch (block.kind) {
      case "textBlock":
        return this.convertTextBlock(block, blockIndex);
      case "blockObject":
        return this.convertBlockObject(block, blockIndex);
      case "containerBlock":
      case "rawBlock":
        return undefined;
      default:
        return undefined;
    }
  }

  private convertTextBlock(
    block: TextBlock,
    blockIndex: number,
  ): PortableTextTextBlock {
    const blockKey = this.context.keyGenerator();

    const markDefs: Array<PortableTextObject> = [];
    const children: Array<PortableTextChild> = [];

    // Track PTE child index as we flatten
    let pteChildIndex = 0;

    for (
      let textspecChildIdx = 0;
      textspecChildIdx < block.children.length;
      textspecChildIdx++
    ) {
      const child = block.children[textspecChildIdx];

      if (!child) {
        continue;
      }

      const converted = this.convertInlineNode(
        child,
        [],
        markDefs,
        blockKey,
        blockIndex,
        textspecChildIdx,
        () => pteChildIndex++,
      );
      children.push(...converted);

      // Register "after this child" position for selection mapping.
      // This handles cases like `[strong:foo]|` where the cursor is
      // at textspec child index N+1 (past the mark).
      if (converted.length > 0) {
        const lastChild = converted[converted.length - 1];

        if (lastChild && "_type" in lastChild && lastChild._type === "span") {
          const span = lastChild as PortableTextSpan;
          // "After this textspec child" = end of the last PTE span it produced
          this.selectionMap.set(`${blockIndex}:${textspecChildIdx + 1}:0`, {
            blockKey,
            childKey: span._key,
            offset: span.text.length,
          });
        } else if (lastChild && "_key" in lastChild) {
          // After an inline object: offset 1 on the object
          this.selectionMap.set(`${blockIndex}:${textspecChildIdx + 1}:0`, {
            blockKey,
            childKey: (lastChild as PortableTextObject)._key,
            offset: 1,
          });
        }
      }
    }

    // Ensure at least one child (empty span)
    if (children.length === 0) {
      const spanKey = this.context.keyGenerator();
      children.push({
        _key: spanKey,
        _type: "span",
        text: "",
        marks: [],
      });
      // Map position [blockIndex, 0, 0] to this empty span
      this.selectionMap.set(`${blockIndex}:0:0`, {
        blockKey,
        childKey: spanKey,
        offset: 0,
      });
    }

    const style = this.blockTypeToStyle(block.type);

    const result: PortableTextTextBlock = {
      _type: this.context.schema.block.name,
      _key: blockKey,
      children,
      markDefs,
      style,
    };

    // Add list attributes from block attrs
    if (block.attrs) {
      if (typeof block.attrs.listItem === "string") {
        result.listItem = block.attrs.listItem;
      }

      if (typeof block.attrs.level === "number") {
        result.level = block.attrs.level;
      }
    }

    return result;
  }

  private convertBlockObject(
    block: Block & { kind: "blockObject" },
    _blockIndex: number,
  ): PortableTextObject {
    const blockKey = this.context.keyGenerator();

    const { ...attrs } = block.attrs;
    return {
      _type: block.type.toLowerCase(),
      _key: blockKey,
      ...attrs,
    };
  }

  // ---------------------------------------------------------------------------
  // Inline conversion
  // ---------------------------------------------------------------------------

  /**
   * Recursively convert an inline node, collecting marks as we descend.
   * Registers selection mappings for text nodes.
   */
  private convertInlineNode(
    node: InlineNode,
    marks: Array<string>,
    markDefs: Array<PortableTextObject>,
    blockKey: string,
    blockIndex: number,
    textspecChildIndex: number,
    nextPteChildIndex: () => number,
  ): Array<PortableTextChild> {
    switch (node.kind) {
      case "text": {
        nextPteChildIndex();
        const spanKey = this.context.keyGenerator();

        // Register selection mapping: textspec position → PTE span
        this.selectionMap.set(`${blockIndex}:${textspecChildIndex}:*`, {
          blockKey,
          childKey: spanKey,
          offset: 0, // offset is pass-through from textspec
        });

        const span: PortableTextSpan = {
          _key: spanKey,
          _type: "span",
          text: node.text,
          marks: [...marks],
        };
        return [span];
      }

      case "mark":
        return this.convertMark(
          node,
          marks,
          markDefs,
          blockKey,
          blockIndex,
          textspecChildIndex,
          nextPteChildIndex,
        );

      case "inlineObject": {
        nextPteChildIndex();
        const objKey = this.context.keyGenerator();

        // Register selection mapping for inline objects
        this.selectionMap.set(`${blockIndex}:${textspecChildIndex}:*`, {
          blockKey,
          childKey: objKey,
          offset: 0,
        });

        const { ...attrs } = node.attrs;
        return [
          {
            _type: node.type,
            _key: objKey,
            ...attrs,
          },
        ];
      }

      default:
        return [];
    }
  }

  private convertMark(
    mark: Mark,
    parentMarks: Array<string>,
    markDefs: Array<PortableTextObject>,
    blockKey: string,
    blockIndex: number,
    textspecChildIndex: number,
    nextPteChildIndex: () => number,
  ): Array<PortableTextChild> {
    let markId: string;

    if (mark.mode === "annotation") {
      const defKey = this.context.keyGenerator();
      const { ...attrs } = mark.attrs ?? {};
      markDefs.push({
        _key: defKey,
        _type: mark.type,
        ...attrs,
      });
      markId = defKey;
    } else {
      markId = mark.type;
    }

    const newMarks = [...parentMarks, markId];
    const result: Array<PortableTextChild> = [];

    for (const child of mark.children) {
      result.push(
        ...this.convertInlineNode(
          child,
          newMarks,
          markDefs,
          blockKey,
          blockIndex,
          textspecChildIndex,
          nextPteChildIndex,
        ),
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Selection resolution
  // ---------------------------------------------------------------------------

  private resolvePoint(point: {
    path: Array<number>;
    offset: number;
  }): SelectionPoint | undefined {
    const blockIndex = point.path[0];
    const childIndex = point.path[1];

    if (blockIndex === undefined || childIndex === undefined) {
      return undefined;
    }

    // First try exact match (for "after node" positions)
    const exactKey = `${blockIndex}:${childIndex}:${point.offset}`;
    const exact = this.selectionMap.get(exactKey);

    if (exact) {
      return {
        path: [{ _key: exact.blockKey }, "children", { _key: exact.childKey }],
        offset: exact.offset,
      };
    }

    // Try wildcard match (for text positions where offset is pass-through)
    const wildcardKey = `${blockIndex}:${childIndex}:*`;
    const wildcard = this.selectionMap.get(wildcardKey);

    if (wildcard) {
      return {
        path: [
          { _key: wildcard.blockKey },
          "children",
          { _key: wildcard.childKey },
        ],
        offset: point.offset,
      };
    }

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private blockTypeToStyle(type: string): string {
    const mapping: Record<string, string> = {
      P: "normal",
      H1: "h1",
      H2: "h2",
      H3: "h3",
      H4: "h4",
      H5: "h5",
      H6: "h6",
      BLOCKQUOTE: "blockquote",
    };

    return mapping[type] ?? type.toLowerCase();
  }
}
