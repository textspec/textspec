import type { Schema } from "@portabletext/schema";

/**
 * Context required for parsing textspec notation into PTE values.
 */
export interface ParseContext {
  keyGenerator: () => string;
  schema: Schema;
}

/**
 * Context required for serializing PTE values into textspec notation.
 */
export type SerializeContext = Pick<ParseContext, "schema">;

/**
 * PTE selection point using key-based paths.
 */
export interface SelectionPoint {
  path: [{ _key: string }, "children", { _key: string }];
  offset: number;
}

/**
 * PTE editor selection.
 */
export interface EditorSelection {
  anchor: SelectionPoint;
  focus: SelectionPoint;
}
