export function extractTextFromNode(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join(node.type === "paragraph" || node.type === "heading" ? "\n" : "");
  }
  return "";
}

export function countWordsInNode(node: any): number {
  const text = extractTextFromNode(node);
  return text.split(/\s+/).filter(Boolean).length;
}

export function extractWordsFromNode(node: any): string[] {
  const text = extractTextFromNode(node);
  return text.split(/\s+/).filter(Boolean);
}
