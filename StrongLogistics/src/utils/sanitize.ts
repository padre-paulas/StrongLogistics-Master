/**
 * Escapes HTML special characters by leveraging the browser's built-in
 * text node encoding, preventing XSS when rendering user-supplied strings.
 */
export function sanitizeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}
