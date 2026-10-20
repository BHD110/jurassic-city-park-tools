# 城市车辆 v2

这是 Automobility 0.5.0.h / Minecraft 1.21.1 NeoForge 的原创车辆包，不需要额外车辆模组。`build.mjs` 生成封闭车厢轿车、巴士 OBJ、纹理、车架和低速引擎；`map/city-vehicles-v2.mjs` 生成自动驾驶车辆与路牌操作计划。第三方 JAR 没有下载或修改。

## 使用

1. 将 `modpack/city-vehicles-datapack` 放入目标世界的 `datapacks/`。将 `modpack/city-vehicles-resourcepack` 放到每个观看车辆的客户端资源包目录并启用。两者都要加载。
2. 重新进入世界或重启服务端，使 `city_vehicles` 车架和引擎注册表生效；客户端重新加载资源包。
3. 生成并审阅 `map/generated/city-vehicles-v2.json`，由现有建造器导入其 `operations`。开头仅清理旧方案中带 `city_life_traffic` 标签的车，后面放置自动驾驶路牌和新车；重复执行只会补缺失的新车。
4. 若要核对地图净空，可执行 `node map/city-vehicles-v2.mjs --check-world runtime/server/city-life-work`。该命令只读世界。

交通方案：原四环各 16 辆，两条城市主街环各 24 辆，总计 112 辆（14 辆巴士）。自动驾驶仍用 Automobility 的 `frontAttachment:{type:"automobility:autopilot"}` 与路牌，`StopsFor` 包含玩家和 Easy NPC。`Invulnerable:0b` 与旧方案一致。巴士长约 4.4 格、宽约 1.7 格、高约 2.3 格；轿车长约 2.9 格、宽约 1.4 格、高约 1.5 格。全局净空扫描约 18,591 格，未发现障碍。

`city_vehicles:urban` 的速度参数为 0.31、扭矩为 0.22；Automobility 原石质引擎分别为 0.58、0.30。这是模组内部参数，不等于实测格/秒；实际速度、跟车距离和转弯应在游戏里看一轮。若车流仍快，可将 `modpack/city-vehicles-datapack/data/city_vehicles/automobility/automobile_engine/urban.json` 中 `speed` 小幅降到 0.27，重载数据包后重新放车或重进世界观察。

预览图 `city-vehicles-preview.png` 直接从输出 OBJ 和 PNG 渲染，轮子按原版 Automobility 标准轮位置示意；尚未做游戏内渲染实测。资源模型路径和车架 JSON 是按本地 Automobility 0.5.0.h 源码核对的。
