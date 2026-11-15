/**
 * Find an element and check its type at runtime, instead of casting the result of
 * querySelector. Throws if the element is missing or of the wrong type, which means the
 * HTML and the script have drifted apart.
 */
export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  type: new () => T,
): T {
  const el = root.querySelector(selector);

  if (!(el instanceof type)) throw new Error(`Expected ${selector} to be a ${type.name}`);

  return el;
}
