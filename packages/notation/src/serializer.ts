/**
 * Serializer for the Editor State DSL
 *
 * Converts an AST back to a DSL string.
 */

import type {
  Attributes,
  AttributeValue,
  Block,
  BlockObject,
  ContainerBlock,
  EditorState,
  InlineNode,
  InlineObject,
  Mark,
  Point,
  RawBlock,
  Selection,
  Text,
  TextBlock,
} from "./types";

// =============================================================================
// Serializer Options
// =============================================================================

export interface SerializeOptions {
  /**
   * When true, output single-line format using ;; as block separator
   * and {...} for container children.
   */
  singleLine?: boolean;
}

// =============================================================================
// Serializer State
// =============================================================================

interface SerializerState {
  selection: Selection | null;
  currentPath: Array<number>;
  currentOffset: number;
  singleLine: boolean;
}

// =============================================================================
// Serializer Class
// =============================================================================

export class Serializer {
  private state: SerializerState;

  constructor(selection: Selection | null, options: SerializeOptions = {}) {
    this.state = {
      selection,
      currentPath: [],
      currentOffset: 0,
      singleLine: options.singleLine ?? false,
    };
  }

  /**
   * Serialize a complete EditorState to a DSL string.
   */
  serialize(editorState: EditorState): string {
    if (this.state.singleLine) {
      return this.serializeSingleLine(editorState);
    }

    const lines: Array<string> = [];

    for (let i = 0; i < editorState.blocks.length; i++) {
      const block = editorState.blocks[i];
      if (block) {
        this.state.currentPath = [i];
        lines.push(...this.serializeBlock(block, 0));
      }
    }

    return lines.join("\n");
  }

  /**
   * Serialize in single-line format using ;; and {...}
   */
  private serializeSingleLine(editorState: EditorState): string {
    const parts: Array<string> = [];

    for (let i = 0; i < editorState.blocks.length; i++) {
      const block = editorState.blocks[i];
      if (block) {
        this.state.currentPath = [i];
        parts.push(this.serializeBlockSingleLine(block));
      }
    }

    return parts.join(";;");
  }

  /**
   * Serialize a single block in single-line format.
   */
  private serializeBlockSingleLine(block: Block): string {
    switch (block.kind) {
      case "textBlock":
        return this.serializeTextBlockSingleLine(block);
      case "containerBlock":
        return this.serializeContainerSingleLine(block);
      case "rawBlock":
        // Code blocks can't really be single-line, fall back to multiline
        return this.serializeBlock(block, 0).join("\n");
      case "blockObject":
        return this.serializeBlockObject(block, "")[0] ?? "";
    }
  }

  private serializeTextBlockSingleLine(block: TextBlock): string {
    const attrs = this.serializeAttributes(block.attrs ?? {});
    const attrsStr = attrs ? ` ${attrs}` : "";
    const content = this.serializeInlineContent(block.children);
    return `${block.type}${attrsStr}: ${content}`;
  }

  private serializeContainerSingleLine(block: ContainerBlock): string {
    const attrs = this.serializeAttributes(block.attrs ?? {});
    const attrsStr = attrs ? ` ${attrs}` : "";
    const basePath = [...this.state.currentPath];
    const childParts: Array<string> = [];

    for (let i = 0; i < block.children.length; i++) {
      const child = block.children[i];
      if (child) {
        this.state.currentPath = [...basePath, i];
        childParts.push(this.serializeBlockSingleLine(child));
      }
    }

    this.state.currentPath = basePath;
    return `${block.type}${attrsStr}:{${childParts.join(";;")}}`;
  }

  // ===========================================================================
  // Block Serialization
  // ===========================================================================

  private serializeBlock(block: Block, indent: number): Array<string> {
    const prefix = "  ".repeat(indent);

    switch (block.kind) {
      case "textBlock":
        return this.serializeTextBlock(block, prefix);
      case "containerBlock":
        return this.serializeContainer(block, prefix, indent);
      case "rawBlock":
        return this.serializeRawBlock(block, prefix, indent);
      case "blockObject":
        return this.serializeBlockObject(block, prefix);
    }
  }

  private serializeTextBlock(block: TextBlock, prefix: string): Array<string> {
    const attrs = this.serializeAttributes(block.attrs ?? {});
    const attrsStr = attrs ? ` ${attrs}` : "";
    const content = this.serializeInlineContent(block.children);
    return [`${prefix}${block.type}${attrsStr}: ${content}`];
  }

  private serializeContainer(
    block: ContainerBlock,
    prefix: string,
    indent: number,
  ): Array<string> {
    const attrs = this.serializeAttributes(block.attrs ?? {});
    const attrsStr = attrs ? ` ${attrs}` : "";
    const lines: Array<string> = [`${prefix}${block.type}${attrsStr}:`];
    const basePath = [...this.state.currentPath];

    for (let i = 0; i < block.children.length; i++) {
      const child = block.children[i];
      if (child) {
        this.state.currentPath = [...basePath, i];
        lines.push(...this.serializeBlock(child, indent + 1));
      }
    }

    this.state.currentPath = basePath;
    return lines;
  }

  private serializeRawBlock(
    block: RawBlock,
    prefix: string,
    indent: number,
  ): Array<string> {
    const attrs = this.serializeAttributes(block.attrs ?? {});
    const attrsStr = attrs ? ` ${attrs}` : "";
    const lines: Array<string> = [`${prefix}${block.type}!${attrsStr}:`];
    const contentPrefix = "  ".repeat(indent + 1);

    for (let i = 0; i < block.lines.length; i++) {
      const line = block.lines[i] ?? "";
      const escapedLine = this.escapeCodeLine(line);

      // Check for selection in this line
      const lineWithSelection = this.insertSelectionInCodeLine(escapedLine, i);
      lines.push(`${contentPrefix}${lineWithSelection}`);
    }

    return lines;
  }

  private serializeBlockObject(
    block: BlockObject,
    prefix: string,
  ): Array<string> {
    const attrs = this.serializeAttributes(block.attrs);
    const attrsStr = attrs ? ` ${attrs}` : "";
    const isCollapsed = this.isCollapsedSelection();

    // Check for selection around this object
    let result = `{${block.type}${attrsStr}}`;

    // Selection before object
    // For collapsed selections, only output | (not ^)
    if (
      !isCollapsed &&
      this.isSelectionAtPath(this.state.selection?.anchor ?? null, 0)
    ) {
      result = `^${result}`;
    }
    if (this.isSelectionAtPath(this.state.selection?.focus ?? null, 0)) {
      result = `|${result}`;
    }

    // Selection after object
    if (
      !isCollapsed &&
      this.isSelectionAtPath(this.state.selection?.anchor ?? null, 1)
    ) {
      result = `${result}^`;
    }
    if (this.isSelectionAtPath(this.state.selection?.focus ?? null, 1)) {
      result = `${result}|`;
    }

    return [`${prefix}${result}`];
  }

  // ===========================================================================
  // Inline Content Serialization
  // ===========================================================================

  private serializeInlineContent(nodes: Array<InlineNode>): string {
    let result = "";
    this.state.currentOffset = 0;
    const basePath = [...this.state.currentPath];
    const isCollapsed = this.isCollapsedSelection();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) {
        continue;
      }

      this.state.currentPath = [...basePath, i];
      result += this.serializeInlineNode(node);
    }

    // Check for selection at end of content (after all nodes)
    this.state.currentPath = [...basePath, nodes.length];
    if (
      !isCollapsed &&
      this.isSelectionAtPath(this.state.selection?.anchor ?? null, 0)
    ) {
      result += "^";
    }
    if (this.isSelectionAtPath(this.state.selection?.focus ?? null, 0)) {
      result += "|";
    }

    this.state.currentPath = basePath;
    return result;
  }

  private serializeInlineNode(node: InlineNode): string {
    switch (node.kind) {
      case "text":
        return this.serializeText(node);
      case "mark":
        return this.serializeMark(node);
      case "inlineObject":
        return this.serializeInlineObject(node);
    }
  }

  private serializeText(node: Text): string {
    let result = "";
    const text = node.text; // Use original text for offset tracking
    const isCollapsed = this.isCollapsedSelection();

    for (let i = 0; i <= text.length; i++) {
      // Check for selection at this offset (using original text positions)
      // For collapsed selections, only output | (not ^)
      if (
        !isCollapsed &&
        this.isSelectionAtPath(this.state.selection?.anchor ?? null, i)
      ) {
        result += "^";
      }
      if (this.isSelectionAtPath(this.state.selection?.focus ?? null, i)) {
        result += "|";
      }

      if (i < text.length) {
        // Escape the character and append
        result += this.escapeChar(text[i] ?? "");
      }
    }

    this.state.currentOffset += node.text.length;
    return result;
  }

  private escapeChar(char: string): string {
    switch (char) {
      case "\\":
        return "\\\\";
      case "[":
        return "\\[";
      case "]":
        return "\\]";
      case "{":
        return "\\{";
      case "}":
        return "\\}";
      case "|":
        return "\\|";
      case "^":
        return "\\^";
      case ";":
        return "\\;"; // Escape to prevent ;; being interpreted as block separator
      default:
        return char;
    }
  }

  private isCollapsedSelection(): boolean {
    if (!this.state.selection) {
      return true;
    }
    const { anchor, focus } = this.state.selection;
    return (
      anchor.offset === focus.offset &&
      anchor.path.length === focus.path.length &&
      anchor.path.every((p, i) => p === focus.path[i])
    );
  }

  private serializeMark(mark: Mark): string {
    const prefix =
      mark.mode === "annotation" ? "@" : mark.mode === "overlay" ? "~" : "";
    const attrs = this.serializeAttributes(mark.attrs ?? {});
    const attrsStr = attrs ? ` ${attrs}` : "";
    const content = this.serializeInlineContent(mark.children);

    return `[${prefix}${mark.type}${attrsStr}:${content}]`;
  }

  private serializeInlineObject(obj: InlineObject): string {
    const attrs = this.serializeAttributes(obj.attrs);
    const attrsStr = attrs ? ` ${attrs}` : "";
    const isCollapsed = this.isCollapsedSelection();

    let result = `{${obj.type}${attrsStr}}`;

    // Check for selection around this object
    // For collapsed selections, only output | (not ^)
    if (
      !isCollapsed &&
      this.isSelectionAtPath(this.state.selection?.anchor ?? null, 0)
    ) {
      result = `^${result}`;
    }
    if (this.isSelectionAtPath(this.state.selection?.focus ?? null, 0)) {
      result = `|${result}`;
    }
    if (
      !isCollapsed &&
      this.isSelectionAtPath(this.state.selection?.anchor ?? null, 1)
    ) {
      result = `${result}^`;
    }
    if (this.isSelectionAtPath(this.state.selection?.focus ?? null, 1)) {
      result = `${result}|`;
    }

    return result;
  }

  // ===========================================================================
  // Attribute Serialization
  // ===========================================================================

  private serializeAttributes(attrs: Attributes): string {
    const entries = Object.entries(attrs);
    if (entries.length === 0) {
      return "";
    }

    // Sort alphabetically by key for deterministic output
    entries.sort(([a], [b]) => a.localeCompare(b));

    return entries
      .map(([key, value]) => `${key}=${this.serializeAttributeValue(value)}`)
      .join(" ");
  }

  private serializeAttributeValue(value: AttributeValue): string {
    // Handle null
    if (value === null) {
      return "null";
    }

    // Handle objects and arrays (JSON)
    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    if (typeof value === "string") {
      // Escape quotes and backslashes in string values
      const escaped = value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r");
      return `"${escaped}"`;
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return String(value);
  }

  // ===========================================================================
  // Selection Helpers
  // ===========================================================================

  private isSelectionAtPath(point: Point | null, offset: number): boolean {
    if (!point) {
      return false;
    }

    const pathMatch =
      point.path.length === this.state.currentPath.length &&
      point.path.every((p, i) => p === this.state.currentPath[i]);

    return pathMatch && point.offset === offset;
  }

  private insertSelectionInCodeLine(line: string, lineIndex: number): string {
    // Check if selection is in this code line
    // For simplicity, we check if the path ends with this line index
    const path = [...this.state.currentPath, lineIndex];
    const isCollapsed = this.isCollapsedSelection();

    let result = "";
    for (let i = 0; i <= line.length; i++) {
      // Check anchor (skip for collapsed selections)
      if (
        !isCollapsed &&
        this.state.selection?.anchor &&
        this.pathEquals(this.state.selection.anchor.path, path) &&
        this.state.selection.anchor.offset === i
      ) {
        result += "^";
      }
      // Check focus
      if (
        this.state.selection?.focus &&
        this.pathEquals(this.state.selection.focus.path, path) &&
        this.state.selection.focus.offset === i
      ) {
        result += "|";
      }

      if (i < line.length) {
        result += line[i];
      }
    }

    return result;
  }

  private pathEquals(a: Array<number>, b: Array<number>): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  private escapeCodeLine(line: string): string {
    // In code blocks, only | and ^ need escaping
    return line.replace(/\|/g, "\\|").replace(/\^/g, "\\^");
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Serialize an EditorState to a DSL string.
 *
 * @param editorState - The editor state to serialize
 * @param options - Serialization options
 * @returns The serialized DSL string
 *
 * @example
 * ```ts
 * // Multiline output (default)
 * serialize(state);
 * // => "P: foo|\nH1: bar"
 *
 * // Single-line output
 * serialize(state, { singleLine: true });
 * // => "P: foo|;;H1: bar"
 * ```
 */
export function serialize(
  editorState: EditorState,
  options: SerializeOptions = {},
): string {
  const serializer = new Serializer(editorState.selection, options);
  return serializer.serialize(editorState);
}
