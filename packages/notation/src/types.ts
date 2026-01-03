/**
 * Editor State AST Types
 *
 * These types represent the parsed structure of the Editor State DSL.
 */

// =============================================================================
// Editor State (root)
// =============================================================================

/**
 * The complete editor state, containing blocks and selection.
 */
export interface EditorState {
  blocks: Array<Block>;
  selection: Selection | null;
}

// =============================================================================
// Selection
// =============================================================================

/**
 * A point in the document tree.
 * - path: array of indices from root to the containing node
 * - offset: character offset within a text node, or 0/1 for objects
 */
export interface Point {
  path: Array<number>;
  offset: number;
}

/**
 * The selection state.
 * - For a collapsed selection (caret), anchor and focus are equal.
 * - For a range selection, anchor is where selection started, focus is current position.
 */
export interface Selection {
  anchor: Point;
  focus: Point;
}

// =============================================================================
// Blocks
// =============================================================================

/**
 * A block is a structural unit in the document.
 */
export type Block = TextBlock | ContainerBlock | RawBlock | BlockObject;

/**
 * Base properties shared by all block types.
 */
interface BlockBase {
  type: string;
}

/**
 * A text block contains inline content (text, marks, inline objects).
 * Examples: P, H1, H2, H3
 */
export interface TextBlock extends BlockBase {
  kind: "textBlock";
  attrs?: Attributes;
  children: Array<InlineNode>;
}

/**
 * A container holds child blocks.
 * Examples: UL, OL, BLOCKQUOTE
 */
export interface ContainerBlock extends BlockBase {
  kind: "containerBlock";
  attrs?: Attributes;
  children: Array<Block>;
}

/**
 * A raw block contains raw text lines (no inline parsing).
 * Use `TYPE!:` syntax to create raw blocks (e.g., `CODE!:`, `MATH!:`, `HTML!:`).
 */
export interface RawBlock extends BlockBase {
  kind: "rawBlock";
  type: string;
  attrs?: Attributes;
  lines: Array<string>;
}

/**
 * A block object is an atomic block with no content or children.
 * Examples: IMAGE, EMBED, HR
 */
export interface BlockObject extends BlockBase {
  kind: "blockObject";
  attrs: Attributes;
}

// =============================================================================
// Inline Content
// =============================================================================

/**
 * Inline nodes appear within text blocks.
 */
export type InlineNode = Text | Mark | InlineObject;

/**
 * A text node contains character data. It is a leaf in the tree.
 */
export interface Text {
  kind: "text";
  text: string;
}

/**
 * Mark mode categorizes the type of mark.
 * - decorator: formatting marks (strong, em, underline)
 * - annotation: reference marks (link, mention)
 * - overlay: editorial marks (highlight, comment, suggestion)
 */
export type MarkMode = "decorator" | "annotation" | "overlay";

/**
 * A mark represents a formatting span that wraps content.
 * Examples: strong, em, link, comment
 */
export interface Mark {
  kind: "mark";
  type: string;
  mode: MarkMode;
  attrs?: Attributes;
  children: Array<InlineNode>;
}

/**
 * An inline object is an atomic inline element. It is a leaf in the tree.
 * Examples: mention, emoji
 */
export interface InlineObject {
  kind: "inlineObject";
  type: string;
  attrs: Attributes;
}

// =============================================================================
// Attributes
// =============================================================================

/**
 * JSON-compatible value type for attributes.
 * Supports primitives, arrays, and objects.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | Array<JsonValue>
  | { [key: string]: JsonValue };

/**
 * Attribute value types.
 */
export type AttributeValue = JsonValue;

/**
 * A record of attribute key-value pairs.
 */
export type Attributes = Record<string, AttributeValue>;
