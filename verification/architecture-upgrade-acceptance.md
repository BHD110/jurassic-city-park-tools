# 建筑改建真实存档验收

施工前快照：`tools\unmined\world-snapshot-20261017-city-variation-v2`
施工后快照：`tools\unmined\world-snapshot-mediterranean-20261017`（包含 city-06 素材替换）

共 313 栋：主楼 80、配楼 158、小店 75。屋顶、外墙、入口区域各 313/313 栋发生真实方块变化；南侧入口 313/313 处由地块外步行可达；底层 313/313 栋的全部实体方块有下方地基支撑。

统计直接读取 Minecraft 1.21.1 Anvil 区块。屋顶取新建筑最高 6 层；外墙取新边界内外 2 格、Y=65..78；入口取正面中心 9 格宽、Y=64..71。每格比较施工前后方块状态；通路沿可站立方块做两格净空广度搜索，允许一格高差。主楼参数来自施工 manifest。

| 建筑 | 类型/新样式 | 屋顶变更格 | 外墙变更格 | 入口变更格 | 底层支撑 | 入口可达 | 主楼变体 |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| city-01 | main / tropical-civic-hall | 5420 | 2655 | 214 | 1670/1670 | 是 | 轮次1 / 色板light_gray_concrete+dark_oak_planks / 内缩10 |
| city-02 | main / stepped-terrace-hotel | 2807 | 2122 | 180 | 2052/2052 | 是 | 轮次1 / 色板light_gray_concrete+red_terracotta / 内缩10 |
| city-03 | main / bridge-courtyard-lodge | 1006 | 2071 | 81 | 1415/1415 | 是 | 轮次1 / 色板yellow_terracotta+mud_bricks / 内缩10 |
| city-04 | main / stepped-cinema | 5684 | 2030 | 200 | 1653/1653 | 是 | 轮次1 / 色板white_terracotta+dark_prismarine / 内缩8 |
| city-05 | main / civic-clock-hall | 5373 | 2329 | 236 | 2099/2099 | 是 | 轮次1 / 色板white_concrete+bricks / 内缩8 |
| city-06 | main / red-tile-l-villa | 1412 | 594 | 166 | 702/702 | 是 | 轮次1 / 色板light_gray_concrete+red_terracotta / 内缩8 |
| city-07 | main / open-air-market | 4039 | 1095 | 206 | 1699/1699 | 是 | 轮次1 / 色板yellow_terracotta+mud_bricks / 内缩8 |
| city-08 | main / tropical-greenhouse | 986 | 1961 | 232 | 1733/1733 | 是 | 轮次1 / 色板white_terracotta+dark_prismarine / 内缩8 |
| city-09 | main / sawtooth-research-sheds | 855 | 2325 | 233 | 1819/1819 | 是 | 轮次1 / 色板white_concrete+bricks / 内缩8 |
| city-10 | main / round-exhibit-hall | 1045 | 980 | 119 | 1385/1385 | 是 | 轮次1 / 色板light_gray_concrete+red_terracotta / 内缩8 |
| city-11 | main / stepped-apartment-courts | 4941 | 2219 | 162 | 1554/1554 | 是 | 轮次1 / 色板yellow_terracotta+mud_bricks / 内缩8 |
| city-12 | main / timber-tropical-lodge | 5717 | 1900 | 171 | 1667/1667 | 是 | 轮次1 / 色板white_terracotta+dark_prismarine / 内缩8 |
| city-13 | main / tropical-civic-hall | 175 | 1804 | 59 | 1567/1567 | 是 | 轮次2 / 色板light_gray_concrete+red_terracotta / 内缩9 |
| city-14 | main / stepped-terrace-hotel | 2698 | 1840 | 180 | 1828/1828 | 是 | 轮次2 / 色板yellow_terracotta+mud_bricks / 内缩9 |
| city-15 | main / bridge-courtyard-lodge | 4082 | 2839 | 162 | 2402/2402 | 是 | 轮次2 / 色板white_terracotta+dark_prismarine / 内缩9 |
| city-16 | main / stepped-cinema | 1431 | 1666 | 200 | 1045/1045 | 是 | 轮次2 / 色板white_concrete+bricks / 内缩9 |
| city-17 | main / civic-clock-hall | 359 | 1987 | 236 | 1267/1267 | 是 | 轮次2 / 色板light_gray_concrete+red_terracotta / 内缩9 |
| city-18 | main / red-tile-l-villa | 5299 | 2278 | 168 | 1664/1664 | 是 | 轮次2 / 色板yellow_terracotta+mud_bricks / 内缩9 |
| city-19 | main / open-air-market | 3713 | 1009 | 162 | 1605/1605 | 是 | 轮次2 / 色板white_terracotta+dark_prismarine / 内缩9 |
| city-20 | main / tropical-greenhouse | 1104 | 1695 | 130 | 1959/1959 | 是 | 轮次2 / 色板white_concrete+bricks / 内缩9 |
| city-21 | main / sawtooth-research-sheds | 3202 | 1999 | 233 | 1657/1657 | 是 | 轮次2 / 色板light_gray_concrete+red_terracotta / 内缩9 |
| city-22 | main / round-exhibit-hall | 1737 | 1680 | 221 | 1398/1398 | 是 | 轮次2 / 色板yellow_terracotta+mud_bricks / 内缩9 |
| city-23 | main / stepped-apartment-courts | 386 | 1812 | 81 | 1173/1173 | 是 | 轮次2 / 色板white_terracotta+dark_prismarine / 内缩9 |
| city-24 | main / timber-tropical-lodge | 6237 | 1286 | 171 | 1565/1565 | 是 | 轮次2 / 色板white_concrete+bricks / 内缩9 |
| city-25 | main / tropical-civic-hall | 3719 | 2941 | 178 | 2169/2169 | 是 | 轮次3 / 色板yellow_terracotta+mud_bricks / 内缩10 |
| city-26 | main / stepped-terrace-hotel | 871 | 1513 | 180 | 1181/1181 | 是 | 轮次3 / 色板white_terracotta+dark_prismarine / 内缩10 |
| city-27 | main / bridge-courtyard-lodge | 411 | 2522 | 162 | 1526/1526 | 是 | 轮次3 / 色板white_concrete+bricks / 内缩10 |
| city-28 | main / stepped-cinema | 330 | 1628 | 200 | 993/993 | 是 | 轮次3 / 色板light_gray_concrete+red_terracotta / 内缩10 |
| city-29 | main / civic-clock-hall | 401 | 1956 | 236 | 1161/1161 | 是 | 轮次3 / 色板yellow_terracotta+mud_bricks / 内缩10 |
| city-30 | main / red-tile-l-villa | 1115 | 2119 | 8 | 1907/1907 | 是 | 轮次3 / 色板white_terracotta+dark_prismarine / 内缩10 |
| city-31 | main / open-air-market | 3356 | 931 | 172 | 1449/1449 | 是 | 轮次3 / 色板white_concrete+bricks / 内缩10 |
| city-32 | main / tropical-greenhouse | 3640 | 2433 | 232 | 2201/2201 | 是 | 轮次3 / 色板light_gray_concrete+red_terracotta / 内缩10 |
| city-33 | main / sawtooth-research-sheds | 1182 | 1657 | 153 | 1287/1287 | 是 | 轮次3 / 色板yellow_terracotta+mud_bricks / 内缩10 |
| city-34 | main / round-exhibit-hall | 3172 | 1314 | 182 | 1373/1373 | 是 | 轮次3 / 色板white_terracotta+dark_prismarine / 内缩10 |
| city-35 | main / stepped-apartment-courts | 5511 | 2379 | 162 | 1794/1794 | 是 | 轮次3 / 色板white_concrete+bricks / 内缩10 |
| city-36 | main / timber-tropical-lodge | 3295 | 1426 | 198 | 1299/1299 | 是 | 轮次3 / 色板light_gray_concrete+red_terracotta / 内缩10 |
| city-37 | main / tropical-civic-hall | 175 | 2257 | 170 | 1873/1873 | 是 | 轮次4 / 色板white_terracotta+dark_prismarine / 内缩8 |
| city-38 | main / stepped-terrace-hotel | 579 | 1712 | 180 | 1557/1557 | 是 | 轮次4 / 色板white_concrete+bricks / 内缩8 |
| city-39 | main / bridge-courtyard-lodge | 718 | 2828 | 162 | 1940/1940 | 是 | 轮次4 / 色板light_gray_concrete+red_terracotta / 内缩8 |
| city-40 | main / stepped-cinema | 586 | 1727 | 95 | 1603/1603 | 是 | 轮次4 / 色板yellow_terracotta+mud_bricks / 内缩8 |
| city-41 | main / civic-clock-hall | 2478 | 1953 | 236 | 1485/1485 | 是 | 轮次4 / 色板white_terracotta+dark_prismarine / 内缩8 |
| city-42 | main / red-tile-l-villa | 4171 | 3035 | 168 | 2722/2722 | 是 | 轮次4 / 色板white_concrete+bricks / 内缩8 |
| city-43 | main / open-air-market | 3103 | 925 | 81 | 1539/1539 | 是 | 轮次4 / 色板light_gray_concrete+red_terracotta / 内缩8 |
| city-44 | main / tropical-greenhouse | 4777 | 2185 | 232 | 2201/2201 | 是 | 轮次4 / 色板yellow_terracotta+mud_bricks / 内缩8 |
| city-45 | main / sawtooth-research-sheds | 7015 | 2396 | 232 | 2462/2462 | 是 | 轮次4 / 色板white_terracotta+dark_prismarine / 内缩8 |
| city-46 | main / round-exhibit-hall | 2717 | 1314 | 182 | 1373/1373 | 是 | 轮次4 / 色板white_concrete+bricks / 内缩8 |
| city-47 | main / stepped-apartment-courts | 566 | 2372 | 162 | 1495/1495 | 是 | 轮次4 / 色板light_gray_concrete+red_terracotta / 内缩8 |
| city-48 | main / timber-tropical-lodge | 3754 | 1635 | 171 | 1496/1496 | 是 | 轮次4 / 色板yellow_terracotta+mud_bricks / 内缩8 |
| city-49 | main / tropical-civic-hall | 316 | 2060 | 142 | 1773/1773 | 是 | 轮次5 / 色板white_concrete+bricks / 内缩9 |
| city-50 | main / stepped-terrace-hotel | 721 | 1477 | 153 | 1769/1769 | 是 | 轮次5 / 色板light_gray_concrete+red_terracotta / 内缩9 |
| city-51 | main / bridge-courtyard-lodge | 3061 | 2451 | 162 | 1760/1760 | 是 | 轮次5 / 色板yellow_terracotta+mud_bricks / 内缩9 |
| city-52 | main / stepped-cinema | 2810 | 2323 | 200 | 1821/1821 | 是 | 轮次5 / 色板white_terracotta+dark_prismarine / 内缩9 |
| city-53 | main / civic-clock-hall | 359 | 1537 | 181 | 1113/1113 | 是 | 轮次5 / 色板white_concrete+bricks / 内缩9 |
| city-54 | main / red-tile-l-villa | 4119 | 2552 | 168 | 2155/2155 | 是 | 轮次5 / 色板light_gray_concrete+red_terracotta / 内缩9 |
| city-55 | main / open-air-market | 5255 | 1247 | 178 | 2199/2199 | 是 | 轮次5 / 色板yellow_terracotta+mud_bricks / 内缩9 |
| city-56 | main / tropical-greenhouse | 1801 | 1819 | 232 | 1471/1471 | 是 | 轮次5 / 色板white_terracotta+dark_prismarine / 内缩9 |
| city-57 | main / sawtooth-research-sheds | 578 | 2280 | 233 | 1594/1594 | 是 | 轮次5 / 色板white_concrete+bricks / 内缩9 |
| city-58 | main / round-exhibit-hall | 2478 | 1266 | 182 | 1257/1257 | 是 | 轮次5 / 色板light_gray_concrete+red_terracotta / 内缩9 |
| city-59 | main / stepped-apartment-courts | 540 | 2296 | 162 | 1385/1385 | 是 | 轮次5 / 色板yellow_terracotta+mud_bricks / 内缩9 |
| city-60 | main / timber-tropical-lodge | 4316 | 1061 | 18 | 1565/1565 | 是 | 轮次5 / 色板white_terracotta+dark_prismarine / 内缩9 |
| city-61 | main / tropical-civic-hall | 5087 | 2637 | 232 | 1623/1623 | 是 | 轮次6 / 色板light_gray_concrete+red_terracotta / 内缩10 |
| city-62 | main / stepped-terrace-hotel | 2286 | 2092 | 180 | 1997/1997 | 是 | 轮次6 / 色板yellow_terracotta+mud_bricks / 内缩10 |
| city-63 | main / bridge-courtyard-lodge | 1071 | 2049 | 81 | 1366/1366 | 是 | 轮次6 / 色板white_terracotta+dark_prismarine / 内缩10 |
| city-64 | main / stepped-cinema | 3552 | 1858 | 200 | 1341/1341 | 是 | 轮次6 / 色板white_concrete+bricks / 内缩10 |
| city-65 | main / civic-clock-hall | 2752 | 2066 | 234 | 1719/1719 | 是 | 轮次6 / 色板light_gray_concrete+red_terracotta / 内缩10 |
| city-66 | main / red-tile-l-villa | 4796 | 2135 | 168 | 1390/1390 | 是 | 轮次6 / 色板yellow_terracotta+mud_bricks / 内缩10 |
| city-67 | main / open-air-market | 3185 | 897 | 172 | 1387/1387 | 是 | 轮次6 / 色板white_terracotta+dark_prismarine / 内缩10 |
| city-68 | main / tropical-greenhouse | 2669 | 1781 | 232 | 1425/1425 | 是 | 轮次6 / 色板white_concrete+bricks / 内缩10 |
| city-69 | main / sawtooth-research-sheds | 690 | 2152 | 233 | 1488/1488 | 是 | 轮次6 / 色板light_gray_concrete+red_terracotta / 内缩10 |
| city-70 | main / round-exhibit-hall | 1045 | 983 | 77 | 1373/1373 | 是 | 轮次6 / 色板yellow_terracotta+mud_bricks / 内缩10 |
| city-71 | main / stepped-apartment-courts | 3665 | 1980 | 162 | 1224/1224 | 是 | 轮次6 / 色板white_terracotta+dark_prismarine / 内缩10 |
| city-72 | main / timber-tropical-lodge | 5308 | 1698 | 171 | 1619/1619 | 是 | 轮次6 / 色板white_concrete+bricks / 内缩10 |
| city-73 | main / tropical-civic-hall | 329 | 1872 | 61 | 1717/1717 | 是 | 轮次7 / 色板yellow_terracotta+mud_bricks / 内缩8 |
| city-74 | main / stepped-terrace-hotel | 4403 | 1920 | 180 | 1997/1997 | 是 | 轮次7 / 色板white_terracotta+dark_prismarine / 内缩8 |
| city-75 | main / bridge-courtyard-lodge | 6752 | 2955 | 162 | 2610/2610 | 是 | 轮次7 / 色板white_concrete+bricks / 内缩8 |
| city-76 | main / stepped-cinema | 1892 | 1752 | 200 | 1173/1173 | 是 | 轮次7 / 色板light_gray_concrete+red_terracotta / 内缩8 |
| city-77 | main / civic-clock-hall | 359 | 2177 | 236 | 1429/1429 | 是 | 轮次7 / 色板yellow_terracotta+mud_bricks / 内缩8 |
| city-78 | main / red-tile-l-villa | 5736 | 2377 | 168 | 1839/1839 | 是 | 轮次7 / 色板white_terracotta+dark_prismarine / 内缩8 |
| city-79 | main / open-air-market | 4230 | 1129 | 206 | 1769/1769 | 是 | 轮次7 / 色板white_concrete+bricks / 内缩8 |
| city-80 | main / tropical-greenhouse | 1196 | 1807 | 130 | 2137/2137 | 是 | 轮次7 / 色板light_gray_concrete+red_terracotta / 内缩8 |
| city-annex-1-l | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-1-r | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-2-l | annex / corner-tower-shop | 140 | 1306 | 200 | 390/390 | 是 | - |
| city-annex-2-r | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-3-l | annex / courtyard-cafe | 736 | 1366 | 185 | 359/359 | 是 | - |
| city-annex-3-r | annex / corner-tower-shop | 140 | 1401 | 200 | 390/390 | 是 | - |
| city-annex-4-l | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-4-r | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-5-l | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-5-r | annex / terrace-shop | 1110 | 977 | 212 | 250/250 | 是 | - |
| city-annex-6-l | annex / corner-tower-shop | 140 | 1401 | 200 | 396/396 | 是 | - |
| city-annex-6-r | annex / arcade-store | 1777 | 1214 | 227 | 390/390 | 是 | - |
| city-annex-7-l | annex / courtyard-cafe | 445 | 1255 | 184 | 359/359 | 是 | - |
| city-annex-7-r | annex / corner-tower-shop | 140 | 1318 | 199 | 390/390 | 是 | - |
| city-annex-8-l | annex / terrace-shop | 884 | 941 | 210 | 250/250 | 是 | - |
| city-annex-8-r | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-9-l | annex / arcade-store | 822 | 599 | 204 | 162/162 | 是 | - |
| city-annex-9-r | annex / terrace-shop | 836 | 613 | 195 | 162/162 | 是 | - |
| city-annex-10-l | annex / corner-tower-shop | 140 | 1305 | 200 | 390/390 | 是 | - |
| city-annex-10-r | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-11-l | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-11-r | annex / corner-tower-shop | 140 | 1237 | 200 | 390/390 | 是 | - |
| city-annex-12-l | annex / terrace-shop | 1302 | 1040 | 212 | 250/250 | 是 | - |
| city-annex-12-r | annex / courtyard-cafe | 736 | 1366 | 185 | 359/359 | 是 | - |
| city-annex-13-l | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-13-r | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-14-l | annex / corner-tower-shop | 140 | 1306 | 200 | 390/390 | 是 | - |
| city-annex-14-r | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-15-l | annex / courtyard-cafe | 736 | 1378 | 184 | 359/359 | 是 | - |
| city-annex-15-r | annex / corner-tower-shop | 140 | 1413 | 199 | 390/390 | 是 | - |
| city-annex-16-l | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-16-r | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-17-l | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-17-r | annex / terrace-shop | 1110 | 977 | 212 | 250/250 | 是 | - |
| city-annex-18-l | annex / corner-tower-shop | 140 | 1401 | 200 | 390/390 | 是 | - |
| city-annex-18-r | annex / arcade-store | 1777 | 1214 | 227 | 390/390 | 是 | - |
| city-annex-19-l | annex / courtyard-cafe | 817 | 725 | 227 | 162/162 | 是 | - |
| city-annex-19-r | annex / corner-tower-shop | 763 | 725 | 227 | 162/162 | 是 | - |
| city-annex-20-l | annex / terrace-shop | 884 | 941 | 210 | 250/250 | 是 | - |
| city-annex-20-r | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-21-l | annex / arcade-store | 1777 | 1214 | 227 | 390/390 | 是 | - |
| city-annex-21-r | annex / terrace-shop | 1302 | 1040 | 212 | 250/250 | 是 | - |
| city-annex-22-l | annex / corner-tower-shop | 140 | 1318 | 199 | 390/390 | 是 | - |
| city-annex-22-r | annex / arcade-store | 1529 | 1194 | 226 | 390/390 | 是 | - |
| city-annex-23-l | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-23-r | annex / corner-tower-shop | 140 | 1237 | 200 | 390/390 | 是 | - |
| city-annex-24-l | annex / terrace-shop | 1302 | 1040 | 212 | 250/250 | 是 | - |
| city-annex-24-r | annex / courtyard-cafe | 736 | 1366 | 185 | 359/359 | 是 | - |
| city-annex-25-l | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-25-r | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-26-l | annex / corner-tower-shop | 140 | 1306 | 200 | 390/390 | 是 | - |
| city-annex-26-r | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-27-l | annex / courtyard-cafe | 736 | 1366 | 185 | 359/359 | 是 | - |
| city-annex-27-r | annex / corner-tower-shop | 140 | 1401 | 200 | 390/390 | 是 | - |
| city-annex-28-l | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-28-r | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-29-l | annex / arcade-store | 773 | 793 | 200 | 162/162 | 是 | - |
| city-annex-29-r | annex / terrace-shop | 719 | 793 | 200 | 162/162 | 是 | - |
| city-annex-30-l | annex / corner-tower-shop | 140 | 1413 | 199 | 390/390 | 是 | - |
| city-annex-30-r | annex / arcade-store | 1777 | 1225 | 226 | 390/390 | 是 | - |
| city-annex-31-l | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-31-r | annex / corner-tower-shop | 140 | 1305 | 200 | 390/390 | 是 | - |
| city-annex-32-l | annex / terrace-shop | 884 | 941 | 210 | 250/250 | 是 | - |
| city-annex-32-r | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-33-l | annex / arcade-store | 1777 | 1214 | 227 | 390/390 | 是 | - |
| city-annex-33-r | annex / terrace-shop | 1302 | 1040 | 212 | 250/250 | 是 | - |
| city-annex-34-l | annex / corner-tower-shop | 140 | 1305 | 200 | 390/390 | 是 | - |
| city-annex-34-r | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-35-l | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-35-r | annex / corner-tower-shop | 140 | 1237 | 200 | 390/390 | 是 | - |
| city-annex-36-l | annex / terrace-shop | 1302 | 1040 | 212 | 250/250 | 是 | - |
| city-annex-36-r | annex / courtyard-cafe | 736 | 1366 | 185 | 359/359 | 是 | - |
| city-annex-37-l | annex / arcade-store | 1529 | 1194 | 226 | 390/390 | 是 | - |
| city-annex-37-r | annex / terrace-shop | 806 | 988 | 211 | 250/250 | 是 | - |
| city-annex-38-l | annex / corner-tower-shop | 140 | 1306 | 200 | 390/390 | 是 | - |
| city-annex-38-r | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-39-l | annex / courtyard-cafe | 822 | 599 | 204 | 162/162 | 是 | - |
| city-annex-39-r | annex / corner-tower-shop | 836 | 613 | 195 | 162/162 | 是 | - |
| city-annex-40-l | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-40-r | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-41-l | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-41-r | annex / terrace-shop | 1110 | 977 | 212 | 250/250 | 是 | - |
| city-annex-42-l | annex / corner-tower-shop | 140 | 1401 | 200 | 390/390 | 是 | - |
| city-annex-42-r | annex / arcade-store | 1777 | 1214 | 227 | 390/390 | 是 | - |
| city-annex-43-l | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-43-r | annex / corner-tower-shop | 140 | 1305 | 200 | 390/390 | 是 | - |
| city-annex-44-l | annex / terrace-shop | 884 | 941 | 210 | 250/250 | 是 | - |
| city-annex-44-r | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-45-l | annex / arcade-store | 1777 | 1225 | 226 | 390/390 | 是 | - |
| city-annex-45-r | annex / terrace-shop | 1302 | 1052 | 211 | 250/250 | 是 | - |
| city-annex-46-l | annex / corner-tower-shop | 140 | 1305 | 200 | 390/390 | 是 | - |
| city-annex-46-r | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-47-l | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-47-r | annex / corner-tower-shop | 140 | 1237 | 200 | 390/390 | 是 | - |
| city-annex-48-l | annex / terrace-shop | 1302 | 1040 | 212 | 250/250 | 是 | - |
| city-annex-48-r | annex / courtyard-cafe | 736 | 1366 | 185 | 359/359 | 是 | - |
| city-annex-49-l | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-49-r | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-50-l | annex / corner-tower-shop | 140 | 1306 | 200 | 390/390 | 是 | - |
| city-annex-50-r | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-51-l | annex / courtyard-cafe | 736 | 1366 | 185 | 359/359 | 是 | - |
| city-annex-51-r | annex / corner-tower-shop | 140 | 1401 | 200 | 390/390 | 是 | - |
| city-annex-52-l | annex / terrace-shop | 806 | 988 | 211 | 250/250 | 是 | - |
| city-annex-52-r | annex / courtyard-cafe | 445 | 1255 | 184 | 359/359 | 是 | - |
| city-annex-53-l | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-53-r | annex / terrace-shop | 1110 | 977 | 212 | 250/250 | 是 | - |
| city-annex-54-l | annex / corner-tower-shop | 140 | 1401 | 200 | 390/390 | 是 | - |
| city-annex-54-r | annex / arcade-store | 1777 | 1214 | 227 | 390/390 | 是 | - |
| city-annex-55-l | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-55-r | annex / corner-tower-shop | 140 | 1305 | 200 | 390/390 | 是 | - |
| city-annex-56-l | annex / terrace-shop | 884 | 941 | 210 | 250/250 | 是 | - |
| city-annex-56-r | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-57-l | annex / arcade-store | 1777 | 1214 | 227 | 390/390 | 是 | - |
| city-annex-57-r | annex / terrace-shop | 1302 | 1040 | 212 | 250/250 | 是 | - |
| city-annex-58-l | annex / corner-tower-shop | 140 | 1305 | 200 | 390/390 | 是 | - |
| city-annex-58-r | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-59-l | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-59-r | annex / corner-tower-shop | 140 | 1237 | 200 | 390/390 | 是 | - |
| city-annex-60-l | annex / terrace-shop | 1302 | 1052 | 211 | 250/250 | 是 | - |
| city-annex-60-r | annex / courtyard-cafe | 736 | 1378 | 184 | 359/359 | 是 | - |
| city-annex-61-l | annex / arcade-store | 817 | 725 | 227 | 162/162 | 是 | - |
| city-annex-61-r | annex / terrace-shop | 763 | 725 | 227 | 162/162 | 是 | - |
| city-annex-63-l | annex / courtyard-cafe | 893 | 631 | 204 | 181/181 | 是 | - |
| city-annex-63-r | annex / corner-tower-shop | 907 | 643 | 195 | 181/181 | 是 | - |
| city-annex-64-l | annex / terrace-shop | 683 | 653 | 227 | 124/124 | 是 | - |
| city-annex-64-r | annex / courtyard-cafe | 625 | 653 | 227 | 124/124 | 是 | - |
| city-annex-65-l | annex / arcade-store | 551 | 673 | 254 | 105/105 | 是 | - |
| city-annex-65-r | annex / terrace-shop | 512 | 673 | 254 | 105/105 | 是 | - |
| city-annex-66-l | annex / corner-tower-shop | 822 | 599 | 204 | 162/162 | 是 | - |
| city-annex-66-r | annex / arcade-store | 836 | 613 | 195 | 162/162 | 是 | - |
| city-annex-67-l | annex / courtyard-cafe | 817 | 738 | 226 | 162/162 | 是 | - |
| city-annex-67-r | annex / corner-tower-shop | 763 | 738 | 226 | 162/162 | 是 | - |
| city-annex-68-l | annex / terrace-shop | 752 | 777 | 200 | 162/162 | 是 | - |
| city-annex-68-r | annex / courtyard-cafe | 719 | 793 | 200 | 162/162 | 是 | - |
| city-annex-69-l | annex / arcade-store | 822 | 599 | 204 | 162/162 | 是 | - |
| city-annex-69-r | annex / terrace-shop | 836 | 613 | 195 | 162/162 | 是 | - |
| city-annex-70-l | annex / corner-tower-shop | 683 | 653 | 227 | 124/124 | 是 | - |
| city-annex-70-r | annex / arcade-store | 625 | 653 | 227 | 124/124 | 是 | - |
| city-annex-71-l | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-annex-71-r | annex / corner-tower-shop | 140 | 1237 | 200 | 390/390 | 是 | - |
| city-annex-72-l | annex / terrace-shop | 1302 | 1040 | 212 | 250/250 | 是 | - |
| city-annex-72-r | annex / courtyard-cafe | 736 | 1366 | 185 | 359/359 | 是 | - |
| city-annex-73-l | annex / arcade-store | 1529 | 1185 | 227 | 390/390 | 是 | - |
| city-annex-73-r | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-74-l | annex / corner-tower-shop | 140 | 1306 | 200 | 390/390 | 是 | - |
| city-annex-74-r | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-75-l | annex / courtyard-cafe | 736 | 1378 | 184 | 359/359 | 是 | - |
| city-annex-75-r | annex / corner-tower-shop | 140 | 1413 | 199 | 390/390 | 是 | - |
| city-annex-76-l | annex / terrace-shop | 806 | 975 | 212 | 250/250 | 是 | - |
| city-annex-76-r | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-77-l | annex / arcade-store | 1600 | 1279 | 227 | 390/390 | 是 | - |
| city-annex-77-r | annex / terrace-shop | 1110 | 977 | 212 | 250/250 | 是 | - |
| city-annex-78-l | annex / corner-tower-shop | 140 | 1401 | 200 | 390/390 | 是 | - |
| city-annex-78-r | annex / arcade-store | 1777 | 1214 | 227 | 390/390 | 是 | - |
| city-annex-79-l | annex / courtyard-cafe | 445 | 1242 | 185 | 359/359 | 是 | - |
| city-annex-79-r | annex / corner-tower-shop | 140 | 1305 | 200 | 390/390 | 是 | - |
| city-annex-80-l | annex / terrace-shop | 884 | 941 | 210 | 250/250 | 是 | - |
| city-annex-80-r | annex / courtyard-cafe | 445 | 1304 | 185 | 359/359 | 是 | - |
| city-ground-001 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-002 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-003 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-005 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-006 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-007 | shop / glass-roof-kiosk | 964 | 276 | 197 | 210/210 | 是 | - |
| city-ground-009 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-010 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-011 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-013 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-014 | shop / gable-terrace-shop | 714 | 324 | 188 | 210/210 | 是 | - |
| city-ground-015 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-017 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-018 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-019 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-021 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-022 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-023 | shop / glass-roof-kiosk | 964 | 276 | 197 | 210/210 | 是 | - |
| city-ground-025 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-026 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-027 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-029 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-030 | shop / gable-terrace-shop | 714 | 324 | 188 | 210/210 | 是 | - |
| city-ground-031 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-033 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-034 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-035 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-037 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-038 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-039 | shop / glass-roof-kiosk | 964 | 276 | 197 | 210/210 | 是 | - |
| city-ground-041 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-042 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-043 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-045 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-046 | shop / gable-terrace-shop | 714 | 324 | 188 | 210/210 | 是 | - |
| city-ground-047 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-049 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-050 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-051 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-053 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-054 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-055 | shop / glass-roof-kiosk | 964 | 276 | 197 | 210/210 | 是 | - |
| city-ground-057 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-058 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-059 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-061 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-062 | shop / gable-terrace-shop | 714 | 324 | 188 | 210/210 | 是 | - |
| city-ground-063 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-065 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-066 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-067 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-069 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-070 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-071 | shop / glass-roof-kiosk | 964 | 276 | 197 | 210/210 | 是 | - |
| city-ground-073 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-074 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-075 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-077 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-078 | shop / gable-terrace-shop | 714 | 324 | 188 | 210/210 | 是 | - |
| city-ground-079 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-081 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-082 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-083 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-085 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-086 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-087 | shop / glass-roof-kiosk | 964 | 276 | 197 | 210/210 | 是 | - |
| city-ground-089 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-090 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-091 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-093 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-094 | shop / gable-terrace-shop | 714 | 324 | 188 | 210/210 | 是 | - |
| city-ground-095 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |
| city-ground-097 | shop / patio-shop | 726 | 501 | 225 | 198/198 | 是 | - |
| city-ground-098 | shop / gable-terrace-shop | 714 | 540 | 215 | 210/210 | 是 | - |
| city-ground-099 | shop / glass-roof-kiosk | 1052 | 457 | 215 | 210/210 | 是 | - |

逐栋原始统计见 `architecture-upgrade-block-audit.json`；主楼双角真图见 `architecture-12-real-save/`，全量 80 栋联系图另行归档。
