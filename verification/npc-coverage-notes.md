# NPC coverage and roaming audit

The 30-block grid covers the planned city bounds of X/Z -995..995, excluding eight dinosaur enclosures. The original planner reported 29 cells where it could not add an outdoor NPC. Its report was created before indoor NPC placement and lists only the first 25 of those cells. Recomputing grid occupancy from all 4,372 final NPC home positions leaves 18 unoccupied cells. Twelve of their centers are within 30 horizontal blocks of another NPC home.

The remaining six centers are unsuitable for an outdoor NPC:

| Center X,Z | Nearest NPC home | Surface / location |
| --- | ---: | --- |
| -20,100 | 30.2 | Water |
| -20,130 | 30.0 | Water |
| 10,280 | 30.5 | Inside the control building; concrete occupies the standing position |
| 10,430 | 35.5 | Inside the visitor centre; floor is at a different height |
| 10,460 | 36.5 | Inside the visitor centre; floor is at a different height |
| 700,-140 | 30.5 | Inside city-25 building |

The EasyNPC 7.15.0 `RandomStrollAroundHomeGoal` bytecode uses `LandRandomPos.getPos` and `getPosTowards` with a horizontal step of 10 blocks relative to the NPC's **current position**. This is a single path target distance, not a fixed 10-block limit around Home. Consecutive strolls can move farther. The NPC's `MOVE_BACK_TO_HOME` threshold is 30 blocks, and the installed `city-life-safety` datapack teleports any city NPC beyond 30 blocks from Home or inside a dinosaur enclosure back to Home every 40 ticks.

Evidence: `map/generated/city-pedestrians-radius-30.json`, `verification/npc-dino-fourfold.json`, the closed-world backup `backups/before-city-life-upgrade-closed-20261018-090218`, and `runtime/server/mods/easy_npc-neoforge-1.21.1-7.15.0.jar` (`RandomStrollAroundHomeGoal.class`).
