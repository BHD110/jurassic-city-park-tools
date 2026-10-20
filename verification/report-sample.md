# 地图验收报告（sample）
生成时间：2026-10-16T19:14:37.381Z
状态：pending
通过 22，警告 2，错误 0

- [通过] route-coordinates：无效坐标 0 个，非整数方块坐标 0 个
- [通过] route-length：声明长度 890，要求 4-100000
- [通过] route-point-count：声明 890，实际 890，metadata 890
- [通过] route-duplicates：轨道坐标无重复
- [通过] route-closure：首尾闭合且每段相邻
- [通过] non-sequential-adjacency：没有非顺序相邻轨道
- [通过] rail-shapes：0 个轨道 shape 缺失或非法
- [通过] connection-shapes：0 个平地轨道形状与相邻轨道方向不符；例：
- [通过] slope-shapes：0 个坡段的 ascending 方向与高低端不一致
- [通过] slope-turns：0 个坡段同时转弯，上下坡必须保持直线
- [通过] rail-blocks：0 个路线点的最终方块不是声明的铁轨或形状不符；例：
- [通过] powered-rail：443 个动力轨道中 0 个未满足直线或红石块供电；例：
- [通过] rail-support：0 个轨道下方不是可接受支撑方块；例：
- [通过] headroom：0 个轨道头顶 2 格存在障碍；例：
- [通过] station-on-route：站台 0,64,100 附近有轨道
- [通过] station-clearance：站台上方净空障碍 0 格
- [待补数据] station-data：站台净空有 20 格未在 operations 中给出
- [通过] building-overlap：建筑占地重叠 0 对
- [通过] enclosure-rail-distance：0 个围场距轨道小于 5 格
- [通过] zone-index：围场 1 个，路线展示区 1 个；每个围场均需对应展示区
- [通过] zone-coverage：0 个展示区距轨道超过 64 格
- [通过] zone-dinosaurs：0 个展示区恐龙数量或物种不足
- [通过] dinosaur-count：恐龙数量 2，期望至少 2
- [待补数据] runtime-timing：未找到 D:\codeSource\product\我的世界-小蒙\runtime\server\parkbuild-sample-railtest.json；需要服务端 railtest 实测日志
