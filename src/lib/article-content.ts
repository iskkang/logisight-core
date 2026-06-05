type NormalizeArticleContentInput = {
  content: string | null;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
};

function plainText(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*_>\s]+|[-*_>\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ko-KR");
}

export function normalizeArticleContent({
  content,
  title,
  summary,
  imageUrl,
  imageCredit,
}: NormalizeArticleContentInput): string {
  if (!content) return "";
  const titleText = plainText(title);
  const summaryText = summary ? plainText(summary) : "";
  const creditText = imageCredit ? plainText(imageCredit) : "";

  const lines = content
    .replace(/^---[\s\S]*?---\s*/, "")
    .split(/\r?\n/)
    .filter((line) => {
      const image = line.match(/!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/);
      if (imageUrl && image?.[1] === imageUrl) return false;
      const text = plainText(line);
      if (/^##\s*(현상|원인과 배경|한국 화주[·ㆍ\-\s]*포워더 영향)\s*$/i.test(line.trim())) {
        return false;
      }
      if (creditText && text === creditText) return false;
      if (imageUrl?.includes("unsplash") && /^photo:\s*.+unsplash$/i.test(text)) return false;
      return true;
    });

  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  while (lines.length > 0) {
    const first = plainText(lines[0]);
    if (first && (first === titleText || first === summaryText)) {
      lines.shift();
      while (lines.length > 0 && !lines[0].trim()) lines.shift();
      continue;
    }
    break;
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
