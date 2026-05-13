/**
 * Minimaler, sicherer Markdown-Renderer fuer Pruefrunden-Texte (testaufgabe,
 * testziel). Bewusst kein `react-markdown`/`remark`/`DOMPurify` — die Dependency-
 * Kosten waeren fuer die kleinen Text-Snippets unverhaeltnismaessig.
 *
 * Strategie:
 *  1. Alles HTML-escapen (`&`, `<`, `>`, `"`, `'`).
 *  2. Inline-Patterns auf den escapeten String anwenden: `**bold**`,
 *     `*italic*`, `\`code\``, `[text](url)` (nur http(s)).
 *  3. Block-Patterns: ungeordnete Listen (`- ` oder `* ` am Zeilenanfang),
 *     geordnete Listen (`1. ` etc.), Absaetze (Leerzeilen-getrennt).
 *
 * Da Schritt 1 IMMER zuerst laeuft, koennen Tester:innen kein eigenes HTML
 * einschmuggeln — die einzigen erlaubten Tags sind die, die der Renderer
 * selbst erzeugt.
 *
 * Diese Funktion gibt einen HTML-String zurueck, der via
 * `dangerouslySetInnerHTML` gerendert wird.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(s: string): string {
  // Inline-Code: `text`  (greedy nicht ueber Zeilenenden)
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // Bold: **text**
  s = s.replace(/\*\*([^*\n][^*]*?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* (nicht **)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // Links: [text](http(s)://...) — andere Schemata werden ignoriert.
  s = s.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, text: string, url: string) =>
      `<a href="${url}" rel="noopener noreferrer nofollow" target="_blank">${text}</a>`,
  );
  return s;
}

export function renderPruefrundeMarkdown(raw: string): string {
  if (!raw) return '';
  // Normalisierung: \r\n → \n.
  const normalized = raw.replace(/\r\n?/g, '\n').trim();
  // HTML-escapen ZUERST.
  const escaped = escapeHtml(normalized);

  // In Bloecke teilen (durch Leerzeilen).
  const blocks = escaped.split(/\n{2,}/);
  const out: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const lines = trimmed.split('\n');

    // Ungeordnete Liste?
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      const items = lines
        .map((l) => inline(l.replace(/^\s*[-*]\s+/, '')))
        .map((l) => `<li>${l}</li>`)
        .join('');
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    // Geordnete Liste?
    if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
      const items = lines
        .map((l) => inline(l.replace(/^\s*\d+\.\s+/, '')))
        .map((l) => `<li>${l}</li>`)
        .join('');
      out.push(`<ol>${items}</ol>`);
      continue;
    }

    // Default: Paragraph (mit <br> fuer harte Zeilenumbrueche).
    const paragraph = lines.map((l) => inline(l)).join('<br />');
    out.push(`<p>${paragraph}</p>`);
  }
  return out.join('\n');
}
