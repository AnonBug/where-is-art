# 名画在哪里

React + TypeScript 的名画收藏地图，采用 Sass Modules、MapLibre GL JS 和 OpenSeadragon。当前共 6,130 条作品记录、5,875 张图像。2026-11-13 按用户提供的 OSS 目录扩充拉斐尔、马奈、莫奈、梵高、高更与蒙德里安，新增 5,197 条记录并复用已有 31 条。六位画家共 4,736 条可浏览、492 条暂缺图像；未将公开目录中的合作、传作、争议归属或未核验记录宣称为确定的亲笔全集。详见 [本次 OSS 导入说明](docs/OSS作品导入.md) 与 [提香、伦勃朗收录范围](content/masters-notes.md)。开发目录沿用「达·芬奇名画地图」。

[在线浏览](https://anonbug.github.io/where-is-art/) · [GitHub 仓库](https://github.com/AnonBug/where-is-art)

作品信息提供「背景、人物与题材、怎么看这幅画」三部分导读。大图浏览的信息面板直接显示文字，手机竖屏最多占 74% 视口高度；收藏位置说明、参考资料、图像署名及版权默认折叠在「来源与版权」中。普通作品详情仍保留预览图。

4.3.1 加入本地收藏：作品信息和大图工具栏均可收藏／取消收藏，目录「收藏」按最近收藏排列，也可查看收藏作品的地图分布。收藏只保存在当前浏览器，不需要账号，不上传到服务器；刷新后保留，清除网站数据会移除，设备之间不自动同步。兼容旧版收藏，浏览器拒绝保存时会提示仅本次打开有效。

4.3.0 为全部 933 条记录加入导读：349 条按具体作品资料整理（提香 80、伦勃朗 90、其他画家 179），另 584 条明确标为背景导读。后者结合已知编目、题材文献与观看提示，不表示每件作品的委托、人物身份或创作缘起均已查明。参考来源保存在每篇导读中；馆方目录、研究和图像中的不确定性仍保留。

> 2026-10-31 底图更新：采用按视野切换的双源方案。世界概览、中国及周边视野使用天地图；完全进入海外的近景使用 OpenFreeMap 青绿矢量地图。浏览器端 Key 已验证，南海断续线和藏南官方边界已可见，巴黎高倍率街道恢复显示。正式地图内容、审图信息与服务条款仍需完整验收，浏览器测试不替代这些工作。

官方依据与接入入口：[天地图地图服务文档](https://lbs.tianditu.gov.cn/server/MapService.html)、[自然资源部标准地图服务系统](https://bzdt.ch.mnr.gov.cn/)、[自然资源部天地图建设方案](https://app.www.gov.cn/govdata/gov/202403/13/512938/article.html)。天地图文档列出 `vec_w` 底图、`cva_w` 注记和 `ibo_w` 全球境界服务，支持 HTTPS 与 WMTS。采用标准成图瓦片时，不能沿用当前矢量样式的逐要素调色方式；青绿视觉须以边界和标注完整可读为前提。

## 启动与构建

使用 Node.js 24（`.nvmrc`），最低 22.12。

```sh
npm ci
cp .env.example .env.local  # 仅首次配置；不要覆盖已有文件
# 在 .env.local 填写 VITE_TIANDITU_KEY，必须使用天地图“浏览器端”Key
npm run dev
```

`.env.local` 已被 Git 忽略。网页直接访问天地图，`VITE_` 变量会进入浏览器代码，不能用于保存服务器端私密凭据。请在天地图控制台按其规则配置开发和正式网站允许的域名。缺少 Key、授权类型错误或请求失败时显示提示及作品入口；中国相关视野不会因天地图失败而改用 OpenFreeMap。

访问 http://127.0.0.1:8775/ 。开发支持热更新，Ctrl+C 停止。端口已占用会报错，可显式指定 `npm run dev -- --port 8776`。

```sh
npm test               # 内容契约、关系去重、桌面/手机导航与旧数据兼容
npm run typecheck      # TypeScript
npm run media:check    # 离线校验媒体清单、目录引用、文件大小/哈希及完整瓦片层级
npm run build          # 主题生成、类型检查、静态构建及发布体积检查 → dist/
npm run preview        # 预览 dist/，与 dev 使用同一端口
```

`dist/` 可重新生成，不提交到 Git。当前没有服务端、账号或数据库。4.5.0 起目录与作品详情从 OSS 独立加载，网站代码仍部署在 GitHub Pages。地图通过 HTTPS 请求天地图 `vec_w`、`ibo_w`、`cva_w`，使用球面墨卡托 WMTS（1—18 级、256 px PNG）。这些是已绘制的成图瓦片，不是可逐要素改色的 MVT/PBF。

### 渐进式内容加载

首屏从 `VITE_CONTENT_BASE_URL` 请求很小的 `current.json`，锁定 `releases/<内容哈希>/catalog-index.json`。索引包含画家、专题、作品标题、主图缩略图路径及地图馆藏关系，不包含导读、完整图片地址和许可等详情。打开作品信息或看画器时，再请求该版本内的 `artwork-details/<内容哈希>/<作品ID>.json`。同一作品的并发请求合并，最近 40 件详情保存在会话内存中；返回目录、切换专题或显示收藏不触发详情预取。加载失败可以单独重试；切换作品后忽略旧请求的结果。

当前 6,130 件作品的首屏 JSON 约 1.95 MB（本地 gzip 测算约 294 KB），相比完整目录的 19.85 MB 减少约 90%；每件详情中位约 2.9 KB。作品数量、地图位置、收藏 ID 和来源资料均保留，原始图片质量与像素尺寸不受影响。`public/catalog.json` 继续作为完整内容输出和维护校验依据，当前前端不请求它。

`scripts/build-content-delivery.mjs` 生成摘要和逐件详情，并以完整目录与交付格式的内容哈希隔离版本；生成物不提交 Git。`content:build`、`dev`、`test`、`build` 都会自动生成，干净检出无需联网或下载图片。默认生产包不包含完整目录、索引和详情 JSON。OSS 的版本文件使用 gzip 与一年不可变缓存，入口使用 `no-cache`；已打开页面固定使用同一版本，新打开页面读取最新入口。旧版本不自动删除，避免内容更新影响仍在浏览的页面。

### 发布和维护 OSS 内容

可编辑源数据仍在仓库 `content/`，`public/catalog.json` 是可复现的完整输出；OSS 是浏览器实际读取的发布副本。内容只改文字或馆藏关系时，发布 OSS 即可生效，无需重新部署网页。结构变化须同步升级代码与内容格式，当前支持 `schemaVersion: 1`。

```sh
npm run content:build
VITE_CONTENT_BASE_URL= npm run dev   # 本地预览尚未发布的内容
npm test
npm run content:prepare             # 只生成发布文件，不上传
npm run content:publish             # 使用本机已登录的 aliyun ossutil
npm run content:check:remote        # 验证当前版本和 CORS
```

发布脚本先把 6,133 个 gzip JSON 上传到新版本目录（6,130 份详情、索引、完整目录、图片映射），逐个用 HEAD 验证大小、ETag/MD5、编码和缓存；再检查 JSON 解码与 CORS，最后更新 `current.json`。不需要重新上传或下载画作。脚本使用当前阿里云 CLI 登录，不把凭据写入代码、前端或 GitHub。重复执行跳过已存在文件，但仍核对全部文件；发生不一致时停止，不覆盖不可变版本。维护约定为单一发布者，避免多台机器同时切换入口。

`current.json` 提供 `index`、`catalog`、`images` 三个相对路径。`image-manifest.json` 维护作品 ID → 图像 ID → 缩略图、预览、大图／瓦片的映射，同时保留现有来源地址、已知来源哈希和许可。`sourceImageUrl` 只是已记录的来源图地址，不保证是最高分辨率，也不表示已有独立 OSS 原始图归档；缺失的原始图信息不编造。

更新前的入口会备份到本地忽略目录 `output/content-release/previous-current-*.json`；回退时将所需备份重新上传为 OSS 的 `current.json`，使用 `Content-Type: application/json; charset=utf-8` 与 `Cache-Control: no-cache,max-age=0,must-revalidate`，随后运行远程检查。旧版本目录保留，可从完整目录和图片映射恢复已发布资料。GitHub Pages 发布流程会验证 OSS 当前版本与本次构建一致，防止代码先上线而内容尚未上传。

海外近景按资源基础地址加载 `map-style.json`，再请求 OpenFreeMap 矢量瓦片、字体与图标。切换由 `regionalBasemap.ts` 集中控制：zoom ≤ 5 始终使用天地图；达到 5.5 且整个视野离开保守范围后才进入 OpenFreeMap。经度 70°—140°、纬度 0°—56° 是切换保护框，另加 3° 的进入缓冲，不是行政边界，也不绘制在地图上，因此部分邻近地区仍使用天地图。依据视野而非画家分类决定来源；切换替换整张底图，不拼接两套国界，不改变馆藏点坐标。

## 静态资源地址（OSS / 本地）

应用路由及 JS/CSS 构建产物仍由 `PAGES_BASE_PATH`（Vite `base`）控制。`VITE_ASSET_BASE_URL` 控制图片、缩略图、预览、DZI/瓦片、地图样式 JSON 和品牌图；`VITE_CONTENT_BASE_URL` 单独控制版本入口与目录资料，当前为同一 OSS 前缀下的 `content/`。第三方地图服务及馆方来源链接保持原地址。

- 开发和生产构建默认读取随项目维护的 `.env`，当前使用 `https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/`。
- `.env.local` 可以覆盖默认地址；恢复本地媒体后将 `VITE_ASSET_BASE_URL` 留空，即使用本地 `public/`，自动跟随应用子路径。干净克隆不包含图片，不设置覆盖即可使用 OSS。
- Vite 在构建时写入此配置；修改后需重启开发服务或重新构建。`.env.local` 可用于本机覆盖，shell 环境变量优先于所有 `.env` 文件。

```sh
# OSS + GitHub Pages 子路径（使用 .env）
PAGES_BASE_PATH=/where-is-art/ npm run build

# 本地资源 + GitHub Pages 子路径（先恢复媒体，显式空值覆盖 .env）
VITE_ASSET_BASE_URL= VITE_CONTENT_BASE_URL= PAGES_BASE_PATH=/where-is-art/ npm run build

# 根路径、本地资源开发（先恢复媒体）
VITE_ASSET_BASE_URL= VITE_CONTENT_BASE_URL= npm run dev
```

地址必须对应 `public/` 的内容根目录，URL 不含 `public/`。JSON 继续保存 `assets/mona.jpg`、`media/…/detail.dzi` 等相对路径，不要再加 `where-is-art/`。统一的 `assetUrl()` 在加载入口处理首尾斜杠并保留已有绝对 URL；旧版入口仅转换图像的 `path` 字段。OpenSeadragon 根据 DZI 的完整 URL 寻找同目录 `detail_files/<level>/<x>_<y>.jpeg`，因此整套 DZI 与瓦片须保留相对目录结构。查看器使用匿名 CORS，以支持跨域图像和画布读取。

图片、缩略图、Logo、DZI 及瓦片由 OSS 托管，不再随 Git 或默认发布包保存。`public/` 保留完整目录源输出、旧版数据和地图样式 JSON；`content/media-index.json` 保留全部媒体路径、字节数、SHA-256 和 MD5，用于校验及恢复。媒体生成、恢复后的本地文件被 `.gitignore` 排除；本地资源模式需先恢复文件。新增或更改资源后，应先同步到 OSS（包括重新生成的 `map-style.json`；作品内容通过 `content:publish` 发布），再上线对应代码。不会对缺失资源静默改用其他图片。

OSS 默认域名的 `Content-Disposition: attachment` 不作为图片不可用的判断依据，以实际图片解码、JSON/DZI 请求及画布绘制为准。本地 OSS 验证使用已允许的 `http://127.0.0.1:8775` 或 `http://localhost:8775`；不要通过关闭浏览器安全检查来绕过 CORS。

未来自定义资源域名就绪后，将 `.env` 中的值改为 `https://assets.halfbvg.com/where-is-art/`（开发覆盖配置同步替换），重新构建并验证后再发布；无需修改组件或 `PAGES_BASE_PATH`。域名启用前继续使用 OSS 默认地址；资源地址配置本身不修改 DNS、OSS 权限或云端文件。

### 本地媒体与维护命令

```sh
npm run media:check         # 无网络、无本地图片依赖；CI 使用此命令
npm run media:check:remote  # 只读检查 OSS 的全部媒体，HEAD 元数据不足时 GET 校验
npm run media:restore       # 可选：从 OSS 恢复全部媒体到被忽略的 public/ 路径
# 或从已有缓存恢复，缓存根目录包含 assets/、brand/、media/
npm run media:restore -- --from '/本地资源缓存目录'
# 只恢复一组资源，例如 Logo
npm run media:restore -- --prefix brand/
npm run media:check:local   # 恢复完整媒体后：全部 SHA-256 + 原有解码/尺寸/来源检查
VITE_ASSET_BASE_URL= npm run dev
```

恢复时验证大小和 SHA-256，已有文件必须哈希一致，不覆盖本地修改。仅编辑作品文字或目录时，`content:build` 只合并 JSON，不读取或重编码图片。需要重新生成达·芬奇缩略图时，先恢复 `assets/` 图片，再显式运行 `npm run media:legacy`。生成其他新媒体后，恢复完整媒体树，运行 `npm run media:index` 更新文件清单，再运行 `content:build`、`media:check` 和 `media:check:local`。索引生成器会拒绝从不完整的本地副本重建清单，以免丢失已有远端条目。

媒体清单校验不等同于实际文件解码或远端核验。CI 从干净检出重建目录并检查无差异，执行数据/引用/瓦片层级校验及测试构建；媒体维护时显式执行完整本地检查，发布新增媒体前执行远端检查。默认 OSS 模式不把媒体、完整作品目录和逐件详情复制进网站发布包，只保留旧版兼容数据和地图样式等小文件；同时清空两个 OSS 配置的本地模式仍复制完整 `public/`。

本次使用普通删除提交，旧图片仍存在于 Git 历史中，未改写历史或强制推送。需要轻量克隆时使用：

```sh
git clone --depth 1 https://github.com/AnonBug/where-is-art.git
```

## 当前交互

- 桌面：左侧中国／外国／专题目录，右侧地图。天地图保留官方原始配色，海外 OpenFreeMap、页面及馆藏标记沿用青绿主题。单独馆点立即展示代表作缩略图；点击馆名或圆点后地图居中至 9 级城市视图，并在该点上方展开当前范围内的全部作品。手动放大至 9 级及以上时，视野内未聚合的馆点也自动展开作品；缩小至 8 级及以下时收起，8～9 级之间保持原状态。专题作品行只定位；地图缩略图打开作品信息，详情临时叠加在地图上。
- 看画时点击信息按钮打开浮层，保留背后的画作和当前缩放位置。点击、拖动或滚轮操作地图／画作会立即收起信息，并继续完成同一次操作；浮层内部点击和滚动不触发收起。关闭按钮与 Escape 仍可使用。只有地图上的作品信息提供“放大欣赏”，看画中的信息不再重复提供此入口。手机竖屏采用底部浮层，横屏采用右侧浮层。
- 手机：目录、地图、看画独立占满屏幕；用户自行旋转设备时，当前场景与布局随屏幕尺寸自动适配，不提供方向切换按钮，也不锁定方向或请求系统全屏。
- 看画：整图保持原始比例，支持拖动、缩放、还原；长卷的馆方高清局部可单独选择。返回时在当前会话内恢复列表滚动、地图位置和看画视口；刷新后保留 URL 中的作品与范围，不保证恢复临时缩放状态。
- 大图浏览时单击画布隐藏标题、工具栏和其他信息，再次单击恢复，画面位置与缩放保持不变。拖动、双击放大和双指缩放不会误触清屏；清屏时也可按 Escape 或 Tab 恢复操作按钮。多图选择列表在按下画布、滚轮缩放或键盘操作画布时立即收起，列表内滚动与选图保持正常。
- 看画时先用预览图提供拖动和缩放，高清整图或瓦片在后台逐步覆盖；加载完成保留当前视角，不显示等待高清细节的提示。高清资源失败时仍可操作预览图。
- 看画缩放百分比以适应窗口为 100%；任何清晰度都至少可放大到 400%，高清作品保留更高的原有上限。窗口尺寸变化后同步更新上限，低清图不会因像素少而提前限制放大。
- 大图右上角和作品信息预览图左下角提供下载图标：普通图片下载站内完整图像文件；DZI 作品下载完整低清预览，不下载瓦片或当前视口截图。选择局部或参考图时，两处入口都对应当前图像，并在文件名和按钮提示中说明。
- 收藏地点未核实的作品仍可看画，不创建虚构坐标。机构位置不表示实时展出。
- 藏品较多时，馆点的缩略图网格内部独立滚动，不触发地图缩放。直接打开画家地图或看画链接时，目录同步到对应分类、时期和画家；窄侧栏的长时期名称与年代分行展示。
- 多个收藏地聚合时，数字圈上方仍显示一张作品缩略图，优先显示当前选中的有图作品，否则显示聚合内第一幅有图作品。点图查看作品信息，点数字圈放大展开收藏地。
- 画家条目显示可浏览作品数量；合作作品在关联画家下分别计数，多张图和多条收藏关系不重复计数。
- 暂无已核实可用画源的 14 条记录保留在资料中，地图、作品列表和专题中隐藏，数量只统计可看画的作品；当前可浏览 919 幅。有局部参考图的作品仍显示，补齐画源后自动恢复展示。仅关联无图作品的馆点也不显示。

主要深链接（Hash 路由适配 GitHub Pages）：

```text
#/catalog/china?scope=category:china
#/catalog/foreign?scope=category:foreign
#/topics/landscape?scope=topic:landscape
#/map?scope=artist:tang-yin
#/artworks/tang-yin-02?scope=artist:tang-yin
#/artworks/tang-yin-02/view?scope=artist:tang-yin
#/artworks/tang-yin-11/view?scope=artist:tang-yin&asset=tang-yin-11-detail-05
```

旧版 `#work=mona` 与 `?collection=leonardo` 入口保留兼容。

## 代码边界

```text
src/
  main.tsx                    HashRouter 与入口
  app/                        场景组合、路由和返回逻辑
  domain/atlas.ts              Zod 数据契约、关系校验、范围与去重选择器
  application/session.ts      Zustand 会话状态（列表、地图、看画）
  infrastructure/useContent.ts 内容加载与重试
  infrastructure/tianditu.ts   天地图 WMTS 地址、来源、缩放及署名
  infrastructure/regionalBasemap.ts 视野策略、异步样式切换与销毁
  platform/usePlatform.ts     响应式、横竖屏与全屏能力
  features/catalog/           分类目录和作品列表
  features/map/               MapLibre 实例、馆藏聚合与标记
  features/artworks/          作品信息
  features/viewer/            OpenSeadragon 看画器
  shared/                     图标、按钮、图像占位
  styles/                     全局基础样式与颜色 token
content/
  tang-catalog.json            唐寅作品和馆藏依据
  media-manifest.json          唐寅图片尺寸、投递方式、来源与使用信息
  tang-expansion-catalog.json  王维、阎立本的38条记录与馆藏
  tang-expansion-sources.json  生平、归属、尺寸、文献与265张原图来源
  tang-expansion-media-manifest.json  网页整图、瓦片及哈希
  wu-daozi-catalog.json        两幅吴道子传名长卷、画家和馆藏
  wu-daozi-sources.json        归属依据、原图下载地址和 SHA-256
  wu-daozi-media-manifest.json 原始分辨率瓦片与全文件哈希
  foreign-catalog.json         新增西方画家、作品、馆藏和专题
  foreign-sources.json         下载地址、来源证据与源文件 SHA-256
  foreign-media-manifest.json  网页衍生图的尺寸、体积、哈希与署名
  masters-catalog.json         提香与伦勃朗新增作品、馆藏与归属说明
  masters-sources.json         逐图来源、许可、下载与 SHA-256
  masters-media-manifest.json  新增缩略图、预览、完整图与哈希
  masters-research.json        逐件研究证据、修订号和排除理由
  masters-coverage.json        固定版本公开清单的逐行去向
  masters-notes.md             收录范围、辨识修正和维护说明
  artwork-guides/              逐件解读、题材背景、人物与尺寸依据及编目修正
  map-style-base.json          OpenFreeMap Liberty 原始样式
scripts/
  build-catalog.mjs            合并唐寅、既有达·芬奇和新增西方绘画数据
  build-artwork-guides.mjs     离线合并逐件解读与明确标注的背景导读
  build-theme.mjs              单一配色源 → Sass 变量和地图样式
  prepare-media.mjs            离线生成缩略图、预览、整图或 DZI
  check-media.mjs              验证唐寅交付文件
  prepare-foreign-media.mjs    生成西方绘画缩略图、预览和整图
  prepare-masters-media.mjs    重建提香与伦勃朗的来源固定版本图像
  check-foreign-media.mjs      核对文件哈希、完整解码和来源证据
public/
  catalog.json                生成的前端目录数据
  map-style.json              生成的青绿样式
  brand/logo.png              可选本地 Logo 副本，不进 Git
  media/                      可选本地图像与瓦片，不进 Git
  assets/                     旧图像索引/世界地图 JSON；图片副本不进 Git
```

React 管理界面，MapLibre 和 OpenSeadragon 分别管理自己的画布生命周期。重模块独立懒加载。业务组件使用 `.module.scss`；页面、标记及海外矢量底图的配色集中在 `src/styles/tokens.json`。天地图成图瓦片不应用滤镜或逐层改色。地图署名随当前来源切换。

仓库中 `src/App.tsx`、`src/AtlasExplorer.tsx`、旧 `components/`、`hooks/`、`lib/` 与 `styles/theme.css` 是上一版源码，保留作为迁移参考，本版入口不导入；旧 JSON 仍作为达·芬奇资料来源。此次未清理原有暂存修改或覆盖旧收藏存储。

## 内容与图片维护

用户上传的六位画家目录独立维护在 `content/oss-import-*`，由 `content:build` 合并。原始 CSV、行级索引修订号、图像许可与署名保留；已有作品 ID、精选专题和逐件导读不变。新增作品的导读明确为编目信息与通用观看提示，没有把 CSV 的导读类型字段当作已提供解读正文。复现步骤见 [OSS 作品导入说明](docs/OSS作品导入.md)。

导读维护于 `content/artwork-guides/`，由 `content:build` 离线合入目录，浏览器不会请求生成服务或实时生成解读：

- `*-overrides.json`：以稳定作品 ID 保存核对过的中文解读与来源。每篇含 `background`、`story`、至少两条 `looking` 以及 `sources`。`scope: individual` 表示依据该作品资料整理，不表示归属或人物身份已经没有争议。
- `contexts.json`、`subjects.json`、`people.json`：有来源的画家／时期背景、圣经与神话题材、人物身份。圣经和神话按其文本叙事介绍，不作为创作委托或真实历史的证明。
- `work-facts.json`：2026-11-12 读取的 Wikidata CC0 题材、类型与尺寸数据；只保留明确的厘米尺寸。没有逐件解读的作品采用 `scope: contextual`，页面明确显示具体创作缘起待核实，并结合编目与题材提供观看提示。
- `catalog-corrections-*.json`：来源核对带来的题名、年代、媒材等修正，在构建时合入作品并保留说明。馆方资料优先于旧目录；多版本作品须核对具体馆藏，不借用另一版本的创作故事。

添加或修改导读后运行下方构建与测试。不要在通用题材里写某一画面的专属细节；具体委托、模特身份及人物位置应进入逐件解读，并保存对应来源。资料不足可以明确标注，不用画家生平填补未知的创作故事。

修改 `content/tang-catalog.json`、`content/foreign-catalog.json`、`content/wu-daozi-catalog.json`、`content/tang-expansion-catalog.json`、`content/masters-catalog.json` 或既有 `public/data.json` 后运行：

```sh
npm run content:build
npm test
npm run build
```

新增西方内容的时期与流派、画家和专题在 `content/foreign-catalog.json` 中维护，由 `scripts/build-catalog.mjs` 合并；无需修改 React 组件即可扩充同类数据。作品通过稳定 ID 引用画家；收藏关系独立存储，允许多馆藏关联；专题引用作品 ID，不复制作品记录；全图与高清局部是不同图像资源。

4.5.1 将外国目录明确标为“时期与流派”，说明年代为约略范围、流派之间存在交叉。风格主义的核心时期标为约 1520—1600 年，巴洛克延至 18 世纪中叶，浪漫主义标为 18 世纪末—19 世纪中叶；分类来源见各项 `sourceUrl`。原“象征与新艺术”“表现主义先声”“早期抽象绘画”统一使用“象征主义”“表现主义”“抽象艺术”。画家按主要关联保留原入口，蒙克等先驱也纳入相关流派浏览；这是目录索引，不对每件作品作排他性风格认定。稳定 ID、作品和收藏关系不变。

网页媒体已在 OSS，克隆后默认使用 OSS，无需下载图片即可开发、校验元数据和部署。只有重新转换唐寅原件时需要交接包里的 `test-data/tang-yin/manifest.json`：

```sh
ATLAS_ORIGINAL_ROOT='/原件所在目录' npm run media:prepare -- '/交接包/test-data/tang-yin/manifest.json'
npm run media:index       # 本地需有完整媒体树
npm run content:build
npm run media:check:local
```

唐寅 6 张、传吴道子 2 张、王维与阎立本 11 张图像采用 DZI，共 4,372 张瓦片。普通整图不超过 20,000,000 字节；DZI 只发布缩略图、预览和瓦片，不发布巨幅整图作为回退。瓦片总大小可能超过 20 MB，浏览器只请求当前视野所需层级。普通图和 DZI 共用看画器。

《溪山渔隐图》12 张、《采莲图》5 张高清局部分别关联原始馆方照片，不从低清全卷虚构细节。《吹箫仕女图》仅 423 × 800 像素，保留资料不确定性；界面不显示图像清晰度等级。原始素材在转换前后做 SHA-256 校验，保持不变。

图像来源与署名在作品详情展示；`publicationStatus` 记录素材核验状态。唐寅 4 幅的使用条款仍待确认，达·芬奇沿用素材尚未逐张重新审核。完整记录见 `docs/唐寅内容核验.md` 和 `content/media-manifest.json`。这些状态不会被转换脚本自动当作授权。

## 西方绘画扩充（2026-11-01）

最初新增 33 位画家、16 个时期或风格分组、134 幅作品和“西方绘画之旅”专题；2026-11-02 补入蒙德里安三幅代表作后共 137 幅。28 位画家各 4 幅，杜乔、格里斯各 3 幅，莫奈、梵高各 6 幅，蒙德里安 7 幅；既有唐寅与达·芬奇记录保留。时期是浏览目录，允许年代交叠，不表示画家只属于单一流派。2026-11-12 的提香／伦勃朗扩充独立维护在 `masters-*` 文件中；原有精选专题和稳定 ID 保留。

新素材来自大都会、芝加哥艺术博物馆、克利夫兰艺术博物馆的开放图像，以及逐文件核对的 Wikimedia Commons 公版复制品。作品资料来源与图像来源分开记录。文件下载到本地后生成缩略图、预览和 JPEG 整图，交付文件由 OSS 托管；用户浏览时不直接访问馆方原图。

蒙德里安新增《红、蓝、黄的构图》（1930，苏黎世美术馆B217）、《百老汇爵士乐》（1942—1943，MoMA）和《胜利爵士乐》（1942—1944，海牙美术馆长期借展），并新增苏黎世地图点。第一幅采用馆方公开的公版二维绘画复制图，未将其声明为馆方CC0；后两幅采用Commons图像。《胜利爵士乐》的来源页另有美国版权提示，保留`review-required`及原因，不因API的Public domain字段自动改成已核验。

整图最长边 3840 像素，不放大低分辨率源图；预览最长边 1280，缩略图 320。每幅整图上限 20 MB，原始来源地址、下载版本和 SHA-256 保留于来源清单。Commons 与芝加哥部分资源下载的是有界尺寸版本，不宣称保存了馆方最高分辨率扫描件。此批不新增瓦片；原有 6 幅唐寅 DZI 保留。

重建新素材（下载缓存默认在被 Git 忽略的 output/foreign-originals，可传入已有缓存目录）：

```sh
npm run media:foreign -- '/本地下载缓存目录'
npm run media:index       # 本地需有完整媒体树
npm run content:build
npm run media:check:local
```

若下载文件与已记录哈希不一致，脚本会停止，需重新核实图片身份与许可后更新来源，不能直接接受替换。完整选目、版本差异和容量统计见 [西方绘画内容核验](docs/西方绘画内容核验.md)。

## 吴道子传名作品（2026-11-02）

本次仅加入《送子天王图》（大阪市立美术馆）和《八十七神仙卷》（徐悲鸿纪念馆）。《道子墨宝》暂不纳入；王维、阎立本已在下述扩充中导入。两卷均在详情中注明传名和归属判断，不计作确认亲笔。

下载来源的完整画幅分别为 29,312 × 3,000 和 25,902 × 2,800 像素；按原始分辨率生成 922 张 DZI 瓦片，支持缩放查看细节。原件保存在忽略目录 `output/wu-daozi-originals/`，下载链接与 SHA-256 存入来源清单。网页资源由 OSS 托管，来源与媒体清单保存在仓库，原件不进入站点构建。

```sh
npm run media:wu-daozi  # 缓存缺失时下载；哈希不符即停止
npm run media:index       # 本地需有完整媒体树
npm run content:build
npm run media:check:local
```

馆藏、归属、图像版本和容量记录见 [吴道子内容核验](docs/吴道子内容核验.md)。

## 王维与阎立本扩充（2026-11-02）

王维相关21条、阎立本相关17条作品记录全部导入，265张已下载图像通过 OSS 提供。31条记录有图片，7条暂缺图像仍保留资料和收藏关系，当前在地图与列表中隐藏；9条现有主图为局部或分段，明确标成参考图。传统归属、后世摹本、馆方改定和图式传承分别保留说明。

图片保持下载版本的原始像素尺寸，巨幅图用DZI分层加载，普通图以JPEG提供；没有把分段或题跋另算作品，也没有以局部图冒充完整长卷。详情说明、无图提示和可选补充图已适配。原始文件和所有来源仍可追溯。

```sh
npm run media:tang-expansion -- '/研究资料/tang-top3-20261101'
npm run media:index       # 本地需有完整媒体树
npm run content:build
npm run media:check:local
```

完整范围、图像状态和复现说明见 [王维与阎立本内容核验](docs/王维与阎立本内容核验.md)。

## GitHub Pages

仓库已提供两条工作流：

- `Check website`：push/PR 时运行测试、媒体校验和构建。
- `Deploy GitHub Pages`：推送 `main` 或在 Actions 手动运行，完成同样检查后上传 `dist/` 并部署。构建路径读取 Pages 配置，支持仓库子目录与自定义域名。

本项目仓库为 `AnonBug/where-is-art`，部署目标为 `https://anonbug.github.io/where-is-art/`。Pages 的 Source 使用 GitHub Actions，`VITE_TIANDITU_KEY` 使用 Actions secret（天地图浏览器端 Key）。该 secret 仅避免 Key 写进源码与日志，构建后的网页仍会包含它，访问限制由天地图控制台配置；正式域名为 `anonbug.github.io`。复制到新仓库时须自行配置 Pages 与同名 secret。原来的 ChatGPT Sites 站点不受此部署流程影响。

本地复现项目子目录构建：

```sh
PAGES_BASE_PATH=/where-is-art/ npm run build
npm run preview
# 访问 http://127.0.0.1:8775/where-is-art/
```

工作流依据 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 配置。底图使用[天地图](https://www.tianditu.gov.cn/)和 [OpenFreeMap](https://openfreemap.org/)，由 [MapLibre](https://maplibre.org/) 渲染，保留相应来源署名。

设计依据为交接包需求稿 V1.1、图像资源评估和 `docs/第一版技术方案.md`。浏览器尺寸测试不能替代 iPhone／Android 真机的内存、手势和旋转性能验收。
