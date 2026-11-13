import fs from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../content/artwork-guides/", import.meta.url);
const read = async (name) =>
  JSON.parse(await fs.readFile(new URL(name, root), "utf8"));

// Questions below are editorial invitations to look, not claims about unseen
// details. Specific iconography/history belongs in the sourced override files.
const genres = {
  self: {
    story:
      "自画像让画家同时成为观察者与被观察者。与其把面容直接当成某一年心情的记录，更有帮助的是比较他选择了怎样的年龄形象、衣着、姿态和观看距离。制作一张自画像也意味着安排一种希望被别人看到的形象；画中的服饰未必就是画家每天的穿着。",
    looking: [
      "先比较头部与肩膀的转向，再观察目光是否直视画外。这样的安排让你觉得是在面对一个人，还是旁观他对自己的研究？",
      "放大眼睛、嘴角与脸部边缘，再缩小看整体。哪些细节被仔细描绘，哪些只用少量笔触提示？这些差异怎样影响人物的存在感？",
    ],
  },
  portrait: {
    story:
      "肖像提供的不只是一个人的长相，也是一种经过安排的相见方式。人物可以通过衣着、姿态、随身物件以及与观者的距离，呈现庄重、亲近或沉思的形象。即使姓名没有留下，仍然可以从这些可见关系理解作品；不必先为人物编出一段生平。",
    looking: [
      "比较脸部、手与服饰各自受到多少光照和描绘。你的目光先落在哪里，又被什么细节引向下一处？",
      "看人物如何占据画幅：半身、全身、侧面或正面会带来怎样的距离感？再检查目光与身体朝向是否一致。",
    ],
  },
  tronie: {
    story:
      "人物习作或“tronie”不一定以保存某位委托人的身份为目标，也可能探索年龄、表情、奇异服饰与光线。画中人即使有现实模特，也不能据此把作品当成普通的实名肖像。观看重点可以放在一种面貌如何被画家塑造出来。",
    looking: [
      "先看脸部最有变化的位置，再比较衣帽是否让人物像在扮演某种角色。这样的服饰与表情为你提供了哪些联想？",
      "把画面缩小看明暗块面，再放大看皮肤、毛发或衣料。哪些地方靠细节成立，哪些靠颜色与笔触的相互关系成立？",
    ],
  },
  group: {
    story:
      "群像需要同时处理个体身份与群体关系。人物并排出现并不意味着他们同样重要：视线、动作、站位和彼此的距离，都会影响观者先注意到谁。可以先辨认画中的交流，再思考这些人为何被安排在一起；没有委托记录时，不把人物关系写成确定事实。",
    looking: [
      "沿着目光与手势依次看过去，尝试把人群分成几组。哪些人在相互回应，哪些人直接面向画外？",
      "比较前后人物的尺度、清晰度与光照。画家怎样在让每个人被辨认的同时，维持整幅画的节奏？",
    ],
  },
  landscape: {
    story:
      "风景可以记录一个地方，也可以重新组合树木、道路、水面与建筑，形成适合观看的空间。题名能提示地点或天气，却不等于眼前画面是未经调整的实地记录。可以把自己的目光想象成一位行旅者，观察画面允许你从哪里进入，又在哪里停留。",
    looking: [
      "先找近景、中景与远景的连接：道路、水流、树列或光线是否把目光带向深处？若空间被压平，这会带来什么感受？",
      "比较天空与地面的面积，以及亮处和暗处的分布。人物或房屋若很小，它们怎样帮助你感受环境的尺度？",
    ],
  },
  still: {
    story:
      "静物把日常物件或动植物放到持续观看的中心。它们可以提示使用、劳动、宴饮或生命变化，但每个物件不必都有一个固定密码。先看画家怎样选择、摆放并照亮对象，再结合具体资料判断是否有更明确的寓意。",
    looking: [
      "比较不同物体的轮廓、材质和重量感。哪些边缘清楚，哪些融入背景，光线又怎样在表面停留？",
      "从物件之间的空隙看构图：它们紧密堆叠还是各自分开？这样的节奏让场景显得丰盛、安静，还是不稳定？",
    ],
  },
  narrative: {
    story:
      "这幅画可以从人物之间的行动来阅读：谁先发起动作，谁正在回应，谁只是见证者？一个完整故事常被绘画压缩成单独的时刻，而不同人物可能处在不同的认识阶段。具体身份和故事版本仍需依据该作品的资料，不能只凭相似的服饰或姿态下结论。",
    looking: [
      "先找到最明显的一组动作，再沿着手势、目光和身体朝向看向其他人物。哪一处像是事件的起点，哪一处像是它造成的结果？",
      "比较行动中心与外围的明暗、色彩和细节。画家怎样让你知道该先看什么，又有哪些信息需要停留后才能发现？",
    ],
  },
  figure: {
    story:
      "人物题材可以是肖像、角色扮演、日常场景，也可以承载神话或寓意。若没有足够资料确认身份，可以先从身体姿态与观看关系入手：人物是在行动、等待、休息，还是向画外的人展示自己？这些问题能帮助理解画面，而不必依赖未经证实的故事。",
    looking: [
      "比较身体各部分的转向与重心，再观察人物和周围空间的接触方式。姿态怎样影响你感到的安定、紧张或亲近？",
      "看目光、手势与画幅边缘的关系。人物似乎在与谁交流，观者被放在多远的位置？",
    ],
  },
  abstract: {
    story:
      "这幅作品可以先从线、色块、方向与间隔的关系来理解，而不急着为每种形状寻找现实中的对应物。观看也有时间顺序：眼睛先被哪里吸引，经过哪些重复或转折，最后又回到何处？这些关系本身就能构成画面的主题。",
    looking: [
      "先挑出最强的两三种颜色或方向，比较它们的面积、位置和相互距离。哪些关系带来平衡，哪些带来偏移与张力？",
      "从整体缩小到局部放大，观察轮廓、接缝与笔触。规则的结构里是否保留了手工制作的变化？",
    ],
  },
};
const genreIds = {
  Q192110: "self",
  Q1433099: "tronie",
  Q1551015: "group",
  Q19968941: "group",
  Q19547247: "group",
  Q191163: "landscape",
  Q170571: "still",
  Q134307: "portrait",
  Q3399515: "portrait",
  Q30303254: "portrait",
  Q2864737: "narrative",
  Q3374376: "narrative",
  Q742333: "narrative",
  Q1047337: "figure",
  Q40446: "figure",
};

function genreFor(work, facts) {
  const title = `${work.title} ${facts.originalTitle ?? ""}`;
  if (/自画|自畫|self[ -]portrait/i.test(title)) return "self";
  if (/tronie|人物习作/i.test(title)) return "tronie";
  for (const id of facts.genres ?? []) if (genreIds[id]) return genreIds[id];
  if (/portrait|肖像|男子|女子|老人|old man|old woman|bust of/i.test(title))
    return "portrait";
  if (/landscape|山水|山居|雪景|风景|風景|winter|mill\b|waterfall/i.test(title))
    return "landscape";
  if (
    /still life|静物|靜物|dead peacock|dead bittern|slaughtered ox/i.test(title)
  )
    return "still";
  if (work.artistIds.some((id) => ["kandinsky", "mondrian"].includes(id)))
    return "abstract";
  return "figure";
}

// Only cues named in the title are used; questions never assert extra objects.
const detailCues = [
  [
    /书|書|reading|book|scholar/i,
    "题名涉及阅读或学者。可以比较书页、拿书的手与阅读者的目光：画面更强调获取知识的动作，还是阅读中的停顿与思索？",
  ],
  [
    /金链|金鏈|gold chain/i,
    "题名特别提到金链。比较金属的亮点与皮肤、衣料的质感：这件饰物是首先吸引目光，还是在暗处逐渐显现？它怎样影响人物给你的印象？",
  ],
  [
    /盔甲|铠甲|gorget|armou?r/i,
    "题名涉及铠甲。比较金属的坚硬边缘与脸部、衣料的柔软过渡，再看装备如何影响人物的姿态与画面的重量感。",
  ],
  [
    /羽毛|feather|plumed/i,
    "从题名提到的羽饰开始，比较它与头部轮廓的方向。这个细节怎样打破或延续人物姿态的线条，又如何引导视线回到面部？",
  ],
  [
    /手套|gloves/i,
    "题名提到手套。观察手套是被穿戴、拿着还是放在近旁，再比较它与手部动作的关系；这个小物件如何改变肖像的仪态？",
  ],
  [
    /扇|fan\b/i,
    "留意题名中的扇子与手的关系，再比较它的方向和人物的身体朝向。小小的物件是否在近乎静止的姿态中带来转折？",
  ],
  [
    /f[uou]r|皮毛|裘|毛皮/i,
    "从题名提到的皮毛衣饰入手，比较它与皮肤、底层织物的不同边缘。画家用了哪些明暗与笔触，让不同材质在相近色调中仍能被区分？",
  ],
  [
    /烛|燭|candle/i,
    "题名提到烛光。先找光源与受光面，再看亮处如何逐渐过渡到黑暗。哪些物体只露出部分，使你需要在想象中补全？",
  ],
  [
    /镜|鏡|mirror/i,
    "题名提到镜子。比较镜中与镜外能看到的信息，观察反射是否让同一人物或物件出现多个角度；观者因此比画中人多知道或少知道什么？",
  ],
  [
    /窗|window/i,
    "题名涉及窗边。把窗框看作画中另一道边界，观察人物、室内和外部光线怎样相遇；靠近边界会让人物显得接近观者，还是与观者隔开？",
  ],
];

export async function enrichArtworkGuides(artworks, artists) {
  const [contexts, subjects, people, factFile] = await Promise.all([
    read("contexts.json"),
    read("subjects.json"),
    read("people.json"),
    read("work-facts.json"),
  ]);
  const files = (await fs.readdir(root)).sort();
  const overrides = {};
  const corrections = {};
  for (const file of files.filter((file) => file.endsWith("-overrides.json"))) {
    for (const [id, guide] of Object.entries(await read(file))) {
      assert.ok(!overrides[id], `Duplicate guide: ${id}`);
      overrides[id] = guide;
    }
  }
  for (const file of files.filter(
    (file) => file.startsWith("catalog-corrections-") && file.endsWith(".json"),
  )) {
    for (const [id, correction] of Object.entries(await read(file))) {
      assert.ok(!corrections[id], `Duplicate catalog correction: ${id}`);
      corrections[id] = correction;
    }
  }
  const ids = new Set(artworks.map((w) => w.id));
  for (const id of [...Object.keys(overrides), ...Object.keys(corrections)])
    assert.ok(ids.has(id), `Unknown guide/correction: ${id}`);

  return artworks.map((original) => {
    const correction = corrections[original.id];
    const work = correction
      ? {
          ...original,
          ...(correction.title ? { title: correction.title } : {}),
          ...(correction.dateLabel ? { dateLabel: correction.dateLabel } : {}),
          ...(correction.medium ? { medium: correction.medium } : {}),
          sourceUrl: correction.sourceUrl,
          note: [original.note, correction.note].filter(Boolean).join(" "),
        }
      : original;
    if (overrides[work.id]) return { ...work, guide: overrides[work.id] };
    if (work.guide) return work;
    const facts = factFile.records[work.id] ?? {};
    const artist = artists.find((artist) => artist.id === work.artistIds[0]);
    const context = contexts[artist?.id] ?? contexts[artist?.periodId];
    const genre = genres[genreFor(work, facts)];
    const title = `${work.title} ${facts.originalTitle ?? ""}`;
    // Exact subject IDs win. For records without a topic, longest title match
    // avoids e.g. "Flight into Egypt" hiding "Rest on the Flight into Egypt".
    const explicitSubject = (facts.mainSubjects ?? [])
      .map((id) => subjects[id])
      .find(Boolean);
    const patternMatch = /portrait|肖像|自画|自畫|\?|？|possibly|perhaps/i.test(
      title,
    )
      ? undefined
      : Object.values(subjects)
          .flatMap((subject) =>
            subject.patterns
              .filter((pattern) =>
                title.toLowerCase().includes(pattern.toLowerCase()),
              )
              .map((pattern) => ({ subject, length: pattern.length })),
          )
          .sort((a, b) => b.length - a.length)[0]?.subject;
    const exactSubject = Object.values(subjects).find((s) =>
      s.exactTitles?.some((t) =>
        [work.title, facts.originalTitle].some(
          (name) => name?.toLowerCase() === t.toLowerCase(),
        ),
      ),
    );
    const subject = explicitSubject ?? exactSubject ?? patternMatch;
    const person = (facts.mainSubjects ?? [])
      .map((id) => people[id])
      .find(Boolean);
    const sources = [{ label: "本作编目资料", url: work.sourceUrl }];
    if (
      facts.wikidataId &&
      work.sourceUrl !== `https://www.wikidata.org/wiki/${facts.wikidataId}`
    )
      sources.push({
        label: "本作题材与尺寸索引（Wikidata）",
        url: `https://www.wikidata.org/wiki/${facts.wikidataId}`,
      });
    if (context) sources.push(context.source);
    if (subject) sources.push(subject.source);
    if (person && !subject) sources.push(person.source);
    const hasDescription = !/相关绘画。/.test(work.description);
    let background = `《${work.title}》的现有编目将年代记为${work.dateLabel}，媒材为${work.medium}。`;
    if (hasDescription) background += work.description;
    if (context) background += context.text;
    if (!context && !hasDescription)
      background +=
        "这两条信息帮助我们把屏幕中的图像放回一件具体作品：它有自己的制作时代和物质条件，而不只是一个可以任意替换的题名。";
    const story = subject
      ? subject.story
      : person
        ? `题材索引关联的人物是${person.name}，其人物资料记载的身份为${person.role}。这一背景可以帮助理解画中服饰、仪态与社会角色的关系；如果本作题名或编目对身份保留疑问，这种关联也应作为一种辨识线索。${genre.story}`
        : genre.story;
    const looking = [subject?.looking ?? genre.looking[0]];
    const cue = detailCues.find(([pattern]) => pattern.test(title));
    looking.push(cue?.[1] ?? genre.looking[1]);
    if (facts.heightCm && facts.widthCm)
      looking.push(
        `索引所列画幅约高${facts.heightCm}、宽${facts.widthCm}厘米。试着按这个实际大小想象观看距离，再从全幅回到局部，比较构图在远看与近看时分别突出什么。`,
      );
    else if (context) looking.push(context.looking);
    if (work.imageStatus === "unavailable")
      looking.unshift(
        "本条目目前没有可核实的完整图像。以下提示是依据题材提出的观看方向，可在来源中的可靠图像上对照；不据缺失的图像判断具体笔触或细节。",
      );
    const uniqueSources = [...new Map(sources.map((s) => [s.url, s])).values()];
    return {
      ...work,
      guide: {
        background,
        story,
        looking,
        scope: "contextual",
        scopeNote:
          "本作的具体创作缘起仍待进一步核实，以下结合编目资料与题材提供背景导读。",
        sources: uniqueSources,
      },
    };
  });
}
