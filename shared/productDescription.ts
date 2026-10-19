/** The product API stores descriptions as strings. Render only this small HTML subset. */
const allowedTags = new Set([
  "P",
  "DIV",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
  "A",
]);
const discardWithContent = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "MATH",
  "FORM",
  "INPUT",
  "BUTTON",
  "TEXTAREA",
  "TEMPLATE",
  "LINK",
  "META",
]);

function safeLink(href: string): string | null {
  try {
    const url = new URL(href, window.location.origin);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function cleanNode(node: Node, destination: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    destination.appendChild(document.createTextNode(node.textContent ?? ""));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const source = node as Element;
  if (discardWithContent.has(source.tagName)) return;
  if (!allowedTags.has(source.tagName)) {
    for (const child of Array.from(source.childNodes))
      cleanNode(child, destination);
    return;
  }
  const tag = source.tagName === "DIV" ? "p" : source.tagName.toLowerCase();
  const clean = document.createElement(tag);
  if (tag === "a") {
    const href = source.getAttribute("href");
    const safe = href && safeLink(href);
    if (safe) {
      clean.setAttribute("href", safe);
      clean.setAttribute("rel", "noopener noreferrer");
      clean.setAttribute("target", "_blank");
    }
  }
  for (const child of Array.from(source.childNodes)) cleanNode(child, clean);
  destination.appendChild(clean);
}

export function sanitizeDescriptionHtml(value: string): string {
  if (!value.trim()) return "";
  const input = document.createElement("template");
  // Parsing is inert; only rebuilt, allowlisted nodes are returned.
  input.innerHTML = value;
  const output = document.createElement("div");
  for (const child of Array.from(input.content.childNodes))
    cleanNode(child, output);
  return output.innerHTML;
}

export function descriptionAsEditorHtml(value: string): string {
  if (/<\/?(?:p|div|h[23]|ul|ol|li|strong|b|em|i|u|s|a|br)\b/i.test(value)) {
    return sanitizeDescriptionHtml(value);
  }
  const text = document.createElement("div");
  text.textContent = value;
  return `<p>${text.innerHTML.replace(/\r?\n/g, "<br>")}</p>`;
}
