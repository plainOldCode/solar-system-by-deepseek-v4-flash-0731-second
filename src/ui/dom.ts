/** Tiny DOM helpers used by UI modules. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

export function button(label: string, className = "btn", onClick?: () => void): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  if (onClick) b.addEventListener("click", onClick);
  return b;
}
