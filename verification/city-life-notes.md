# 城市人流与自动交通

本轮在玩家实际游玩后的 `Jurassic City Park` 存档上增加城市活动。修改前已正常退出客户端，并备份原存档与原模组。原始备份位置记录在 `runtime/city-life-backup-path.txt`；历史交付目录保留原版。

- 行人：374 名，分散在 80 栋城市主楼、车站、游客中心和入口附近。九种默认人物皮肤与工作人员皮肤轮换。使用 Easy NPC 的真实寻路、环绕出生点漫游和返家目标，无需接入对话或外部 AI。
- 汽车：48 辆，四个城区各 12 辆，使用 Automobility 自带自动驾驶、转向和跟车控制。东北走内侧主路，西北、东南、西南走外侧主路，避开原有轨道立柱和装饰巴士。
- 原有 128 只恐龙保留全部 UUID。建筑和观光轨道保留；新路牌只在已核对为空气的道路位置放置。

新增官方模组：Automobility 0.5.0.h、Easy NPC Core 7.15.0、Easy NPC Config UI 7.15.0，均为 1.21.1 NeoForge 版。下载源和哈希见 `modpack/manifest.json`、`modpack/city-life-manifest.json`。没有修改第三方 JAR。

NPC 的 `MOVE_BACK_TO_HOME` 实际只使用 `StopDistance`，不使用 `StartDistance`。本轮将返家半径设为 14 格，避免三格返家半径频繁打断散步。它是大致活动范围，不是严格的围栏限制。已有交互默认保留。

车辆使用正常可受伤设置，不设置 `Invulnerable:1b`：官方 0.5.0.h 的自动驾驶在无父车辆的临时碰撞体旁，会对无敌车辆进入一个空引用分支。测试副本在传送旧车换路线时复现过该异常；恢复正常车辆设置后重测。车辆 `despawnTime=-1`，不会按模组计时自行消失。行人保留无敌和持久化设置。

验收采用全局数量和 UUID 检查、整段道路净空扫描、代表性活动抽样及保存重启检查。临时强制加载仅用于测试，交付时清除；正常游玩时远离玩家的区块按 Minecraft 规则暂停模拟，返回附近后继续。生成脚本不是开机启动任务，不会每次进世界重复生成人或车。

文件：`city-life-pre-restart-audit.json`、`city-life-save-audit.json`、`city-life-rail-audit.json`、`city-life-48-traffic-movement.json`、`city-life-after-restart-movement.json`。最终通过与否以对应 JSON 的实际结果为准。
