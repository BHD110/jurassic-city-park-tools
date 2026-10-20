# 城市观光轨道验收

截至 2026-10-17。绿化和恐龙扩容已分别用增量补丁施工。最终合并计划 `upgrade-full` 仅用于核对当前世界的完整组成，不作为施工任务重放。

## 候选轨道

- [`city-coaster-route-report.json`](city-coaster-route-report.json)：路线 8,488 点，Y=64..94；静态碰撞 0，八个围场都有可见恐龙点位。
- [`city-coaster-route-route-check.json`](city-coaster-route-route-check.json)：候选计划的闭环、方块、支撑、净空、车站发车方向及八区声明全过；服务端矿车整圈、时长、贴轨和八区采样通过。旧版测试器没有逐 tick 跳点字段，候选报告未覆盖此项。
- [`city-coaster-route-world-rail-check.json`](city-coaster-route-world-rail-check.json)：已保存世界快照的 8,488 处轨道、支撑、净空及车站按钮/命令方块检查均为 0 错。报告中的计划 SHA256 为 `6aea1cd00d8cd88944667d9d0a8b18119f632e9928be34656021c33715cb2c31`。
- [`../runtime/server/parkbuild-railtest-city-coaster-route.json`](../runtime/server/parkbuild-railtest-city-coaster-route.json)：服务端真实矿车载盔甲架完成 1 圈，21,211 tick，1,060.461 秒（17 分 40 秒）。213 个位置样本从路线索引 39 一直前进到 8,483，再回到车站索引 0；相邻样本前进 5..41 点，无异常倒退。八个围场段均有样本；该报告的计划 SHA256 与上述世界检查一致。
- [`coaster-dinosaur-check.json`](coaster-dinosaur-check.json)：候选世界中 64 只恐龙都存活并留在所属围场。

候选车测试使用的旧版测试器没有逐 tick 的 `maxForwardJump` 字段；下述最终实车使用了新版测试器。

## 最终版结果

1. [`upgrade-full.json`](../map/generated/upgrade-full.json) 的 SHA256 为 `C6BC15D220A3A9CAEFC4250E44143FA1ACFFB48413AB888329D3C5CF6180E1BD`；服务端只读校验 262,366 项操作、非法 0 项。完整计划没有重放施工。
2. [`upgrade-full-route-check.json`](upgrade-full-route-check.json) 对闭环、方块、支撑、净空、发车方向和八区声明的静态检查全通过；关联最终实车的来源、一圈不少于 300 秒、贴轨、八区采样和逐 tick 无异常跳点也全通过。
3. [`parkbuild-railtest-upgrade-full.json`](../runtime/server/parkbuild-railtest-upgrade-full.json) 记录服务端真实矿车完成 1 圈，21,211 tick，1,059.959 秒（约 17 分 40 秒），`maxForwardJump=1`、`minTps=20`；计划和路线 SHA 与上项一致。首次最终测试在西城拐角回弹并被人工停止，失败报告保留在 [`railtest-upgrade-full-failed-20261017.json`](railtest-upgrade-full-failed-20261017.json)。同条件短段测试通过后，未改变计划和轨道，复跑完成。首次回弹原因未确定；无标签空车未删除或移动。
4. 唯一最终快照为 `runtime/server/world-snapshot-final-20261017`。[`upgrade-full-world-rail-check.json`](upgrade-full-world-rail-check.json) 对 8,488 个轨道点、支撑、净空、3 个按钮和 7 个命令方块核对，四类错误均为 0；安装存档的相同检查见 [`upgrade-full-installed-world-rail-check.json`](upgrade-full-installed-world-rail-check.json)，也为 0 错。
5. 真人按车站按钮上车、完整乘车及退出重进依用户要求未进入游戏画面，因此未执行。服务端矿车测试和命令方块文件核对不等于真人操作测试。

`runtime/server/control.ps1` 依赖 PowerShell 7，须用 `pwsh` 调用；Windows PowerShell 5 的 `NetworkStream` 没有 `ReadExactly` 方法。
