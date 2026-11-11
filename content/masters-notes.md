# 提香与伦勃朗作品扩充（2026-11-12）

这是可追溯的公开绘画索引扩充，不是宣称学界已有一致定论的“亲笔全集”。传作、合作、工作室参与和争议归属会在每幅作品的说明中标明；不纳入素描、独立蚀刻版画、单纯系列总览与重复局部。原作毁失时，参考图明确注明其性质。

## 范围与核对

- 伦勃朗：以 [公开绘画清单固定版本](https://en.wikipedia.org/w/index.php?oldid=1363801179) 的 348 行为起点，保留 RRP 目录编号、配对作品及归属差异。另补 [荷兰国立博物馆于 2023 年确认的两幅小肖像](https://www.rijksmuseum.nl/en/press/press-releases/rediscovered-rembrandt-portraits-go-to-rijksmuseum)。清单已包含 [2026 年确认的《撒迦利亚在圣殿中的异象》](https://www.rijksmuseum.nl/en/press/press-releases/rijksmuseum-researchers-discover-new-painting-by-rembrandt-van-rijn)，因此只计一次，共 350 条。
- 提香：[公开作品清单固定版本](https://en.wikipedia.org/w/index.php?oldid=1383216026) 明确是未完备列表，不能直接当作全集。在它的 164 行之外，补充 Wikidata 中现行作者声明为提香、类型为绘画的馆藏记录。过滤已撤销归属、仿作、追随者和纯工作室声明；合作作品按具体证据保留。164 行均在 `masters-coverage.json` 有去向：159 行对应独立作品或其重复图，3 行因归属限定排除，2 行是系列总览。加上额外馆藏记录，共 376 条，其中 369 条可浏览、7 条暂无核实可用的图像。
- 研究目录会修订。尤其提香的开放索引含多种版本、合作与传作，其数量不能与只统计确定亲笔作品的学术著录直接比较。无可靠中文题名时保留原题；不根据画面猜测人物身份、年代或收藏地点。

每条记录的 Wikidata QID、读取时修订号、原题、目录行号、归属限定、收藏关系和排除原因保存在 `masters-research.json`；逐行覆盖证据保存在 `masters-coverage.json`。Wikidata 元数据为 CC0；Wikipedia 清单引用遵循 CC BY-SA 4.0，未复制作品评论段落。

## 已处理的辨识问题

- RRP 58 / 82 已分离：既有 `rembrandt-gold-chain` 保留芝加哥艺术博物馆 1631 年作品（RRP 58，83.1 × 75.7 cm）；重复 `rembrandt-rrp-58` 合并至该原有 ID。卡塞尔 GK 233 的 1632 年老人习作（RRP 82，59.3 × 49.3 cm）恢复为 `rembrandt-rrp-82`。馆方现列伦勃朗本人，历史归属争议保留在说明中。两者使用各自图像与馆藏来源，原 OSS 对象不删除。依据：[芝加哥馆藏](https://www.artic.edu/artworks/95998/old-man-with-a-gold-chain)、[卡塞尔馆藏](https://datenbank.museum-kassel.de/33757/)、[2025 年技术研究](https://www.amjournal.org/publications/123)。
- 《阿韦罗尔迪多联祭坛画》及其中央面板使用同一个作品 ID，不重复计数。
- “维纳斯与阿多尼斯”系列总条目不作为另一幅作品；有独立馆藏证据的版本分别保留。
- 佩萨罗祭坛画原 P18 照片拍的是修复期间陈列的复制品，改用 [原画扫描](https://commons.wikimedia.org/wiki/File:Tizian_039_(2).jpg)。
- 荷兰国立博物馆的 SK-A-595《忏悔的抹大拉》明确是据艾尔米塔什原作的复制品，排除该记录。
- 《马尔斯、维纳斯与丘比特》按 [维也纳艺术史博物馆展览图录第 95 项](https://press.khm.at/fileadmin/content/KHM/Presse/2021/Tizian/Tizian_Booklet_DE_f.pdf) 保留，标明提香及工作室参与。
- 《圣彼得殉道者之死》原画焚毁，现有图像为马蒂诺·罗塔的版画参考；标记 `role: reference`，不冒充原画照片。
- 收藏地点不确定、私人收藏或跨地点收藏体系不制造地图坐标；国民信托、英国王室收藏、巴伐利亚国家绘画收藏和德累斯顿国家艺术收藏等机构总部不能冒充具体画作位置。已知机构坐标也不代表实时展出。

## 图片与维护

`masters-sources.json` 逐图记录来源页、原图 URL、下载版本、原图 SHA-1、下载 SHA-256、署名和许可。`masters-media-manifest.json` 记录三档派生图及其哈希。公开领域与 CC 许可分别保留；CC BY-SA 图片的派生版本沿用同一许可，署名中说明缩放、格式转换与缩略图裁切。

```sh
npm run media:masters -- '/原始下载缓存目录'
npm run media:index
npm run content:build
npm run media:check
npm test
npm run build
```

`media:masters` 可从记录中的 URL 恢复源文件，下载后必须通过固定 SHA-256 才会处理；不放大原图。缩略图为最长 320 像素的方形裁切，预览最长边 1280 像素，完整图最长边 3840 像素。原图较小的作品维持原分辨率。

派生图位于 `media/masters/<作品ID>/<源文件SHA-256前12位>/`，保留已有 8 幅作品原路径。更改处理参数时应使用新的版本路径，避免覆盖已发布的不同内容。上传使用 OAuth Profile `halfbvg-assets` 和 `aliyun ossutil cp`，逐文件比较内容，使用 `--ignore-existing` 防止覆盖；图片缓存为 `public,max-age=3600`。核验包含远端字节数、ETag/MD5，以及匿名 HTTPS GET 的 SHA-256。未删除旧对象或更改 Bucket 设置。

目录 JSON 随应用版本发布，图片从 OSS 加载。本次扩充纳入 4.2.0 版，使用仓库现有的 GitHub Pages 工作流：推送 `main` 后，通过目录重建、测试、媒体清单校验和构建，再发布站点。
