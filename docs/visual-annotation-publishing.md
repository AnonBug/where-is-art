# OSS 视觉标注发布

搜索服务直接读取 `where-is-art/annotations/visual-semantics/current.json`。运行代码不包含标注快照；服务只在实例内存保留缓存。新版本由请求触发刷新，缓存有效期 60 秒，无访问时不运行后台轮询。

## 新批次的发布步骤

1. 在 OSS 的 `where-is-art/annotations/visual-semantics/` 下使用独立批次目录，上传全部逐幅标注、以作品 ID 为键的 `annotations.json` 和 `manifest.json`。
2. 保留原 17 个标注字段。清单的 `works` 列表需提供 `artwork_id`、`image_id`、`image_url`、`image_sha256`、`annotation_file`。`annotations_file` 可省略，默认为同目录的 `annotations.json`。缺图和参考图记录使用 `status: missing_image / reference_only`，不会被当成全图标注；完整标注可使用 `status: annotated_whole` 或省略状态。
3. 运行发布命令（把它加入标注上传流程的最后一步）：

```sh
npm run annotations:publish -- 'https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/annotations/visual-semantics/批次目录/manifest.json'
```

可一次传入多个清单。`annotations:prepare` 使用相同参数，只校验并在 `output/visual-registry/` 生成清单，不改 OSS。标注发布命令复用本机已登录的阿里云 CLI，无需模型密钥。

发布前会验证合集、清单和全部活动批次的字段及 SHA-256。更新清单后回读确认字节一致。按单一发布者运行；如果在校验期间清单已变化，命令停止，重跑会合并最新列表。不要让多个上传进程同时修改入口。

只上传某个目录不会自动注册；搜索服务不扫描整个 OSS 桶。无需改代码、重部署或改作品目录版本，但批次必须通过上述步骤进入统一清单。如果是新作品，作品 ID 和对应图片还需进入网站作品目录。

## 清单格式

```json
{
  "schemaVersion": 1,
  "revision": "由发布脚本生成的20位摘要",
  "batches": [
    {
      "manifest": "该批manifest.json的完整OSS地址",
      "annotations": "该批annotations.json的完整OSS地址",
      "manifestSha256": "manifest原始字节的SHA-256",
      "annotationsSha256": "annotations原始字节的SHA-256"
    }
  ]
}
```

`revision` 由 `JSON.stringify(batches)` 的 SHA-256 前 20 位生成，不手填。批次顺序定义优先级：同一作品 ID 以后列批次为准，不产生重复结果。重新注册同一批时，若文件内容未变则保持原顺序；若有修订则移到末尾。建议修订使用新目录并保留旧版本，便于回退。

清单使用 `Cache-Control: no-cache,max-age=0,must-revalidate`。实例在缓存到期后的下一次请求读取它；版本变化才下载新增或变更的批次，未变的批次复用内存数据。全部校验通过后一次替换有效版本。原始出处始终指向各自批次的逐幅文件。

## 缓存、异常与兼容

- 标注版本进入检索目录缓存和最终查询结果缓存键，作品目录未变化也能刷新同一个查询。
- 图片 ID、作品 ID 或媒体目录与网站目录不一致时跳过标注，`visualCount` 为实际可用数。
- 清单下载失败、合集未上传完整、校验和不符或字段不合格时，保留实例上次成功读取的数据并提示更新暂不可用；10 秒后有新请求会重试。
- 冷启动没有可用标注时仍可检索原有作品文字，并明确提示视觉标注暂不可用。
- 不请求 `visualAnnotations:true` 的旧客户端继续使用原有证据格式。
- 前端不再写死 100，搜索完成后显示当前响应的覆盖数量。

旧入口备份在本地忽略目录 `output/visual-registry/previous-*.json`。回退时先验证备份引用的各批文件仍可读取，然后把备份上传回同一 `current.json`，保留上述缓存头。不要删除仍被清单或历史备份引用的批次。回退不需要部署代码。

## 验证

自动化覆盖：缓存到期后追加批次、重复 ID 的新版本覆盖、撤回批次、参考图/缺图排除、错误校验和、字段错误、外部 URL 拒绝、网络故障后的恢复、并发请求合并，以及作品版本不变时同一查询从无结果变为命中新标注。

实际发布验证使用首批 100 幅建立清单，再部署服务；随后仅把已上传的 193 幅拉斐尔整图标注加入 OSS 清单，确认搜索响应从 100 增至 293。正式验证记录保存在本地 `output/visual-sync/`。
