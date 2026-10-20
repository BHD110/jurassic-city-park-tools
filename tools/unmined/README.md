# uNmINeD 地图检查工具

这里保存施工期间使用的 uNmINeD CLI 和世界快照。uNmINeD 只读取 Java 世界存档，不会成为 Jurassic Reborn 的游玩依赖。

## 当前版本

- 官方下载页：<https://unmined.net/downloads/>
- 当前使用：uNmINeD `0.20.11-dev` Windows 64bit CLI
- 当前世界版本：Minecraft `1.21.1`，已实际读取成功
- 当前快照：`world-snapshot-20261017`

## 生成检查图

在项目根目录执行：

```powershell
& '.\tools\unmined\render-map.ps1' `
  -WorldPath '.\tools\unmined\world-snapshot-20261017' `
  -OutputRoot '.\verification\map-latest'
```

输出包括：

- `overview.png`：整张地图的俯视图，适合检查城市密度、道路、湖泊和围场分布。
- `web\index.html`：可缩放的网页地图，适合逐级放大定位空地和区块异常。

只生成网页地图时加 `-WebOnly`。只查看某一片区域时可传 uNmINeD 的 `-Area`，例如 `b(0,0,1200,1200)`。

## 使用规则

1. 先对运行中的世界执行 `save-all flush`，再复制快照。
2. uNmINeD 只打开快照，不直接对运行存档做写操作。
3. AI 或 WorldEdit 的改动先落到施工副本，重新渲染总图并跑项目的静态检查后，才合并到正式世界。
