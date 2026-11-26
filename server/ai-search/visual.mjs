export const VISUAL_ROOT =
  "https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/annotations/visual-semantics/";
export const ASSET_ROOT =
  "https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/";

// Related words improve recall only. The model still checks the complete query
// against the original evidence. In particular, solitude is not loneliness.
const concepts = [
  ["孤独", "孤单", "寂寞", "孤寂", "寂寥", "落寞", "疏离", "空寂"],
  ["独处", "独自", "单独", "一个人"],
  ["自在", "闲适", "安适", "悠闲", "放松", "轻松", "惬意"],
  ["宁静", "安宁", "平静", "沉静", "静谧", "安静", "平和"],
  ["恐惧", "惊惧", "惊恐", "害怕", "恐怖"],
  ["忧伤", "悲伤", "哀伤", "悲痛", "伤感", "哀愁"],
  ["温暖", "温馨", "暖意", "温柔", "温情"],
  ["开心", "愉悦", "愉快", "喜悦", "欢快", "快乐"],
];
export function expandVisualTerms(terms = []) {
  return [
    ...new Set(
      terms.flatMap((term) => {
        const bare = term.replace(/(?:的感觉|的氛围|感)$/, "");
        return [
          term,
          ...(concepts.find((group) => group.includes(bare)) || []),
        ];
      }),
    ),
  ];
}
export function expandVisualPlan(plan) {
  return {
    ...plan,
    contentTerms: expandVisualTerms(plan.contentTerms),
    evidenceGroups: (plan.evidenceGroups || []).map(expandVisualTerms),
  };
}

export function addVisualAnnotations(data, corpus, snapshot) {
  const docs = new Map(
    corpus.documents.map((doc) => [
      doc.id,
      { ...doc, passages: [...doc.passages] },
    ]),
  );
  const ids = new Set(data.artworks.map((work) => work.id));
  const images = new Map(data.images.map((image) => [image.id, image]));
  let count = 0;
  for (const { work, annotation, annotationUrl } of snapshot.entries) {
    // Catalog versions can advance independently. Bind annotations to the
    // same whole image and immutable media directory, not just an artwork ID.
    const image = images.get(work.image_id);
    if (
      !ids.has(work.artwork_id) ||
      image?.artworkId !== work.artwork_id ||
      image?.role !== "whole" ||
      !image?.thumbnail?.url
    )
      continue;
    const imageDirectory = new URL(
      ".",
      new URL(image.thumbnail.url, ASSET_ROOT),
    ).href;
    if (imageDirectory !== new URL(".", work.image_url).href) continue;
    const passages = visualPassages(annotation, annotationUrl, work.image_url);
    const doc = docs.get(work.artwork_id) || {
      id: work.artwork_id,
      passages: [],
    };
    doc.passages.push(...passages);
    docs.set(work.artwork_id, doc);
    count++;
  }
  return { ...corpus, documents: [...docs.values()], visualCount: count };
}

export function visualPassages(annotation, annotationUrl, imageUrl) {
  const sources = [
    {
      label: "AI 标注原文",
      url: annotationUrl,
    },
    { label: "对应画面", url: imageUrl },
  ];
  const details = [
    ["主体", annotation.subjects],
    ["物件", annotation.objects],
    ["场景", annotation.scene],
    ["动作", annotation.actions],
    ["色彩", annotation.colors],
    ["光线", annotation.lighting],
    ["构图", annotation.composition],
    ["画法", annotation.visual_style],
    ["氛围", annotation.atmosphere],
    ["主题", annotation.themes],
    ["时段", annotation.time_of_day ? [annotation.time_of_day] : []],
    ["季节", annotation.season ? [annotation.season] : []],
  ]
    .filter(([, values]) => values?.length)
    .map(([label, values]) => `${label}：${values.join("、")}。`)
    .join("");
  const visualText = `${annotation.description}\n${details}`;
  const emotionText = annotation.emotions
    .map((emotion) => {
      if (
        typeof emotion.label !== "string" ||
        typeof emotion.evidence !== "string" ||
        !Number.isInteger(emotion.intensity) ||
        emotion.intensity < 1 ||
        emotion.intensity > 5
      )
        throw new Error("Invalid visual emotion");
      // Intensity is an uncalibrated source annotation, not a confidence score.
      return `${emotion.label}：${emotion.evidence}。`;
    })
    .join("\n");
  if (visualText.length > 500 || emotionText.length > 500)
    throw new Error("Visual passage too long");
  const passages = [
    {
      field: "visual_description",
      text: visualText,
      sources,
      searchHints: [
        annotation.search_text,
        ...annotation.search_queries,
        ...(annotation.associations || []),
      ].join(" "),
    },
    ...(emotionText
      ? [{ field: "visual_emotion", text: emotionText, sources }]
      : []),
  ];
  if (passages[0].searchHints.length > 2000)
    throw new Error("Visual search hints too long");
  return passages;
}
