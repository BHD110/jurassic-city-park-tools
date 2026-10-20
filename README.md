# 侏罗纪城市公园

这是《侏罗纪城市公园》的自制工具仓库。仓库保留建造脚本、NeoForge 建造模组源代码、交通与恐龙辅助工具、校验脚本和项目说明；世界存档、运行日志、录屏、第三方模组和缓存不会上传。仓库范围、依赖和版权说明见 [`GITHUB-REPOSITORY.md`](GITHUB-REPOSITORY.md)。

当前本机游玩存档是城市活动第二版：4,372 名会散步的市民、游客和工作人员，112 辆自动驾驶城市车辆（98 辆轿车、14 辆巴士），以及 JourneyMap 游戏内全屏地图。原来的赛车外形已移除，恐龙围栏内不布置行人。模组清单在 `modpack/manifest.json`，城市车型资源包和数据包必须一并安装。记录见 [城市活动第二版](verification/city-v2-notes.md)；下方历史建筑交付信息仍对应原始交付包。

Minecraft Java 1.21.1、NeoForge 21.1.262、Jurassic Reborn 1.4.2。

园区的游客中心、大门、火炬、控制室和游览车参考 1993 年电影《侏罗纪公园》的造型。外围的 1990 年代热带城市是本地图的虚构设计，不是电影场景复刻。

## 进入游戏

目标运行环境是 HMCL 的 `1.21.1-NeoForge` 实例。最终单人存档已安装到该实例的 `saves/Jurassic City Park`，交付副本在 `delivery/Jurassic-City-Park-20261017-141555/Jurassic City Park`。112 个世界文件与安装副本逐文件一致；出生点为城市观光车站 `0 / 65 / 657`，默认创造模式并允许命令。本轮依要求不进入游戏画面，真人按按钮、乘车及退出重进未执行。

车站设有“乘车发车”“创造模式”“冒险模式”三个按钮。乘车按钮用于自动上车和发车；按左 Shift 下车，乘车时可自由转动视角。普通城市建筑以外观为主，游客中心、实验室、控制中心和维修站设计为可进入。313 座城市建筑已改建为有不同屋顶、立面和入口的主楼、配楼及沿街小店；12 座主楼的真实存档双角图见 `verification/architecture-12-real-save/`。

建议关闭光影，使用 6GB 内存、10 区块视距、5 区块模拟距离。恐龙保留活动 AI，展示世界关闭恐龙代谢和繁殖，避免长时间游览后因缺食或繁殖改变数量。

## 重点地点

| 地点 | 坐标 X / Y / Z |
| --- | --- |
| 城市观光车站 | 0 / 65 / 657 |
| 公园木质大门 | 0 / 65 / 570 |
| 游客中心入口 | 0 / 70 / 489 |
| 控制中心 | 0 / 65 / 270 |
| 孵化实验室 | 0 / 65 / -470 |
| 后勤维修站 | 500 / 65 / 500 |

## 地图规模

当前合成计划 `map/generated/upgrade-full.json` 包含 319 座建筑：313 座城市建筑（80 座主楼、158 座配楼、75 座小店）、4 处重点设施、2 座新增的素材房屋。四份外部素材均已施工：Ocean House、Mediterranean Style Home（替换 `city-06`）、Fisherman House 和 JPOG 游客中心（替换原游客中心）。地面街区补丁另加了 25 处庭院点位和 100 条连通人行道。8 个围场在 2026-10-18 增至 512 只恐龙，保留原有 128 只；穿城起伏的闭合观光轨道有 8,488 个路线点。独立平坦世界使用 Y=63 的实心草地，并关闭村庄等原生建筑生成。

固定种子 `city-green-20261017-v1` 在四个城区增加了 11,680 个植被点，包括树、灌木和地被，并非 11,680 棵大树。8 米网格的可种地采样覆盖率由 3.4% 提高到 72.6%；这是采样估计，不是整张地图的逐格植被比例。绿化计划保护建筑、四份素材、步道、轨道和围场，增量施工报告为 55,863/55,863 条操作完成。

## 建造源文件

- `map/generate.mjs`：城市、重点建筑、围场、轨道和车站操作台。
- `map/park-details.mjs`：热带植物、不规则山体、瀑布和室内设施。
- `map/city-details.mjs`：沿街配楼、电话亭、杂志亭和主楼院落细节。
- `map/city-variation-details.mjs`：城市主楼差异化立面与屋顶构件补丁。
- `map/references/`：电影参考图与设计说明。
- `map/generated/full.json`：原始建造计划，保留作来源，不代表当前最终世界。
- `map/architecture-rebuild.mjs`、`map/compose-upgrade-full.mjs`：城市建筑改建与最终计划合成。
- `map/generated/upgrade-full.json`：当前完整计划，仅用于核对来源和校验；已施工世界只使用未完成部分的增量补丁，不能重新执行 `parkbuild start upgrade-full`。
- `map/references/assets/asset-manifest.json`：四份外部素材的来源、版本和导入记录。
- `builder/`：服务端建造工具及当前 Immersive Vehicles 自动交通控制器；城市车辆自动行驶依赖当前服务端的该模组。
- `modpack/`：四份原版模组文件、精确版本和校验值、实例配置。
- `verification/`：生成计划检查、世界内检查、乘车实测及存档恐龙核对。

原始计划可用 `npm run generate` 重新生成，原始计划检查使用 `npm run check`；当前升级计划由 `node map/compose-upgrade-full.mjs` 合成。建造工具源代码可重新编译：当前工作目录在 `builder/MDK-1.21.1-ModDevGradle-main`，导出包中整理到 `builder/`。

建造计划仅用于这张独立新世界，不要应用到个人存档。

## 2026-10-18 城市生活更新

实际游玩世界为 `runtime/server/jurassic-city-v2`，服务端地址 `127.0.0.1:25576`。停服备份保存在 `backups/before-city-life-upgrade-closed-20261018-090218`。

NPC 共 4,372 人，按 30 格网格布置，包含室内点位；每人以 Home 为中心活动，返回阈值 30 格，安全数据包每 40 tick 将越界或进入八个恐龙围场的 NPC 传回。水面和无安全站立空间的格点不强行放人，覆盖说明见 `verification/npc-coverage-notes.md`。恐龙共 512 只，原有个体 UUID 全部保留，文件核对见 `verification/city-upgrade-population.json`。

旧 Automobility 模组、112 个旧车实体、旧车资源/数据包已从运行实例移出；12 处挡路的方块车已清除。新车使用 Immersive Vehicles 24.0.0、官方部件包及 Blue Seoul 6.0，含轿车和巴士。交通计划为 81 条循环路线、1,201 辆车（105 辆巴士），按道路投影布点的最大间隔 55 格，见 `verification/iv-traffic-road-gaps.json`。这是初始布点间隔，行驶中会因避让行人或前车而变化。城市交通在弯道减速，偏离道路或长期卡住时回到安全路点；模组配置已关闭车辆撞坏方块、爆炸和爆胎。

`runtime/start-city-server.ps1` 启动服务端；`runtime/launch-client.ps1 -QuickPlayServer 127.0.0.1:25576` 启动匹配版本的客户端。`citytraffic start` 只补充尚未登记的计划车辆，不能重复执行旧版 `city-v2-install` 或 `apply-city-life.mjs`，以免恢复已废弃的车辆方案。交通登记随世界保存在 `citytraffic-state.json`。

## 地图检查方式

本轮不进入游戏画面。唯一最终快照 `runtime/server/world-snapshot-final-20261017` 已生成 [`俯视总图`](verification/map-upgrade-final/overview.png)、[西北城区](verification/map-upgrade-final/nw.png)、[东南城区](verification/map-upgrade-final/se.png) 和 [`可缩放地图`](verification/map-upgrade-final/web/index.html)；四区绿化与少量建筑样图见 [`verification/acceptance.md`](verification/acceptance.md)。后续地图检查也可先 `save-all flush` 并复制只读快照，再用 `tools/unmined/render-map.ps1` 离线渲染。区块、建筑、围栏、轨道、恐龙实体和存档持久性由 `verification/` 下的脚本检查。

## 验收记录

已完成的检查、适用版本和交付验证范围见 [`verification/acceptance.md`](verification/acceptance.md)。当前完整计划有 262,366 条操作，服务端只读校验 0 个非法操作；旧版 64 只恐龙与 3,400 点轨道的报告只记录历史阶段。最终真实矿车完成一圈，用时 1,059.959 秒；唯一最终快照的 8,488 个轨道点及安装存档均通过文件级检查。导出清单和校验见 [`export.json`](delivery/Jurassic-City-Park-20261017-141555/export.json)，真人操作未在本轮执行。
