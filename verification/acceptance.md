# 验收记录

截至 2026-10-17。当前完整计划为 [`upgrade-full.json`](../map/generated/upgrade-full.json)，SHA256 `C6BC15D220A3A9CAEFC4250E44143FA1ACFFB48413AB888329D3C5CF6180E1BD`。此文件用于核对和校验，已施工世界只执行增量补丁，不重放完整计划。

| 项目 | 当前结论 | 证据与范围 |
| --- | --- | --- |
| 完整计划 | 已合成并只读校验 | 262,366 项操作、319 座建筑、8 个围场、128 只恐龙、8,488 个轨道点。服务端 `parkbuild validate upgrade-full` 检查 262,366 项，非法操作 0。 |
| 城市建筑与四份素材 | 已施工，最终快照重点抽样通过 | 313 座城市建筑完成改建；12 座主楼真实存档双角图见 [`architecture-12-real-save/`](architecture-12-real-save/)。Ocean House、Mediterranean Style Home、Fisherman House、JPOG 游客中心的来源和导入状态见 [`asset-manifest.json`](../map/references/assets/asset-manifest.json)。最终快照中 city09、city06 和 JPOG、Fisherman、Ocean House 的双角抽样见 [`architecture-final-samples/`](architecture-final-samples/)。JPOG 入口旁旧外框已清，后方 H 平台是导入素材自带构件。 |
| 固定种子绿化 | 增量施工完成，最终快照四区抽样通过 | [`city-green-density.report.json`](../map/generated/city-green-density.report.json)：11,680 个植被点，四个城区象限均有新增；8 米网格可种地采样覆盖率从 3.4% 升至 72.6%，保护区重叠 0。服务端 55,863/55,863 项完成，放置 367,108 个方块。该覆盖率是采样指标，不是全图逐格比例。最终快照的四象限树干及草地支撑检查见 [`green-samples.json`](map-upgrade-final/green-samples.json)，4/4 通过。 |
| 恐龙数量与活动 | 128 只施工、活动抽样及重启持久性通过 | [`population-expansion-check.json`](population-expansion-check.json) 核对原 64 个 UUID 保留、新增 64 个独立 UUID 和八物种 `20/20/12/16/16/16/16/12`。[`final-restart-persistence-audit.json`](final-restart-persistence-audit.json) 显示重启前后 128 个 UUID 全保留；围场区块未加载期间无位移。[`population-activity-day-check.json`](population-activity-day-check.json) 在临时加载少量区块后观察到八物种白天均有位移，加载已撤销。 |
| 观光轨道 | 最终实车整圈及快照、安装存档核对通过 | [`coaster-acceptance.md`](coaster-acceptance.md)：服务端真实矿车完成 1 圈、1,059.959 秒，覆盖八围场，逐 tick 最大前跳 1；8,488 个轨道点的支撑、净空与车站控制块在最终快照及安装存档均为 0 错。 |
| 最终单人存档 | 已导出、安装并通过文件级核对 | [`export.json`](../delivery/Jurassic-City-Park-20261017-141555/export.json)：112 个世界文件与安装副本逐文件一致；128 只恐龙在围场，创造模式、命令权限与出生点 `0 / 65 / 657` 正确。用户要求不进入游戏画面，因此真人在 HMCL 中按按钮、乘车和退出重进未执行，也不宣称通过。 |

[`summary.json`](../map/generated/summary.json) 的 64 只恐龙、3,400 个轨道点和 114,195 项操作是原始 `full.json` 阶段，不是当前版本。[`activity-audit.json`](activity-audit.json) 和 [`persistence-audit.json`](persistence-audit.json) 也只涉及旧 64 只阶段；旧玩家 [`player-ride.json`](player-ride.json) 的 427.596 秒关联旧计划，不能作为最终版结果。[`report-full.md`](report-full.md) 因 `runtime-provenance` 校验失败，不能写成整份通过。

## 最终回填

| 项目 | 结果 / 证据 |
| --- | --- |
| 128 只恐龙重启后 UUID、数量、健康状态 | 128 个 UUID 全保留；见 [`final-restart-persistence-audit.json`](final-restart-persistence-audit.json) 与 [`final-after-restart-save-audit.json`](final-after-restart-save-audit.json)。 |
| 最终轨道静态/世界净空、真实整圈及计划 SHA | SHA256 `C6BC15D220A3A9CAEFC4250E44143FA1ACFFB48413AB888329D3C5CF6180E1BD`；[`upgrade-full-route-check.json`](upgrade-full-route-check.json) 静态及实车关键项均通过；[`upgrade-full-world-rail-check.json`](upgrade-full-world-rail-check.json) 对唯一最终快照检查 8,488 点、0 错；实车 1 圈、1,059.959 秒、八区采样及逐 tick 最大前跳 1。 |
| 唯一最终快照的全局绿化与少量素材抽样 | [`overview.png`](map-upgrade-final/overview.png)、[`nw.png`](map-upgrade-final/nw.png)、[`se.png`](map-upgrade-final/se.png) 和 [`可缩放地图`](map-upgrade-final/web/index.html) 均来自 `runtime/server/world-snapshot-final-20261017`；网页 144 张地形瓦片、失败 0。绿化四象限树干及草地支撑 4/4 通过；city09、city06 与 JPOG、Fisherman、Ocean House 双角样图见 [`architecture-final-samples/`](architecture-final-samples/)。这是一轮全图及少量抽样，不代表 313 座逐栋复查。 |
| 最终存档导出位置及校验信息 | `delivery/Jurassic-City-Park-20261017-141555/Jurassic City Park`；已安装到 HMCL `1.21.1-NeoForge/saves/Jurassic City Park`；[`export.json`](../delivery/Jurassic-City-Park-20261017-141555/export.json) 记录 112 个文件、约 99.6 MB、安装副本逐文件一致及 SHA256 文件清单。 |
| 出生点与三个按钮的最终存档工具检查 | [`final-installed-save-audit.json`](final-installed-save-audit.json) 核对创造模式、命令权限、出生点 `0 / 65 / 657`；[`upgrade-full-installed-world-rail-check.json`](upgrade-full-installed-world-rail-check.json) 核对 3 个按钮、7 个命令方块的方块状态和完整命令，0 错。真人进入、按按钮、乘车与重进依用户限制未做。 |
