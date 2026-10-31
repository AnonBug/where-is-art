# 名画在哪里

React + TypeScript 的名画收藏地图，采用 Sass Modules、MapLibre GL JS 和 OpenSeadragon。当前版本收录唐寅 17 幅作品、达·芬奇相关 21 幅作品，共 55 张图像、18 个收藏机构。开发目录沿用「达·芬奇名画地图」。

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
npm run media:check    # 唐寅图片尺寸、文件预算、全部瓦片与边缘解码
npm run build          # 主题生成、类型检查、静态构建 → dist/
npm run preview        # 预览 dist/，与 dev 使用同一端口
```

`dist/` 可重新生成，不提交到 Git。当前没有服务端、账号或数据库。目录 JSON 同站加载；地图通过 HTTPS 请求天地图 `vec_w`、`ibo_w`、`cva_w`，使用球面墨卡托 WMTS（1—18 级、256 px PNG）。这些是已绘制的成图瓦片，不是可逐要素改色的 MVT/PBF。

海外近景加载同站的 `map-style.json`，再请求 OpenFreeMap 矢量瓦片、字体与图标。切换由 `regionalBasemap.ts` 集中控制：zoom ≤ 5 始终使用天地图；达到 5.5 且整个视野离开保守范围后才进入 OpenFreeMap。经度 70°—140°、纬度 0°—56° 是切换保护框，另加 3° 的进入缓冲，不是行政边界，也不绘制在地图上，因此部分邻近地区仍使用天地图。依据视野而非画家分类决定来源；切换替换整张底图，不拼接两套国界，不改变馆藏点坐标。

## 当前交互

- 桌面：左侧中国／外国／专题目录，右侧地图。天地图保留官方原始配色，海外 OpenFreeMap、页面及馆藏标记沿用青绿主题。单独馆点立即展示代表作缩略图；点击馆名或圆点后地图居中至 9 级城市视图，并在该点上方展开当前范围内的全部作品。手动放大至 9 级及以上时，视野内未聚合的馆点也自动展开作品；缩小至 8 级及以下时收起，8～9 级之间保持原状态。专题作品行只定位；地图缩略图打开作品信息，详情临时叠加在地图上。
- 看画时点击信息按钮打开浮层，保留背后的画作和当前缩放位置。点击、拖动或滚轮操作地图／画作会立即收起信息，并继续完成同一次操作；浮层内部点击和滚动不触发收起。关闭按钮与 Escape 仍可使用。只有地图上的作品信息提供“放大欣赏”，看画中的信息不再重复提供此入口。手机竖屏采用底部浮层，横屏采用右侧浮层。
- 手机：目录、地图、看画独立占满屏幕；横屏继续使用同一场景。屏幕旋转按钮由用户点击触发系统能力，不支持时提示手动旋转。
- 看画：整图保持原始比例，支持拖动、缩放、还原；长卷的馆方高清局部可单独选择。返回时在当前会话内恢复列表滚动、地图位置和看画视口；刷新后保留 URL 中的作品与范围，不保证恢复临时缩放状态。
- 收藏地点未核实的作品仍可看画，不创建虚构坐标。机构位置不表示实时展出。

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
  map-style-base.json          OpenFreeMap Liberty 原始样式
scripts/
  build-catalog.mjs            合并唐寅和既有达·芬奇数据
  build-theme.mjs              单一配色源 → Sass 变量和地图样式
  prepare-media.mjs            离线生成缩略图、预览、整图或 DZI
  check-media.mjs              验证实际交付文件
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

修改 `content/tang-catalog.json` 或既有 `public/data.json` 后运行：

```sh
npm run content:build
npm test
npm run build
```

时期、画家和专题编排目前集中在 `scripts/build-catalog.mjs`；后续增加一批数据可在这里接入。作品通过稳定 ID 引用画家；收藏关系独立存储，允许多馆藏关联；专题引用作品 ID，不复制作品记录；全图与高清局部是不同图像资源。

网页资源已生成，克隆后无需原件即可开发、校验和部署。只有重新转换唐寅原件时需要交接包里的 `test-data/tang-yin/manifest.json`：

```sh
ATLAS_ORIGINAL_ROOT='/原件所在目录' npm run media:prepare -- '/交接包/test-data/tang-yin/manifest.json'
npm run media:check
npm run content:build
```

6 幅采用 DZI，共 2,438 张瓦片。普通整图不超过 20,000,000 字节；DZI 只发布缩略图、预览和瓦片，不发布巨幅整图作为回退。瓦片总大小可能超过 20 MB，浏览器只请求当前视野所需层级。普通图和 DZI 共用看画器。

《溪山渔隐图》12 张、《采莲图》5 张高清局部分别关联原始馆方照片，不从低清全卷虚构细节。《吹箫仕女图》仅 423 × 800 像素，保留普通清晰度提示与资料不确定性。原始素材在转换前后做 SHA-256 校验，保持不变。

图像来源与署名在作品详情展示；`publicationStatus` 记录素材核验状态。唐寅 4 幅的使用条款仍待确认，达·芬奇沿用素材尚未逐张重新审核。完整记录见 `docs/唐寅内容核验.md` 和 `content/media-manifest.json`。这些状态不会被转换脚本自动当作授权。

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
