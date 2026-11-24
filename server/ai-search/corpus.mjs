export const CORPUS_FILE = "search-text-v1.json";
export const FIELD_LABELS = {
  description: "作品描述",
  background: "创作背景",
  story: "背景故事",
  looking: "赏析导读",
};

function sources(items) {
  return items
    .filter((item) => {
      try {
        const url = new URL(item.url);
        return (
          ["https:", "http:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    })
    .map(({ label, url }) => ({ label, url }))
    .slice(0, 3);
}

// Each passage is copied from published text. No AI-generated enrichment, and
// no contextual editorial drafts or private notes are added to the search data.
function passages(text) {
  const result = [];
  for (const paragraph of String(text || "")
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    if (paragraph.length <= 500) {
      result.push(paragraph);
      continue;
    }
    const sentences = paragraph.match(/[^。！？.!?]+[。！？.!?]*/gu) || [
      paragraph,
    ];
    let chunk = "";
    for (const sentence of sentences) {
      if (chunk && chunk.length + sentence.length > 500) {
        result.push(chunk);
        chunk = "";
      }
      if (sentence.length <= 500) chunk += sentence;
      else {
        if (chunk) {
          result.push(chunk);
          chunk = "";
        }
        for (let i = 0; i < sentence.length; i += 400)
          result.push(sentence.slice(i, i + 500));
      }
    }
    if (chunk) result.push(chunk);
  }
  return result;
}

export function createSearchCorpus(data, revision) {
  const documents = data.artworks
    .map((work) => {
      const guide = work.guide?.scope === "individual" ? work.guide : {};
      const fields = {
        description: work.description,
        background: guide.background,
        story: guide.story,
        looking: (guide.looking || []).join("\n"),
      };
      const sections = Object.entries(fields).flatMap(([field, text]) =>
        passages(text).map((text) => ({
          field,
          text,
          sources: sources(
            field === "description"
              ? [{ label: "作品资料", url: work.sourceUrl }]
              : guide.sources || [],
          ),
        })),
      );
      return { id: work.id, passages: sections };
    })
    .filter((item) => item.passages.length);
  return { schemaVersion: 1, revision, documents };
}
