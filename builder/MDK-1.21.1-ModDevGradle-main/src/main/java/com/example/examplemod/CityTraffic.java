package com.example.examplemod;

import com.google.gson.Gson;
import com.mojang.logging.LogUtils;
import mcinterface1211.WrapperWorld;
import minecrafttransportsimulator.baseclasses.Point3D;
import minecrafttransportsimulator.entities.components.AEntityA_Base;
import minecrafttransportsimulator.entities.instances.EntityVehicleF_Physics;
import minecrafttransportsimulator.entities.instances.PartEngine;
import minecrafttransportsimulator.entities.instances.PartGroundDevice;
import minecrafttransportsimulator.items.instances.ItemVehicle;
import minecrafttransportsimulator.packloading.PackParser;
import minecrafttransportsimulator.mcinterface.InterfaceManager;
import minecrafttransportsimulator.packets.instances.PacketVehicleServerMovement;
import net.minecraft.commands.Commands;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.storage.LevelResource;
import net.minecraft.world.phys.AABB;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import net.neoforged.neoforge.event.server.ServerStoppedEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import org.slf4j.Logger;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Mod("citytraffic")
public final class CityTraffic {
    private static final Logger LOG = LogUtils.getLogger();
    private static final Gson GSON = new Gson();
    private static final double CRUISE_SPEED = 7;
    private static final int[] MAIN_ROADS = {-980, -780, -600, 600, 780, 980};
    private static final int[] LOCAL_X_ROADS = {-450, -330, -210, -100, 0, 100, 210, 330, 450};
    private static final int[] LOCAL_Z_ROADS = {-420, -240, 0, 240, 420};
    private final Map<String, Route> routes = new HashMap<>();
    private final Map<UUID, Assignment> assignments = new HashMap<>();
    private final Map<UUID, Integer> stalledTicks = new HashMap<>();
    private final Map<UUID, String> obstacleBlocked = new HashMap<>();
    private final Map<UUID, RecoveryStats> recoveryStats = new HashMap<>();
    private List<Car> spawnQueue = List.of();
    private int spawnIndex;
    private int ticks;
    private boolean stateLoaded;

    public CityTraffic() {
        net.neoforged.neoforge.common.NeoForge.EVENT_BUS.register(this);
    }

    @SubscribeEvent
    public void commands(RegisterCommandsEvent event) {
        event.getDispatcher().register(Commands.literal("citytraffic").requires(source -> source.hasPermission(2))
            .then(Commands.literal("start").executes(context -> start(context.getSource(), false)))
            .then(Commands.literal("probe").executes(context -> start(context.getSource(), true)))
            .then(Commands.literal("status").executes(context -> audit(context.getSource(), false)))
            .then(Commands.literal("audit").executes(context -> audit(context.getSource(), true))));
    }

    private int start(CommandSourceStack source, boolean probe) {
        MinecraftServer server = source.getServer();
        try {
            Plan plan = GSON.fromJson(Files.readString(planPath(server)), Plan.class);
            routes.clear();
            for (Route route : plan.routes) routes.put(route.id, route);
            if (probe) {
                Car sedan = null, bus = null;
                for (Car car : plan.cars) {
                    if (sedan == null && !car.model.contains("county") && !car.model.contains("nsac")
                        && !car.model.contains("eleccity")) sedan = car;
                    if (bus == null && (car.model.contains("county") || car.model.contains("nsac"))) bus = car;
                    if (sedan != null && bus != null) break;
                }
                if (sedan == null || bus == null) throw new IllegalStateException("Plan needs sedan and fuel bus");
                spawnQueue = List.of(sedan, bus);
            } else spawnQueue = List.of(plan.cars);
            spawnIndex = 0;
            loadState(server);
            LOG.info("City traffic queued {} IV vehicles on {} routes", spawnQueue.size(), routes.size());
            source.sendSuccess(() -> Component.literal("queued=" + spawnQueue.size() + " routes=" + routes.size()), false);
            return spawnQueue.size();
        } catch (Exception error) {
            LOG.error("Cannot load IV traffic plan", error);
            return 0;
        }
    }

    private int audit(CommandSourceStack source, boolean writeFile) {
        MinecraftServer server = source.getServer();
        ServerLevel level = server.getLevel(Level.OVERWORLD);
        if (level == null) return 0;
        List<AuditCar> cars = new ArrayList<>();
        for (AEntityA_Base entity : WrapperWorld.getWrapperFor(level).allEntities) {
            if (!(entity instanceof EntityVehicleF_Physics vehicle) || !vehicle.isValid) continue;
            Assignment assignment = assignments.get(vehicle.uniqueUUID);
            if (assignment == null) continue;
            int wheels = 0;
            for (var part : vehicle.allParts) if (part instanceof PartGroundDevice) wheels++;
            Route route = routes.get(assignment.route);
            double routeDistance = route == null ? -1
                : nearestSegment(route, vehicle.position.x, vehicle.position.z).distance;
            boolean engineRunning = vehicle.engines.stream().anyMatch(engine -> engine.running);
            RecoveryStats recovery = recoveryStats.getOrDefault(vehicle.uniqueUUID, new RecoveryStats(0, "none"));
            cars.add(new AuditCar(assignment.id, assignment.route, vehicle.definition.systemName,
                vehicle.position.x, vehicle.position.y, vehicle.position.z, vehicle.velocity,
                vehicle.engines.size(), wheels, engineRunning, routeDistance,
                obstacleBlocked.getOrDefault(vehicle.uniqueUUID, "none"),
                stalledTicks.getOrDefault(vehicle.uniqueUUID, 0), recovery.count, recovery.reason));
        }
        long offRoute = cars.stream().filter(car -> car.routeDistance < 0 || car.routeDistance > 8).count();
        long moving = cars.stream().filter(car -> car.velocity > 0.15).count();
        long stalled = cars.stream().filter(car -> car.velocity <= 0.15 && car.blocked.equals("none")).count();
        long vehicleBlocked = cars.stream().filter(car -> car.blocked.equals("vehicle")).count();
        long personBlocked = cars.stream().filter(car -> car.blocked.equals("person")).count();
        long blockBlocked = cars.stream().filter(car -> car.blocked.equals("block")).count();
        long recoveries = cars.stream().mapToInt(car -> car.recoveryCount).sum();
        String summary = "tracked=" + assignments.size() + " loaded=" + cars.size()
            + " moving=" + moving + " stalled=" + stalled + " vehicleBlocked=" + vehicleBlocked
            + " personBlocked=" + personBlocked + " blockBlocked=" + blockBlocked
            + " offRoute=" + offRoute + " recoveries=" + recoveries
            + " spawnRemaining=" + (spawnQueue.size() - spawnIndex)
            + (cars.isEmpty() ? "" : " sample=" + cars.get(0).id + "@"
                + Math.round(cars.get(0).x) + "," + Math.round(cars.get(0).z));
        LOG.info("IV traffic {}", summary);
        source.sendSuccess(() -> Component.literal(summary), false);
        if (writeFile) {
            try {
                Files.writeString(server.getFile("citytraffic-audit.json").normalize(),
                    GSON.toJson(new AuditReport(server.getTickCount(), summary, cars)));
            } catch (Exception error) { LOG.error("Cannot write IV traffic audit", error); return 0; }
        }
        return cars.size();
    }

    @SubscribeEvent
    public void tick(ServerTickEvent.Post event) {
        MinecraftServer server = event.getServer();
        ServerLevel level = server.getLevel(Level.OVERWORLD);
        if (level == null) return;
        if (!stateLoaded) loadState(server);
        if (!spawnQueue.isEmpty() && spawnIndex < spawnQueue.size()) {
            Car car = spawnQueue.get(spawnIndex++);
            try { spawn(level, car); }
            catch (Exception error) { LOG.error("IV traffic spawn failed: {}", car.id, error); }
            if (spawnIndex == spawnQueue.size()) saveState(server);
        }
        if (++ticks % 2 != 0 || assignments.isEmpty()) return;

        WrapperWorld world = WrapperWorld.getWrapperFor(level);
        Map<UUID, EntityVehicleF_Physics> loaded = new HashMap<>();
        for (AEntityA_Base entity : world.allEntities) {
            if (entity instanceof EntityVehicleF_Physics vehicle && vehicle.isValid) {
                loaded.put(vehicle.uniqueUUID, vehicle);
            }
        }
        for (Map.Entry<UUID, Assignment> entry : assignments.entrySet()) {
            EntityVehicleF_Physics vehicle = loaded.get(entry.getKey());
            Route route = routes.get(entry.getValue().route);
            if (vehicle != null && route == null) {
                route = nearestRoute(vehicle.position.x, vehicle.position.z);
                if (route != null) {
                    assignments.put(entry.getKey(), new Assignment(entry.getValue().id, route.id));
                    recover(level, vehicle, route, loaded.values(), "route_missing");
                    saveState(server);
                }
            }
            if (vehicle != null && route != null && route.points.length > 2) {
                if (ticks % 20 == 0) service(vehicle);
                drive(level, vehicle, route, loaded.values());
            }
        }
    }

    private void spawn(ServerLevel level, Car car) {
        Route route = routes.get(car.route);
        if (route == null) throw new IllegalArgumentException("Unknown route: " + car.route);
        for (Assignment current : assignments.values()) if (current.id.equals(car.id)) return;
        level.getChunkAt(net.minecraft.core.BlockPos.containing(car.x, car.y, car.z));
        ItemVehicle item = PackParser.getItem("blue_seoul_vehicles", car.model);
        if (item == null && car.model.equals("hyundai_nsac")) {
            item = PackParser.getItem("blue_seoul_vehicles", car.model, "_blue");
        }
        if (item == null) throw new IllegalArgumentException("Missing Blue Seoul model: " + car.model);
        WrapperWorld world = WrapperWorld.getWrapperFor(level);
        EntityVehicleF_Physics vehicle = new EntityVehicleF_Physics(world, null, item, null);
        vehicle.position.set(car.x, car.y, car.z);
        vehicle.prevPosition.set(vehicle.position);
        vehicle.orientation.setToAngles(new Point3D(0, car.yaw, 0));
        vehicle.prevOrientation.set(vehicle.orientation);
        world.spawnEntity(vehicle);
        vehicle.addPartsPostAddition(null, null);
        if (vehicle.fuelTank.getFluidLevel() == 0 && !vehicle.engines.isEmpty()) {
            String fuel = fuelFor(vehicle.engines.get(0));
            vehicle.fuelTank.manuallySet(fuel, "", Math.max(1000, vehicle.definition.motorized.fuelCapacity * 0.75));
        }
        for (PartEngine engine : vehicle.engines) {
            engine.currentGearVar.setTo(1, true);
            engine.autoStartEngine();
        }
        vehicle.parkingBrakeVar.setTo(0, true);
        vehicle.throttleVar.setTo(0.3, true);
        vehicle.autopilotValueVar.setTo(CRUISE_SPEED, true);
        assignments.put(vehicle.uniqueUUID, new Assignment(car.id, car.route));
    }

    private void service(EntityVehicleF_Physics vehicle) {
        if (vehicle.engines.isEmpty()) return;
        if (vehicle.fuelTank.getFluidLevel() < vehicle.fuelTank.getMaxLevel() * 0.25) {
            String fuel = vehicle.fuelTank.getFluid();
            if (fuel.isEmpty()) fuel = fuelFor(vehicle.engines.get(0));
            vehicle.fuelTank.manuallySet(fuel, "", vehicle.fuelTank.getMaxLevel() * 0.75);
        }
        vehicle.electricPower = Math.max(vehicle.electricPower, 4);
        for (PartEngine engine : vehicle.engines) {
            if (engine.currentGearVar.currentValue < 1) engine.currentGearVar.setTo(1, true);
            if (!engine.running) engine.autoStartEngine();
        }
        vehicle.parkingBrakeVar.setTo(0, true);
    }

    private static String fuelFor(PartEngine engine) {
        return engine.definition.engine.type == minecrafttransportsimulator.jsondefs.JSONPart.EngineType.ELECTRIC
            ? PartEngine.ELECTRICITY_FUEL : engine.definition.engine.fuelType;
    }

    private void drive(ServerLevel level, EntityVehicleF_Physics vehicle, Route route,
                       java.util.Collection<EntityVehicleF_Physics> vehicles) {
        double x = vehicle.position.x;
        double z = vehicle.position.z;
        Match match = nearestSegment(route, x, z);
        int stopped = vehicle.velocity < 0.15
            ? stalledTicks.merge(vehicle.uniqueUUID, 2, Integer::sum)
            : 0;
        if (stopped == 0) stalledTicks.remove(vehicle.uniqueUUID);
        if (match.distance > 8 || vehicle.position.y > 66 || stopped > 300
            || Math.abs(x) > 995 || Math.abs(z) > 995 || inStation(x, z)) {
            String reason = match.distance > 8 ? "off_route" : vehicle.position.y > 66 ? "height"
                : stopped > 300 ? "stalled" : Math.abs(x) > 995 || Math.abs(z) > 995 ? "boundary" : "station";
            if (recover(level, vehicle, route, vehicles, reason)) stalledTicks.remove(vehicle.uniqueUUID);
            return;
        }
        int target = (match.segment + 1) % route.points.length;
        Point point = route.points[target];
        for (int lookahead = 0; lookahead < 3
            && squared(point.x - x, point.z - z) < 100; lookahead++) {
            target = (target + 1) % route.points.length;
            point = route.points[target];
        }
        double desiredYaw = Math.toDegrees(Math.atan2(point.x - x, point.z - z));
        double error = wrap(desiredYaw - vehicle.orientation.angles.y);
        vehicle.rudderInputVar.setTo(Math.max(-30, Math.min(30, -error * 1.3)), true);

        double yaw = Math.toRadians(vehicle.orientation.angles.y);
        double forwardX = Math.sin(yaw), forwardZ = Math.cos(yaw);
        String blockedBy = "none";
        for (EntityVehicleF_Physics other : vehicles) {
            if (other == vehicle) continue;
            double dx = other.position.x - x, dz = other.position.z - z;
            double ahead = dx * forwardX + dz * forwardZ;
            double side = Math.abs(dx * forwardZ - dz * forwardX);
            if (ahead > 0 && ahead < 12 && side < 3.5) { blockedBy = "vehicle"; break; }
        }
        if (blockedBy.equals("none")) {
            AABB area = new AABB(x - 12, vehicle.position.y - 2, z - 12,
                x + 12, vehicle.position.y + 4, z + 12);
            for (LivingEntity person : level.getEntitiesOfClass(LivingEntity.class, area)) {
                double dx = person.getX() - x, dz = person.getZ() - z;
                if (dx * forwardX + dz * forwardZ > 0 && dx * forwardX + dz * forwardZ < 9
                    && Math.abs(dx * forwardZ - dz * forwardX) < 2.5) {
                    blockedBy = "person";
                    if (stopped > 40 && ticks % 20 == 0 && person instanceof Mob mob
                        && mob.getTags().contains("city_life_pedestrian")) {
                        guidePedestrian(level, mob, x, z, forwardX, forwardZ);
                    }
                    break;
                }
            }
        }
        if (blockedBy.equals("none") && stopped > 40 && blockedByBlock(level, x, z, forwardX, forwardZ)) {
            blockedBy = "block";
        }
        double turnSpeed = Math.abs(error) > 40 ? 2.5 : Math.abs(error) > 20 ? 4 : CRUISE_SPEED;
        boolean blocked = !blockedBy.equals("none");
        obstacleBlocked.put(vehicle.uniqueUUID, blockedBy);
        vehicle.autopilotValueVar.setTo(blocked ? 0 : turnSpeed, true);
        vehicle.brakeVar.setTo(blocked ? 1 : vehicle.indicatedSpeed > turnSpeed * 1.25 ? 0.4 : 0, true);
    }

    private Route nearestRoute(double x, double z) {
        Route best = null;
        double distance = Double.MAX_VALUE;
        for (Route route : routes.values()) {
            Match match = nearestSegment(route, x, z);
            if (match.distance < distance) { distance = match.distance; best = route; }
        }
        return best;
    }

    private static Match nearestSegment(Route route, double x, double z) {
        int best = 0;
        double shortest = Double.MAX_VALUE;
        for (int i = 0; i < route.points.length; i++) {
            Point a = route.points[i], b = route.points[(i + 1) % route.points.length];
            double dx = b.x - a.x, dz = b.z - a.z;
            double length = dx * dx + dz * dz;
            if (length < 0.01) continue;
            double t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length));
            double distance = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
            if (distance < shortest) { shortest = distance; best = i; }
        }
        return new Match(best, shortest);
    }

    private boolean recover(ServerLevel level, EntityVehicleF_Physics vehicle, Route route,
                            java.util.Collection<EntityVehicleF_Physics> vehicles, String reason) {
        Match match = nearestSegment(route, vehicle.position.x, vehicle.position.z);
        for (int step = 1; step < route.points.length; step++) {
            int index = (match.segment + step) % route.points.length;
            Point point = route.points[index];
            if (inStation(point.x, point.z) || Math.abs(point.x) > 990 || Math.abs(point.z) > 990
                || (Math.abs(point.x) <= 594 && Math.abs(point.z) <= 594)) continue;
            if (!clearRecoveryPoint(level, point)) continue;
            boolean occupied = false;
            for (EntityVehicleF_Physics other : vehicles) {
                if (other != vehicle && squared(other.position.x - point.x, other.position.z - point.z) < 144) {
                    occupied = true; break;
                }
            }
            if (occupied) continue;
            Point next = route.points[(index + 1) % route.points.length];
            Point3D translation = new Point3D(point.x - vehicle.position.x,
                64.5 - vehicle.position.y, point.z - vehicle.position.z);
            double yaw = Math.toDegrees(Math.atan2(next.x - point.x, next.z - point.z));
            Point3D rotation = new Point3D(0, wrap(yaw - vehicle.orientation.angles.y), 0);
            vehicle.position.set(point.x, 64.5, point.z);
            vehicle.prevPosition.set(vehicle.position);
            vehicle.motion.set(0, 0, 0);
            vehicle.prevMotion.set(vehicle.motion);
            vehicle.orientation.setToAngles(new Point3D(0, yaw, 0));
            vehicle.prevOrientation.set(vehicle.orientation);
            vehicle.addToServerDeltas(translation, rotation, 0);
            InterfaceManager.packetInterface.sendToAllClients(
                new PacketVehicleServerMovement(vehicle, translation, rotation, 0));
            vehicle.brakeVar.setTo(0, true);
            vehicle.autopilotValueVar.setTo(2.5, true);
            recoveryStats.merge(vehicle.uniqueUUID, new RecoveryStats(1, reason),
                (previous, current) -> new RecoveryStats(previous.count + 1, current.reason));
            return true;
        }
        vehicle.brakeVar.setTo(1, true);
        vehicle.autopilotValueVar.setTo(0, true);
        return false;
    }

    private static boolean clearRecoveryPoint(ServerLevel level, Point point) {
        BlockPos center = BlockPos.containing(point.x, 64, point.z);
        if (!level.hasChunkAt(center) || level.getBlockState(center.below()).isAir()) return false;
        for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++) {
            for (int y = 64; y <= 67; y++) {
                BlockPos pos = center.offset(dx, y - 64, dz);
                if (!level.getBlockState(pos).getCollisionShape(level, pos).isEmpty()) return false;
            }
        }
        AABB area = new AABB(point.x - 3, 64, point.z - 3, point.x + 3, 68, point.z + 3);
        return level.getEntitiesOfClass(LivingEntity.class, area).isEmpty();
    }

    private static boolean blockedByBlock(ServerLevel level, double x, double z,
                                          double forwardX, double forwardZ) {
        for (int distance = 3; distance <= 7; distance += 2) {
            for (int side = -2; side <= 2; side += 2) {
                BlockPos base = BlockPos.containing(x + forwardX * distance + forwardZ * side,
                    64, z + forwardZ * distance - forwardX * side);
                for (int y = 0; y <= 3; y++) {
                    BlockPos pos = base.above(y);
                    if (!level.getBlockState(pos).getCollisionShape(level, pos).isEmpty()) return true;
                }
            }
        }
        return false;
    }

    private static void guidePedestrian(ServerLevel level, Mob pedestrian, double carX, double carZ,
                                        double forwardX, double forwardZ) {
        CompoundTag home = pedestrian.saveWithoutId(new CompoundTag()).getCompound("Navigation")
            .getCompound("Home");
        if (!home.contains("X") || !home.contains("Z")) return;
        double homeX = home.getDouble("X"), homeZ = home.getDouble("Z");
        boolean roadAlongX = Math.abs(forwardX) > Math.abs(forwardZ);
        double carCross = roadAlongX ? carZ : carX;
        int center = roadAlongX && Math.abs(carCross - 650) <= 11 ? 650
            : closestRoad(carCross, roadAlongX ? LOCAL_Z_ROADS : LOCAL_X_ROADS);
        if (Math.abs(carCross - center) > 11) return;
        double personCross = roadAlongX ? pedestrian.getZ() : pedestrian.getX();
        double side = Math.signum(personCross - center);
        if (side == 0) side = Math.signum(carCross - center);
        if (side == 0) return;
        int sidewalkOffset = roadAlongX && center == 650 ? 17 : isMainRoad(center) ? 9 : 7;
        double targetX = roadAlongX ? pedestrian.getX() : center + side * sidewalkOffset;
        double targetZ = roadAlongX ? center + side * sidewalkOffset : pedestrian.getZ();
        if (squared(targetX - homeX, targetZ - homeZ) > 900
            || squared(targetX - pedestrian.getX(), targetZ - pedestrian.getZ()) < 4
            || onCrossingLane(roadAlongX ? targetX : targetZ, roadAlongX)
            || !walkableSidewalk(level, targetX, targetZ)) return;
        pedestrian.getNavigation().moveTo(targetX, 64, targetZ, 0.8);
    }

    private static int closestRoad(double coordinate, int[] localRoads) {
        int nearest = MAIN_ROADS[0];
        double distance = Double.MAX_VALUE;
        for (int road : MAIN_ROADS) {
            double candidate = Math.abs(coordinate - road);
            if (candidate < distance) { nearest = road; distance = candidate; }
        }
        for (int road : localRoads) {
            double candidate = Math.abs(coordinate - road);
            if (candidate < distance) { nearest = road; distance = candidate; }
        }
        return nearest;
    }

    private static boolean isMainRoad(int center) {
        for (int road : MAIN_ROADS) if (road == center) return true;
        return false;
    }

    private static boolean onCrossingLane(double coordinate, boolean roadAlongX) {
        for (int road : MAIN_ROADS) if (Math.abs(coordinate - road) <= 6) return true;
        int[] localRoads = roadAlongX ? LOCAL_X_ROADS : LOCAL_Z_ROADS;
        for (int road : localRoads) if (Math.abs(coordinate - road) <= 5) return true;
        return !roadAlongX && Math.abs(coordinate - 650) <= 12;
    }

    private static boolean walkableSidewalk(ServerLevel level, double x, double z) {
        BlockPos feet = BlockPos.containing(x, 64, z);
        BlockPos ground = feet.below();
        return level.hasChunkAt(feet)
            && level.getBlockState(ground).isFaceSturdy(level, ground, Direction.UP)
            && level.getBlockState(feet).getCollisionShape(level, feet).isEmpty()
            && level.getBlockState(feet.above()).getCollisionShape(level, feet.above()).isEmpty();
    }

    private static boolean inStation(double x, double z) {
        return Math.abs(x) < 70 && z > 600 && z < 780;
    }

    private void loadState(MinecraftServer server) {
        stateLoaded = true;
        try {
            // Ordinary single-player worlds should not load this park's traffic.
            if (!Files.exists(planPath(server))) return;
            if (Files.exists(statePath(server))) {
                State state = GSON.fromJson(Files.readString(statePath(server)), State.class);
                for (SavedAssignment saved : state.assignments) {
                    assignments.put(UUID.fromString(saved.uuid), new Assignment(saved.id, saved.route));
                }
            }
            Plan plan = GSON.fromJson(Files.readString(planPath(server)), Plan.class);
            for (Route route : plan.routes) routes.put(route.id, route);
            LOG.info("Loaded {} traffic routes and {} assignments from {}", routes.size(),
                assignments.size(), planPath(server));
        } catch (Exception error) { LOG.warn("No saved IV traffic state yet: {}", error.toString()); }
    }

    private void saveState(MinecraftServer server) {
        try {
            List<SavedAssignment> saved = new ArrayList<>();
            assignments.forEach((uuid, assignment) ->
                saved.add(new SavedAssignment(uuid.toString(), assignment.id, assignment.route)));
            Files.writeString(statePath(server), GSON.toJson(new State(saved)));
        } catch (Exception error) { LOG.error("Cannot save IV traffic state", error); }
    }

    private static Path planPath(MinecraftServer server) {
        Path portable = server.getWorldPath(LevelResource.ROOT).resolve("citytraffic-plan.json");
        if (Files.exists(portable) || !server.isDedicatedServer()) return portable;
        return server.getFile("../../map/generated/iv-traffic.json").normalize();
    }
    private static Path statePath(MinecraftServer server) {
        return server.getWorldPath(LevelResource.ROOT).resolve("citytraffic-state.json");
    }

    @SubscribeEvent
    public void stopping(ServerStoppingEvent event) {
        if (!assignments.isEmpty()) saveState(event.getServer());
    }

    @SubscribeEvent
    public void stopped(ServerStoppedEvent event) {
        routes.clear();
        assignments.clear();
        stalledTicks.clear();
        obstacleBlocked.clear();
        recoveryStats.clear();
        spawnQueue = List.of();
        spawnIndex = 0;
        ticks = 0;
        stateLoaded = false;
    }
    private static double squared(double x, double z) { return x * x + z * z; }
    private static double wrap(double degrees) {
        return (degrees + 540) % 360 - 180;
    }
    private record Point(double x, double z) {}
    private record Route(String id, Point[] points) {}
    private record Car(String id, String route, String model, double x, double y, double z, double yaw) {}
    private record Assignment(String id, String route) {}
    private record RecoveryStats(int count, String reason) {}
    private record SavedAssignment(String uuid, String id, String route) {}
    private record State(List<SavedAssignment> assignments) {}
    private record Plan(Route[] routes, Car[] cars) {}
    private record Match(int segment, double distance) {}
    private record AuditCar(String id, String route, String model, double x, double y, double z,
                            double velocity, int engines, int wheels, boolean engineRunning,
                            double routeDistance, String blocked, int stalledTicks,
                            int recoveryCount, String lastRecoveryReason) {}
    private record AuditReport(int tick, String summary, List<AuditCar> cars) {}
}
