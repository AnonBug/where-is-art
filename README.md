# 名画在哪里

React + TypeScript 的名画收藏地图，采用 Sass Modules、MapLibre GL JS 和 OpenSeadragon。当前版本收录唐寅 17 幅、达·芬奇相关 21 幅，33 位西方画家的 137 幅作品，传吴道子的两幅长卷，以及王维相关 21 条、阎立本相关 17 条记录，共 215 条作品记录、459 张图像、52 个收藏地点。开发目录沿用「达·芬奇名画地图」。

[在线浏览](https://anonbug.github.io/where-is-art/) · [GitHub 仓库](https://github.com/AnonBug/where-is-art)

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
npm run media:check    # 唐寅、吴道子瓦片与西方图像的尺寸、体积、解码和来源校验
npm run build          # 主题生成、类型检查、静态构建及发布体积检查 → dist/
npm run preview        # 预览 dist/，与 dev 使用同一端口
```

`dist/` 可重新生成，不提交到 Git。当前没有服务端、账号或数据库。目录 JSON 同站加载；地图通过 HTTPS 请求天地图 `vec_w`、`ibo_w`、`cva_w`，使用球面墨卡托 WMTS（1—18 级、256 px PNG）。这些是已绘制的成图瓦片，不是可逐要素改色的 MVT/PBF。

海外近景加载同站的 `map-style.json`，再请求 OpenFreeMap 矢量瓦片、字体与图标。切换由 `regionalBasemap.ts` 集中控制：zoom ≤ 5 始终使用天地图；达到 5.5 且整个视野离开保守范围后才进入 OpenFreeMap。经度 70°—140°、纬度 0°—56° 是切换保护框，另加 3° 的进入缓冲，不是行政边界，也不绘制在地图上，因此部分邻近地区仍使用天地图。依据视野而非画家分类决定来源；切换替换整张底图，不拼接两套国界，不改变馆藏点坐标。

## 当前交互

- 桌面：左侧中国／外国／专题目录，右侧地图。天地图保留官方原始配色，海外 OpenFreeMap、页面及馆藏标记沿用青绿主题。单独馆点立即展示代表作缩略图；点击馆名或圆点后地图居中至 9 级城市视图，并在该点上方展开当前范围内的全部作品。手动放大至 9 级及以上时，视野内未聚合的馆点也自动展开作品；缩小至 8 级及以下时收起，8～9 级之间保持原状态。专题作品行只定位；地图缩略图打开作品信息，详情临时叠加在地图上。
- 看画时点击信息按钮打开浮层，保留背后的画作和当前缩放位置。点击、拖动或滚轮操作地图／画作会立即收起信息，并继续完成同一次操作；浮层内部点击和滚动不触发收起。关闭按钮与 Escape 仍可使用。只有地图上的作品信息提供“放大欣赏”，看画中的信息不再重复提供此入口。手机竖屏采用底部浮层，横屏采用右侧浮层。
- 手机：目录、地图、看画独立占满屏幕；用户自行旋转设备时，当前场景与布局随屏幕尺寸自动适配，不提供方向切换按钮，也不锁定方向或请求系统全屏。
- 看画：整图保持原始比例，支持拖动、缩放、还原；长卷的馆方高清局部可单独选择。返回时在当前会话内恢复列表滚动、地图位置和看画视口；刷新后保留 URL 中的作品与范围，不保证恢复临时缩放状态。
- 看画时先用预览图提供拖动和缩放，高清整图或瓦片在后台逐步覆盖；加载完成保留当前视角，不显示等待高清细节的提示。高清资源失败时仍可操作预览图。
- 看画缩放百分比以适应窗口为 100%；任何清晰度都至少可放大到 400%，高清作品保留更高的原有上限。窗口尺寸变化后同步更新上限，低清图不会因像素少而提前限制放大。
- 大图右上角和作品信息预览图左下角提供下载图标：普通图片下载站内完整图像文件；DZI 作品下载完整低清预览，不下载瓦片或当前视口截图。选择局部或参考图时，两处入口都对应当前图像，并在文件名和按钮提示中说明。
- 收藏地点未核实的作品仍可看画，不创建虚构坐标。机构位置不表示实时展出。
- 藏品较多时，馆点的缩略图网格内部独立滚动，不触发地图缩放。直接打开画家地图或看画链接时，目录同步到对应分类、时期和画家；窄侧栏的长时期名称与年代分行展示。
- 多个收藏地聚合时，数字圈上方仍显示一张作品缩略图，优先显示当前选中的有图作品，否则显示聚合内第一幅有图作品。点图查看作品信息，点数字圈放大展开收藏地。
- 暂无画源的 7 条记录保留在资料中，地图、作品列表和专题中隐藏，数量只统计可看画的作品；当前可浏览 208 幅。有局部参考图的作品仍显示，补齐画源后自动恢复展示。仅关联无图作品的馆点也不显示。

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
  map-style-base.json          OpenFreeMap Liberty 原始样式
scripts/
  build-catalog.mjs            合并唐寅、既有达·芬奇和新增西方绘画数据
  build-theme.mjs              单一配色源 → Sass 变量和地图样式
  prepare-media.mjs            离线生成缩略图、预览、整图或 DZI
  check-media.mjs              验证唐寅交付文件
  prepare-foreign-media.mjs    生成西方绘画缩略图、预览和整图
  check-foreign-media.mjs      核对文件哈希、完整解码和来源证据
public/
  catalog.json                生成的前端目录数据
  map-style.json              生成的青绿样式
  brand/logo.png              交接包指定的原始 Logo
  media/                      网页图像与瓦片
  assets/                     沿用的达·芬奇图像
```

React 管理界面，MapLibre 和 OpenSeadragon 分别管理自己的画布生命周期。重模块独立懒加载。业务组件使用 `.module.scss`；页面、标记及海外矢量底图的配色集中在 `src/styles/tokens.json`。天地图成图瓦片不应用滤镜或逐层改色。地图署名随当前来源切换。

仓库中 `src/App.tsx`、`src/AtlasExplorer.tsx`、旧 `components/`、`hooks/`、`lib/` 与 `styles/theme.css` 是上一版源码，保留作为迁移参考，本版入口不导入；旧 JSON 仍作为达·芬奇资料来源。此次未清理原有暂存修改或覆盖旧收藏存储。

## 内容与图片维护

修改 `content/tang-catalog.json`、`content/foreign-catalog.json`、`content/wu-daozi-catalog.json`、`content/tang-expansion-catalog.json` 或既有 `public/data.json` 后运行：

```sh
npm run content:build
npm test
npm run build
```

新增西方内容的时期、画家和专题在 `content/foreign-catalog.json` 中维护，由 `scripts/build-catalog.mjs` 合并；无需修改 React 组件即可扩充同类数据。作品通过稳定 ID 引用画家；收藏关系独立存储，允许多馆藏关联；专题引用作品 ID，不复制作品记录；全图与高清局部是不同图像资源。

网页资源已生成，克隆后无需原件即可开发、校验和部署。只有重新转换唐寅原件时需要交接包里的 `test-data/tang-yin/manifest.json`：

```sh
ATLAS_ORIGINAL_ROOT='/原件所在目录' npm run media:prepare -- '/交接包/test-data/tang-yin/manifest.json'
npm run media:check
npm run content:build
```

唐寅 6 张、传吴道子 2 张、王维与阎立本 11 张图像采用 DZI，共 4,372 张瓦片。普通整图不超过 20,000,000 字节；DZI 只发布缩略图、预览和瓦片，不发布巨幅整图作为回退。瓦片总大小可能超过 20 MB，浏览器只请求当前视野所需层级。普通图和 DZI 共用看画器。

《溪山渔隐图》12 张、《采莲图》5 张高清局部分别关联原始馆方照片，不从低清全卷虚构细节。《吹箫仕女图》仅 423 × 800 像素，保留普通清晰度提示与资料不确定性。原始素材在转换前后做 SHA-256 校验，保持不变。

图像来源与署名在作品详情展示；`publicationStatus` 记录素材核验状态。唐寅 4 幅的使用条款仍待确认，达·芬奇沿用素材尚未逐张重新审核。完整记录见 `docs/唐寅内容核验.md` 和 `content/media-manifest.json`。这些状态不会被转换脚本自动当作授权。

## 西方绘画扩充（2026-11-01）

新增 33 位画家、16 个时期或风格分组、134 幅作品和“西方绘画之旅”专题；2026-11-02 补入蒙德里安三幅代表作后共 137 幅。28 位画家各 4 幅，杜乔、格里斯各 3 幅，莫奈、梵高各 6 幅，蒙德里安 7 幅；既有唐寅与达·芬奇记录保留。时期是浏览目录，允许年代交叠，不表示画家只属于单一流派。

新素材来自大都会、芝加哥艺术博物馆、克利夫兰艺术博物馆的开放图像，以及逐文件核对的 Wikimedia Commons 公版复制品。作品资料来源与图像来源分开记录。文件下载到本地后生成随站点发布的缩略图、预览和 JPEG 整图；用户浏览时不依赖外部图片链接。

蒙德里安新增《红、蓝、黄的构图》（1930，苏黎世美术馆B217）、《百老汇爵士乐》（1942—1943，MoMA）和《胜利爵士乐》（1942—1944，海牙美术馆长期借展），并新增苏黎世地图点。第一幅采用馆方公开的公版二维绘画复制图，未将其声明为馆方CC0；后两幅采用Commons图像。《胜利爵士乐》的来源页另有美国版权提示，保留`review-required`及原因，不因API的Public domain字段自动改成已核验。

整图最长边 3840 像素，不放大低分辨率源图；预览最长边 1280，缩略图 320。每幅整图上限 20 MB，原始来源地址、下载版本和 SHA-256 保留于来源清单。Commons 与芝加哥部分资源下载的是有界尺寸版本，不宣称保存了馆方最高分辨率扫描件。此批不新增瓦片；原有 6 幅唐寅 DZI 保留。

重建新素材（下载缓存默认在被 Git 忽略的 output/foreign-originals，可传入已有缓存目录）：

```sh
npm run media:foreign -- '/本地下载缓存目录'
npm run content:build
npm run media:check
```

若下载文件与已记录哈希不一致，脚本会停止，需重新核实图片身份与许可后更新来源，不能直接接受替换。完整选目、版本差异和容量统计见 [西方绘画内容核验](docs/西方绘画内容核验.md)。

## 吴道子传名作品（2026-11-02）

本次仅加入《送子天王图》（大阪市立美术馆）和《八十七神仙卷》（徐悲鸿纪念馆）。《道子墨宝》暂不纳入；王维、阎立本已在下述扩充中导入。两卷均在详情中注明传名和归属判断，不计作确认亲笔。

下载来源的完整画幅分别为 29,312 × 3,000 和 25,902 × 2,800 像素；按原始分辨率生成 922 张 DZI 瓦片，支持缩放查看细节。原件保存在忽略目录 `output/wu-daozi-originals/`，下载链接与 SHA-256 存入来源清单。网页资源随仓库保存，原件不进入站点构建。

```sh
npm run media:wu-daozi  # 缓存缺失时下载；哈希不符即停止
npm run content:build
npm run media:check
```

馆藏、归属、图像版本和容量记录见 [吴道子内容核验](docs/吴道子内容核验.md)。

## 王维与阎立本扩充（2026-11-02）

王维相关21条、阎立本相关17条作品记录全部导入，265张已下载图像随站点提供。31条记录有图片，7条暂缺图像仍保留资料和收藏关系，当前在地图与列表中隐藏；9条现有主图为局部或分段，明确标成参考图。传统归属、后世摹本、馆方改定和图式传承分别保留说明。

图片保持下载版本的原始像素尺寸，巨幅图用DZI分层加载，普通图以JPEG提供；没有把分段或题跋另算作品，也没有以局部图冒充完整长卷。详情说明、无图提示和可选补充图已适配。原始文件和所有来源仍可追溯。

```sh
npm run media:tang-expansion -- '/研究资料/tang-top3-20261101'
npm run content:build
npm run media:check
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
