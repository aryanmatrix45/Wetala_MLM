/**
 * Converts HTML (or HTML pasted as escaped text) into readable plain text, for places that
 * show text only, such as short product descriptions. DOMParser does not execute scripts.
 */
export const htmlToPlainText = (value?: string | null): string => {
  if (!value) return '';
  if (!/[<&]/.test(value)) return value;

  const parse = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Keep block boundaries as spaces so words don't run together
    doc.querySelectorAll('br, p, div, li, h1, h2, h3, h4, h5, h6, tr').forEach((el) => {
      el.append(' ');
    });
    return doc.body.textContent || '';
  };

  let text = parse(value);
  // Escaped markup (e.g. "&lt;p&gt;Text&lt;/p&gt;") decodes to tags on the first pass; strip those too
  if (/<\/?[a-z][a-z0-9]*[\s>/]/i.test(text)) {
    text = parse(text);
  }
  return text.replace(/\s+/g, ' ').trim();
};
