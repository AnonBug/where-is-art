# 六位画家 OSS 目录导入

导入日期：2026-11-13。用户确认按所提供 CSV 的六位画家全部更新。

| 画家 | 目录记录 | 可浏览 | 暂缺图像 | 复用已有 ID |
| --- | ---: | ---: | ---: | ---: |
| 拉斐尔 | 233 | 194 | 39 | 4 |
| 爱德华·马奈 | 397 | 384 | 13 | 4 |
| 克洛德·莫奈 | 2,052 | 2,024 | 28 | 6 |
| 文森特·梵高 | 968 | 961 | 7 | 6 |
| 保罗·高更 | 607 | 597 | 10 | 4 |
| 皮特·蒙德里安 | 971 | 576 | 395 | 7 |
| 合计 | 5,228 | 4,736 | 492 | 31 |

本次新增 5,197 条作品和 4,705 张主图。项目合计 6,130 条作品记录、5,875 张图像（包括既有局部图），图像张数不等于独立作品数。缺少图像的记录保留在目录数据中，按既有规则不出现在普通列表和地图；补图后可以继续使用相同 ID。

## 内容边界

- `content/imports/oss-catalog-2026-11-13.csv` 是用户 CSV 的原样副本，SHA-256 保存在 `content/oss-import-research.json`。来源标题、年代、媒材、目录编号、馆藏号、Wikidata 修订号、收藏索引、状态及说明均保留。计数按 CSV 的稳定作品 ID，不声称进行了新的作品全集研究。
- 31 条既有作品继续使用原来的资料、图像、馆藏关系和逐件导读。导入会校验这些作品的 OSS URL 与文件哈希一致，避免悄悄替换现有图片。收藏保存在浏览器中的作品 ID 继续有效。
- CSV 没有提供导读正文。新增记录的导读仅整理已知编目信息和通用观看提示，明确标记 `contextual`；不因画家身份或标题猜测具体人物、画面细节、委托背景，也不将蒙德里安早期具象作品一概当作抽象画。
- `cleared`、`review-required`、许可地址和署名按用户 CSV 保留。图像身份待核、许可待核或无链接的记录不会生成虚假的可用图片。参考图保持 `reference`，不冒充原画全图。
- 收藏关系按 CSV 的原始名称保存。Wikidata 机构实体与别名仅用于核对名称和机构参考坐标；存在多重收藏声明、私人收藏、毁失失窃说明或无法明确定位时不在地图标点。地图标示收藏机构，不代表实时展出或当前所在地。

## 图片与校验

新增媒体直接引用用户提供的 OSS 对象；保留项目原有相对路径和 `VITE_ASSET_BASE_URL` 配置。未再次上传或覆盖 OSS 图片，未把图片二进制文件加入 Git 或站点构建。

`scripts/probe-oss-catalog.mjs` 默认逐个使用匿名 HEAD 检查 HTTP、Content-Type、字节数、Content-MD5 与 OSS ETag，通过 `image/info` 获取像素尺寸，不下载图片正文。MD5 从 `Content-MD5` 的 Base64 值解码，并与 ETag 对照；缺少该响应头或不一致会停止，不把不透明 ETag 直接当成 MD5。结果缓存于忽略目录 `output/oss-catalog-import/media-probes.jsonl`，可在中断后继续。

本次对 8,021 个文件进行了完整 GET 和 SHA-256、MD5 校验，随后停止完整下载，剩余 6,187 个文件采用上述元数据检查。媒体索引明确区分两种证据：`sha256` 非空的文件已下载计算哈希；`sha256` 为空且 `verification: oss-content-md5` 的文件只记录元数据和服务端提供的 MD5，没有声称重新计算过 SHA-256。已有 SHA-256 证据不降级。需要全量重算时可显式添加 `--full`，该模式会产生图片下载流量。

CSV 没有原始下载链接和原件完整 SHA-256；新增媒体的 `sourceImageUrl`、`sourceHash` 保留为空。网页交付文件已有的哈希和 ETag/MD5 分别存入 `thumbnail`、`preview`、`delivery` 和媒体索引，不将 URL 中的版本前缀当成已验证的原件哈希。恢复图片到本地时仍核对文件大小及 MD5，有 SHA-256 时一并核对；不匹配即停止，不覆盖本地文件。

## 复现

在项目根目录安装现有依赖后运行：

```sh
node scripts/probe-oss-catalog.mjs content/imports/oss-catalog-2026-11-13.csv
node scripts/collect-oss-venues.mjs content/imports/oss-catalog-2026-11-13.csv
node scripts/import-oss-catalog.mjs content/imports/oss-catalog-2026-11-13.csv
npm run content:build
npm test
npm run media:check
npm run build
```

前两个步骤需要网络；机构查询尊重 Wikidata 限流并缓存返回数据。生成的目录、媒体清单和研究索引随仓库保存，日常开发、测试和构建不需要重复联网查询。重新查询机构可能获得更新的索引，应审阅差异后再接受；原 CSV 修订号和说明不会被替换。

重复导入会替换本批输出并保留其他内容，不会累计重复作品。导入结束还需运行 `content:build`，让 `public/catalog.json` 与内容源一致。媒体离线校验仍检查所有文件索引，不要求本机保存数 GB 图片。
