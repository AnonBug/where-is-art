# 名画在哪里

React + TypeScript 的名画收藏地图，采用 Sass Modules、MapLibre GL JS 和 OpenSeadragon。当前共 6,130 条作品记录、5,875 张图像。2026-11-13 按用户提供的 OSS 目录扩充拉斐尔、马奈、莫奈、梵高、高更与蒙德里安，新增 5,197 条记录并复用已有 31 条。六位画家共 4,736 条可浏览、492 条暂缺图像；未将公开目录中的合作、传作、争议归属或未核验记录宣称为确定的亲笔全集。详见 [本次 OSS 导入说明](docs/OSS作品导入.md) 与 [提香、伦勃朗收录范围](content/masters-notes.md)。开发目录沿用「达·芬奇名画地图」。

[在线浏览](https://anonbug.github.io/where-is-art/) · [GitHub 仓库](https://github.com/AnonBug/where-is-art)

### 访问统计（2026-11-25）

备案过渡期使用 Umami Cloud Hobby 免费版（美国 Oregon 区域），[统计后台](https://cloud.umami.is/analytics/us/websites/8eb9eaf5-f557-4262-aefe-f3ea7aeada0a) 通过创建站点时使用的 Google 账号登录。账户时区为 `Asia/Shanghai`；按“今天”或自选日期查看访客与浏览量，页面排行切到标题可读到画作、画家和专题名称。免费额度及保留时间以 [Umami 当前套餐](https://umami.is/pricing) 为准；页面、事件及自定义属性都会消耗额度。

- 目录数据加载后记录页面浏览：分类目录、专题、画家/专题收藏地图、作品列表、作品资料与大图。HashRouter 的根路径跳转、重复渲染、馆藏点展开、图片切换/缩放及大图信息浮层不重复计数；离开后返回同一页面会再次计数。访客数使用 Umami 的去重估算，不等于精确自然人数；目录加载失败、浏览器拦截上报或关闭统计会导致漏计。
- `image_download`：下载链接点击，`artwork` 为作品题名和 ID；不代表文件一定下载完成。
- `search_complete`：成功取得搜索结果，属性仅 `mode` 和 `results`；`search_result_open`：点击搜索结果，属性仅 `artwork`。不上传搜索原文、收藏清单或 URL 中的任意参数，不启用录屏、回放、热图或高频缩放事件。
- 目录底部“访问统计说明”可在当前浏览器关闭后续上报（存储可用时刷新后仍生效）。也尊重浏览器 DNT 和 `umami.disabled`。开发模式及域名白名单之外的预览不加载统计脚本。

公开配置在 `.env`：`VITE_UMAMI_WEBSITE_ID`、`VITE_UMAMI_SCRIPT_URL`、`VITE_UMAMI_DOMAINS`。这些值会进入前端，不能填管理 API key。清空站点 ID 并重新构建可整体停用。备案完成后改为自建服务的脚本地址和站点 ID，再构建部署；已有云端历史不会自动合并到自建数据库。服务器里的自建 Umami 保持原状。

实现入口：`src/infrastructure/analytics.ts`（异步加载、有限队列、失败隔离）、`src/application/analyticsPage.ts`（已知目录实体生成规范页面）、`tests/analytics.test.ts`（去重、返回、隐私字段、禁用及失败场景）。上报失败不会阻断看画、搜索或下载。

作品信息只显示有资料支持的内容；「作品背景、人物与题材、怎么看这幅画」按实际内容逐节展示，没有正文就不显示标题。大图浏览的信息面板直接显示文字，手机竖屏最多占 74% 视口高度；收藏位置说明、校对备注、参考资料、图像署名及版权默认折叠在「来源与版权」中。普通作品详情仍保留预览图。

4.3.1 加入本地收藏：作品信息和大图工具栏均可收藏／取消收藏，目录「收藏」按最近收藏排列，也可查看收藏作品的地图分布。收藏只保存在当前浏览器，不需要账号，不上传到服务器；刷新后保留，清除网站数据会移除，设备之间不自动同步。兼容旧版收藏，浏览器拒绝保存时会提示仅本次打开有效。

4.5.4 取消自动补全背景与观看提示：从发布内容中移除 5,781 份 `contextual` 导读，保留 349 份按具体作品资料整理的介绍（提香 80、伦勃朗 90、其他画家 179）。早期背景草稿留在编辑源文件中，不在页面展示。已知题名、年代、媒材、收藏关系和来源不变，导入目录中的目录编号、馆藏号独立展示；未知年代与媒材不再占位。

4.5.5 按更新清单的作品 ID 替换 187 幅作品的全图、预览图和缩略图，保留指定 OSS HTTPS 地址及新的内容哈希目录；作品事实与收藏关系不变。图片来源、许可、署名和使用条件在「来源与版权」展示，包括蒙德里安 `mondrian-q24046283` 的非商业展示条件。网页全图的下载按钮改为「下载图片」，不将其称为馆方原图。更新清单存于 `content/imports/oss-image-upgrades-2026-11-13.csv`，`scripts/update-oss-images.mjs` 默认只核验，显式传入 `--apply` 才修改本地图片清单；随后运行 `npm run content:build`。

4.5.6 新增「伦勃朗的自画像」33 幅、「莫奈的睡莲」精选 24 幅、「梵高的向日葵」10 幅和「达那厄」6 幅（提香五个版本、伦勃朗一幅）；「一人一幅成名作」从 2 幅扩充至 38 位画家各一幅。专题由 `content/curated-topics.json` 显式维护作品 ID、顺序和选录依据，不按题名自动收录、不复制作品事实或图片数据。韦罗基奥仅有合作作品，暂不单列；早期中国绘画保留传名与摹本说明。专题列表显示已有收藏机构，便于区分同名版本；位置未核实的作品仍可浏览，不新增地图坐标。

4.5.7 目录文件夹可同时展开，按中国／外国分别保留当前会话的展开状态；关闭一个不影响其他文件夹。移除文件夹标题吸顶、展开后的自动顶部对齐和末项预留空白。专题列表点击画作后，桌面与手机均直接进入大图浏览；退出看画回到原专题并恢复列表滚动位置。无历史的专题看画链接返回对应专题，地图仍可通过“查看专题整体分布”进入。

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

当前 6,130 件作品的首屏 JSON 约 1.95 MB（本地 gzip 测算约 294 KB），相比完整目录的 12.10 MB 减少约 84%；每件详情中位约 1.6 KB。4.5.4 移除泛化文案前完整目录为 19.85 MB。作品数量、地图位置、收藏 ID 和来源资料均保留，原始图片质量与像素尺寸不受影响。`public/catalog.json` 继续作为完整内容输出和维护校验依据，当前前端不请求它。

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

手动清理已替换图片时，须先发布并验证新引用，再按明确对象清单清理，不能递归删除画家或作品目录。若旧图已经清理，回退旧内容版本前还须从清理备份恢复其引用的图片。2026-11-13 的 187 幅图片清理备份保存在本机仓库外的 `~/Library/Application Support/where-is-art/backups/2026-11-13-hd-upgrade/`；删除审计与对象摘要随备份保存。

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

- 桌面：左侧中国／外国／专题目录，右侧地图。天地图保留官方原始配色，海外 OpenFreeMap、页面及馆藏标记沿用青绿主题。单独馆点立即展示代表作缩略图；点击馆名或圆点居中并展开该馆，至少放大至 9 级，已有的街区近景保持原缩放。4.5.2 起，同一馆超过 8 幅作品默认收起；2～8 幅仅在展开区域与邻馆、聚合点不重叠且能完整放入视野时自动展开，区域之间保留 16 px 间隔。自动展开仍需达到 9 级，缩小至 8 级及以下收起，8～9 级保留缩放门槛状态。手动选择时一次只展开一个馆，可点卡片顶部“收起”、馆名或圆点关闭；同一浏览范围内记住手动关闭，不因平移、缩放或窗口调整立即重开。地图移动结束及尺寸变化后重新检查屏幕空间。专题作品行直接打开大图浏览；专题地图使用标题旁的地图按钮进入。地图缩略图打开作品信息，详情临时叠加在地图上。
- 看画时点击信息按钮打开浮层，保留背后的画作和当前缩放位置。点击、拖动或滚轮操作地图／画作会立即收起信息，并继续完成同一次操作；浮层内部点击和滚动不触发收起。关闭按钮与 Escape 仍可使用。只有地图上的作品信息提供“放大欣赏”，看画中的信息不再重复提供此入口。手机竖屏采用底部浮层，横屏采用右侧浮层。
- 手机：目录、地图、看画独立占满屏幕；用户自行旋转设备时，当前场景与布局随屏幕尺寸自动适配，不提供方向切换按钮，也不锁定方向或请求系统全屏。
- 看画：整图保持原始比例，支持拖动、缩放、还原；长卷的馆方高清局部可单独选择。返回时在当前会话内恢复列表滚动、地图位置和看画视口；刷新后保留 URL 中的作品与范围，不保证恢复临时缩放状态。
- 4.5.3 区分链接状态与返回历史：地图内选馆更新当前 URL，不为每次选馆增加后退步骤。“返回目录”直接回到当前分类或专题，有原目录历史时恢复该入口；共享链接或旧版累积的地图历史使用对应目录作为退路，不逐步回放馆点。退出看画仍返回刚才的地图或作品列表。URL 保存范围、作品、馆点和图像选择；地图中心、缩放及列表滚动只保存在页面会话内存。
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
  curated-topics.json          精选专题作品 ID、顺序、选录与排除依据
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
  build-artwork-guides.mjs     离线合并逐件解读与编目修正，不生成通用导读
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

用户上传的六位画家目录独立维护在 `content/oss-import-*`，由 `content:build` 合并。原始 CSV、行级索引修订号、图像许可与署名保留；已有作品 ID、精选专题和逐件导读不变。CSV 没有提供导读正文，不再为新增作品生成通用文案；目录编号和馆藏号保存为独立字段。复现步骤见 [OSS 作品导入说明](docs/OSS作品导入.md)。

导读维护于 `content/artwork-guides/`，由 `content:build` 离线合入目录，浏览器不会请求生成服务或实时生成解读：

- `*-overrides.json`：以稳定作品 ID 保存中文解读与来源。只发布 `scope: individual` 的逐件介绍；`background`、`story`、`looking` 各节可以缺省，但保留正文必须有 `sources`。该标记不表示归属或人物身份已经没有争议。
- `contexts.json`、`subjects.json`、`people.json`：保留为后续研究的参考，不再自动拼接进作品详情。
- `work-facts.json`：2026-11-12 读取的 Wikidata CC0 题材、类型与尺寸数据；只保留明确的厘米尺寸。不再据题名、画家、类型或尺寸自动生成故事与观看提示。
- `catalog-corrections-*.json`：来源核对带来的题名、年代、媒材等修正，在构建时合入作品并保留说明。馆方资料优先于旧目录；多版本作品须核对具体馆藏，不借用另一版本的创作故事。

添加或修改导读后运行下方构建与测试。具体委托、模特身份及人物位置需保存对应来源；没有充分资料时省略整节，不用画家生平、通用题材或占位说明填补。

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

## AI 搜索与阿里云函数计算

目录顶部的「描述你想找的画」支持自然语言搜索。浏览器向 `.env` 中的公开 `VITE_AI_SEARCH_URL` 发出 POST 请求；上海地域的 FC 3.0 函数 `where-is-art-ai-search` 使用 DeepSeek `deepseek-flash` 解析画家、站内专题、题名、收藏地与故事线索。简单目录查询直接筛选；情节与背景查询先全文检索，再让模型核对候选文字。访客无需登录，DeepSeek Key 仅保存在函数环境变量中，不能设置成 `VITE_` 变量。

请求示例：`{"query":"有孤独感的画作","revision":"f037e97c404b757e47c4","mode":"ai","visualAnnotations":true}`。网页自动传入当前目录版本；不传 `revision` 时读取线上 `current.json`。接口只返回最多 30 个真实作品 ID、匹配依据和总数，不提供通用聊天或实时展出。关键词模式 `mode: "keyword"` 不调用模型。不发送 `visualAnnotations:true` 的旧客户端继续使用原有文字证据，避免新证据类型影响已打开的旧页面。

2026-11-26 加入 100 幅作品的 AI 视觉标注试用。来源是[用户提供的标注合集](https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/annotations/visual-semantics/53c20b880021864a89b7-39322359699354/annotations.json)及同目录 `manifest.json`，原始快照保存在 `server/ai-search/data/`，不改原作品介绍与 OSS 内容入口。函数加载目录时按作品 ID、全图 ID 和带版本的媒体目录匹配；图片被替换或作品不在该版本时跳过标注。响应 `visualCount` 表示本次目录实际可用的视觉标注数量，当前线上目录可用 100 幅。

检索使用画面描述、情绪依据、氛围及 800 条自然语言示例；示例只帮助找候选，不作为结果证据。近义词扩展覆盖孤独/寂寞/孤寂等表达，独处与孤独分开处理。先按文字与证据组召回最多 20 幅，再由现有 DeepSeek 模型核对完整查询，包括排除条件与情绪比喻。无需新增向量数据库或另一家模型服务，每次查询仍最多两次模型调用。情绪强度不当作置信度或跨作品的客观分数。

结果区将 `visual_description`、`visual_emotion` 显示为「AI 画面标注」「AI 情绪标注」，并链接原始标注和对应画面。情绪是可能的观看感受，不能当作馆方史实、画家创作动机或人物真实心理。界面提示当前 100 幅的覆盖范围；未标注作品仍可通过已有资料搜索，但不能保证按未记载的画面细节找出。验证方法和查询样例见 [视觉搜索验证](docs/visual-search-validation.md)。

故事检索覆盖已发布的 `description`、`guide.background`、`guide.story` 和 `guide.looking`。`search-text-v1.json` 按内容版本保存原文段落及参考来源；不纳入 contextual 草稿、备注或模型补写的故事。先由模型扩展检索词，再按短语及词语稀有度排序，从有文字的作品中取最多 20 幅候选、每幅最多两个相关段落，交给第二次模型请求核对全部语义限制。AI 只选择候选编号与证据编号，响应中的引文、字段名和来源由服务端复制原文，不能由模型编造。网页可展开原文并打开参考来源。语义结果的 `total` 是本次核对后匹配的数量，不代表完整图库的穷尽统计；候选截断时会提示补充条件。

当关键线索分散在两个字段中时，同时返回主证据和补充证据，网页分别展示原文及参考来源，避免只展示半条依据。

2026-11-24 的内容版本共有 7,331 条作品，1,899 条至少具备一种可检索文字（其中描述 1,809、背景 412、故事 382、导读 405，字段有重叠）；后续内容版本独立扩充，以上为当日统计。缺少文字、隐含信息未被记载或同义词未命中，均可能导致漏检；没有依据时允许返回空结果。颜色与画面细节依据已发布文字及上述离线视觉标注，不在用户搜索时逐张识图。模型核对仍可能误判，结果保留依据供复核。关键词模式同样检索这些文本，但不会进行 AI 语义核对。

默认按北京时间每天全站最多 500 次、每 IP 最多 100 次未命中缓存的 AI 调用。简单查询通常消耗一次，故事查询通常消耗两次；每次模型调用前都单独预留额度，第二次预留失败不会继续付费调用。OSS 私有 AppendObject 每追加一字节预留一次调用，跨实例和重启仍有效；计数失败、限额用完或模型故障时改用关键词搜索并明确提示。失败的模型请求也占用已预留次数；缓存为实例内一小时，保留最多 256 项。IP 每日通过 HMAC 匿名化保存，应用不记录原始 IP 或搜索文本。FC 保留并发上限为 2，无预留实例。此限额约束模型调用次数，不是阿里云账单总额上限；FC 请求、算力、公网流量及 OSS 请求/存储仍按阿里云规则计费，DeepSeek 另行计费。

后端依赖和自动检查：

```sh
npm ci --ignore-scripts --prefix server/ai-search
npm test
npm run content:check:app
```

部署需要已登录的官方 `aliyun` CLI，执行：

```sh
node scripts/deploy-ai-search.mjs /绝对路径/私有密钥文件.env.local
# 已有函数更新代码时可省略文件，复用函数现有密钥与环境变量
node scripts/deploy-ai-search.mjs
```

新内容发布会自动生成并上传同版本的 `search-text-v1.json`，前端构建不会携带该文本库。给已上线的旧内容版本补建索引可执行 `node scripts/publish-search-text.mjs --publish`（可追加 20 位版本号）；脚本检查原始目录版本和远端字节一致性，不改 `current.json` 或原作品资料。已有不可变索引内容不同则拒绝覆盖，修改索引格式须升级文件名。没有此文件的旧版本，函数会核对完整目录的版本哈希后临时构建文本索引。

文件只需含 `DEEPSEEK_API_KEY`。脚本创建/复用 FC 服务关联角色，以及仅能读写 `where-is-art-private/ai-search/quota/*` 的专用函数角色；上传明确列出的代码与依赖，保留已有配额哈希密钥，设置额度及并发后创建匿名 HTTPS 触发器。请求文件以 0600 权限临时保存并自动移除。允许网页来源为生产 GitHub Pages 和本地 8775 端口；CORS 是浏览器来源约束，防滥用主要依赖持久化额度。健康检查为同一域名下的 `/health`，只显示配置是否齐备，不消耗模型额度。调整额度需修改脚本中的环境变量并重新部署；紧急停用可用 FC `DisableFunctionInvocation`，或将前端入口撤回。

内容与前端独立发布：`content:check:app` 先验证仓库对应内容已上传，再校验当前线上内容的校验和、结构、引用和图片格式兼容性，允许更新的作品目录继续在线，不会将内容指针回退。

设计依据为交接包需求稿 V1.1、图像资源评估和 `docs/第一版技术方案.md`。浏览器尺寸测试不能替代 iPhone／Android 真机的内存、手势和旋转性能验收。


## 达那厄专题与画家目录入口

**专题可以使用没有独立目录入口的画家作品。** 仍需在 `artists` 中保存画家基本资料供作品署名、国别与时期关联使用；为该画家设置 `directoryVisible: false` 后，中国／外国画家目录不显示其入口。省略此字段或设为 `true` 时沿用原有显示方式。若某时期下没有可显示的画家，也不显示空文件夹。该开关只控制目录入口，不删除作品，也不限制专题、大图、收藏、分类总地图或已有画家链接；图库及专题仍通过稳定作品 ID 复用数据。未来要建立画家目录，只需移除开关或设为 `true`，再补选一件 `signature` 代表作，无需迁移图片或修改作品 ID。

2026-11-22「达那厄」扩充为14幅、10位画家：保留提香五个版本与伦勃朗一幅，新增戈萨尔特、柯雷乔、丁托列托、霍尔齐乌斯、真蒂莱斯基父女、克里姆特和席勒各一幅。新增七位画家的资料设为 `directoryVisible: false`；克里姆特复用既有目录。导读维护于 `content/artwork-guides/danae-overrides.json`，选目与依据见 `curation.danae`。克里姆特和席勒的私人收藏作品没有未经核实的馆点。图片保留实际像素，柯雷乔与席勒当前图源为标准清晰度，不作放大。此开关涉及前端代码，首次上线须同时发布前端与内容；仅发布内容到旧前端时，旧前端仍会列出这些画家。

本次发布同时将线上已有的蒙克及洛可可作品同步回编辑源文件，保留所有原有记录与图片地址；只新增达那厄专题的八件作品。
