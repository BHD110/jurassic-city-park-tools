# 地图总览与 AI 建造工具调研

## 已实测的整图查看工具

### uNmINeD

官方地址：<https://unmined.net>

它可以直接读取 Minecraft Java 世界，生成整张俯视图，也可以生成带缩放的网页地图。当前项目已经用 Windows 64bit CLI `0.20.11-dev` 读取 `jurassic-city-v2` 的 1.21.1 存档并成功生成：

- `verification/map-overview.png`
- `verification/map-web/index.html`

当前最新输出是 `verification/map-final/overview.png` 和 `verification/map-final/web/index.html`；本机网页查看地址是 `http://127.0.0.1:8173/web/`。这张图适合回答“城市是否有连续空地”“道路有没有断开”“围场和轨道是否落在规划区内”。自定义模组方块可能显示成默认颜色，但对道路、地面、树木和建筑轮廓的检查已经足够。详细用法见 `tools/unmined/README.md`。

### MCA Selector

官方地址：<https://github.com/Querz/mcaselector>

它更适合查看区块是否生成、区块是否异常和选择一批区块导出。它不是建筑美术预览器，使用时必须打开世界副本。

### BlueMap

项目地址：<https://bluemap.bluecolored.de/>

它生成可在浏览器里旋转和缩放的 3D 世界模型，适合检查高架轨道、建筑高度和城市与公园的空间关系。要在当前 1.21.1 NeoForge 实例上使用，需要单独核对对应版本；不放进最终游玩依赖。

## AI 和批量建造工具

### MineClawd：施工副本里的主力候选

项目地址：<https://github.com/Zhou-Shilin/MineClawd>

官方仓库的 `1.21.1` 分支提供 NeoForge `1.21.1` 的 `v1.3.0`。它支持 OpenAI-compatible 接口，可以用自然语言修改世界、读写施工脚本和执行服务器命令。

仓库明确提示它是实验项目，能执行模型生成的 JavaScript、KubeJS 和命令。因此只允许在世界副本和独立施工服使用，不能带进交付给玩家的最终实例，也不能给它正式世界的 OP 权限。

适合让它做：

- 发现连续几十格没有景物的区域并提出补强方案。
- 在指定街区增加有年代感的骑楼、后勤建筑、停车区和热带植被。
- 根据总图给出“绕开轨道、道路、围场和恐龙视线”的局部修改脚本。

### BlockGPT：生成少量建筑原型

地址：<https://blockgpt.ai>

可以用文字或图片生成 `.schem`、`.litematic` 等结构文件，再用 WorldEdit 或 Litematica 导入。适合游客中心侧翼、研究所、餐厅、观景塔和小店，不适合一次生成整个 2000 x 2000 城市。

### WorldEdit：可控导入和回滚边界

项目地址：<https://modrinth.com/project/1u6JkXh5>

WorldEdit 支持 NeoForge 1.21.x，能导入 schematic、复制局部街区和批量替换方块。它本身不是 AI，但可以把 AI 生成的局部结构稳定地放进施工副本。

### BuilderGPT：只作参考

项目地址：<https://github.com/CyniaAI/BuilderGPT>

它能输出 `.schem` 或 `.mcfunction`，但仓库已经标明开发暂停，并推荐转向 MineClawd。当前不把它作为主工具。

## 当前项目采用的组合

1. uNmINeD 生成整图，定位空旷区域。
2. MCA Selector 检查区块是否完整。
3. MineClawd 或 BlockGPT 只生成一个街区或一栋重点建筑。
4. WorldEdit 导入施工副本。
5. 运行现有的道路、轨道、围栏、碰撞和恐龙视线检查。
6. 通过检查后才把补丁应用到正式世界，再重新生成整图和跑完整轨道测试。

这样可以避免 AI 一次性生成一座比例失控、浮空、压住轨道或破坏围栏的城市。
