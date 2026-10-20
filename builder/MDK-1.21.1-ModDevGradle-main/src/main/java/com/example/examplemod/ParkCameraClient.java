package com.example.examplemod;

import com.google.gson.Gson;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.level.GameType;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.RenderFrameEvent;

import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;

@EventBusSubscriber(modid = ParkBuilder.MODID, value = Dist.CLIENT)
public final class ParkCameraClient {
    private static final Gson GSON = new Gson();
    private static final String CONTROL = System.getProperty("parkcamera.control", "");
    private static final Path OUTPUT = Path.of(System.getProperty("parkcamera.output", "capture"));
    private static Request request;
    private static ArmorStand camera;
    private static String lastId = "";
    private static String state = "waiting_world";
    private static long warmUntil, startedAt, nextFrame, lastStatus;
    private static int ticks, frames, width, height;
    private static double recordedWallSeconds;
    private static Process encoder;
    private static ArrayBlockingQueue<byte[]> queue;
    private static volatile String writerError;
    private static double[] eye = {0, 100, 650};

    @SubscribeEvent
    public static void tick(ClientTickEvent.Post event) {
        if (CONTROL.isBlank()) return;
        Minecraft mc = Minecraft.getInstance();
        if (++ticks % 10 == 0) {
            try {
                Path control = Path.of(CONTROL);
                if (Files.exists(control)) {
                    Request incoming = GSON.fromJson(Files.readString(control), Request.class);
                    if (incoming != null && incoming.id != null && !incoming.id.equals(lastId)
                            && mc.level != null && mc.player != null) {
                        lastId = incoming.id;
                        if ("quit".equals(incoming.action)) { finish(); mc.stop(); return; }
                        if ("probe".equals(incoming.action)) { request = incoming; status("probe", null); return; }
                        begin(mc, incoming);
                    }
                }
                if (request != null && ("warming".equals(state) || "recording".equals(state))) followPlayer(mc);
                if (System.nanoTime() - lastStatus > 1_000_000_000L) status(state, writerError);
            } catch (Exception e) { status("error", e.toString()); }
        }
    }

    private static void begin(Minecraft mc, Request incoming) throws Exception {
        finish();
        request = incoming;
        if (request.from == null || request.to == null || request.lookFrom == null) throw new IllegalArgumentException("Camera endpoints required");
        request.fps = request.fps > 0 ? request.fps : 24;
        request.seconds = request.seconds > 0 ? request.seconds : 12;
        frames = 0;
        recordedWallSeconds = 0;
        writerError = null;
        if (request.shaders != null) {
            Class<?> iris = Class.forName("net.irisshaders.iris.Iris");
            Object config = iris.getMethod("getIrisConfig").invoke(null);
            boolean enabled = (boolean) config.getClass().getMethod("areShadersEnabled").invoke(config);
            if (enabled != request.shaders) {
                config.getClass().getMethod("setShadersEnabled", boolean.class).invoke(config, request.shaders);
                config.getClass().getMethod("save").invoke(config);
                iris.getMethod("reload").invoke(null);
            }
        }
        mc.options.hideGui = true;
        mc.options.pauseOnLostFocus = false;
        mc.options.setCameraType(CameraType.FIRST_PERSON);
        mc.getWindow().setTitle("Jurassic Park Capture");
        camera = new ArmorStand(mc.level, request.from[0], request.from[1], request.from[2]);
        camera.setInvisible(true);
        camera.setNoGravity(true);
        mc.setCameraEntity(camera);
        if (mc.getSingleplayerServer() != null) {
            var server = mc.getSingleplayerServer();
            server.execute(() -> {
                server.getCommands().performPrefixedCommand(server.createCommandSourceStack(), "time set 6000");
                server.getCommands().performPrefixedCommand(server.createCommandSourceStack(), "weather clear");
            });
        }
        place(0);
        followPlayer(mc);
        warmUntil = System.nanoTime() + (long) ((request.warmup > 0 ? request.warmup : 15) * 1e9);
        status("warming", null);
    }

    private static void followPlayer(Minecraft mc) {
        if (mc.getSingleplayerServer() == null || mc.player == null) return;
        var server = mc.getSingleplayerServer();
        var id = mc.player.getUUID();
        double[] position = eye.clone();
        server.execute(() -> {
            var player = server.getPlayerList().getPlayer(id);
            if (player != null) {
                player.stopRiding();
                player.setGameMode(GameType.SPECTATOR);
                player.teleportTo(position[0], position[1], position[2]);
            }
        });
    }

    @SubscribeEvent
    public static void beforeFrame(RenderFrameEvent.Pre event) {
        if (CONTROL.isBlank() || camera == null || request == null) return;
        if ("warming".equals(state) || "recording".equals(state)) {
            if (Minecraft.getInstance().getCameraEntity() != camera) Minecraft.getInstance().setCameraEntity(camera);
            double t = Math.min(1, frames / Math.max(1.0, request.seconds * request.fps - 1));
            place(t);
        }
    }

    private static void place(double t) {
        double u = request.linear ? t : t * t * (3 - 2 * t);
        double[] lookTo = request.lookTo == null ? request.lookFrom : request.lookTo;
        double[] target = new double[3];
        for (int i = 0; i < 3; i++) {
            eye[i] = request.from[i] + (request.to[i] - request.from[i]) * u;
            target[i] = request.lookFrom[i] + (lookTo[i] - request.lookFrom[i]) * u;
        }
        double dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2];
        float yaw = (float) Math.toDegrees(Math.atan2(-dx, dz));
        float pitch = (float) -Math.toDegrees(Math.atan2(dy, Math.hypot(dx, dz)));
        double y = eye[1] - camera.getEyeHeight();
        camera.setPos(eye[0], y, eye[2]);
        camera.xo = eye[0]; camera.yo = y; camera.zo = eye[2];
        camera.setYRot(yaw); camera.yRotO = yaw;
        camera.yHeadRot = yaw; camera.yHeadRotO = yaw;
        camera.yBodyRot = yaw; camera.yBodyRotO = yaw;
        camera.setXRot(pitch); camera.xRotO = pitch;
    }

    @SubscribeEvent
    public static void afterFrame(RenderFrameEvent.Post event) {
        if (CONTROL.isBlank() || request == null || camera == null) return;
        Minecraft mc = Minecraft.getInstance();
        try {
            if ("warming".equals(state) && System.nanoTime() >= warmUntil) startEncoder(mc);
            if (!"recording".equals(state) || System.nanoTime() < nextFrame || queue.remainingCapacity() == 0) return;
            if (writerError != null) throw new IllegalStateException(writerError);
            try (NativeImage image = Screenshot.takeScreenshot(mc.getMainRenderTarget())) {
                if (image.getWidth() != width || image.getHeight() != height) throw new IllegalStateException("Window resized during capture");
                byte[] rgba = new byte[width * height * 4];
                ByteBuffer.wrap(rgba).order(ByteOrder.LITTLE_ENDIAN).asIntBuffer().put(image.getPixelsRGBA());
                queue.add(rgba);
                if (frames == 0 || frames == (int) (request.seconds * request.fps / 2)) image.writeToFile(OUTPUT.resolve(request.id + "-" + frames + ".png"));
            }
            frames++;
            nextFrame = System.nanoTime() + 1_000_000_000L / request.fps;
            if (frames >= request.seconds * request.fps) finish();
        } catch (Exception e) { writerError = e.toString(); finish(); status("error", writerError); }
    }

    private static void startEncoder(Minecraft mc) throws Exception {
        Files.createDirectories(OUTPUT);
        width = mc.getMainRenderTarget().width;
        height = mc.getMainRenderTarget().height;
        String ffmpeg = System.getProperty("parkcamera.ffmpeg", "ffmpeg");
        encoder = new ProcessBuilder(ffmpeg, "-hide_banner", "-loglevel", "warning", "-y", "-f", "rawvideo", "-pixel_format", "rgba",
            "-video_size", width + "x" + height, "-framerate", String.valueOf(request.fps), "-i", "pipe:0", "-an", "-c:v", "libx264",
            "-preset", "veryfast", "-crf", "18", "-threads", "2", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUTPUT.resolve(request.id + ".mp4").toString())
            .redirectError(OUTPUT.resolve(request.id + "-encoder.log").toFile()).start();
        queue = new ArrayBlockingQueue<>(3);
        var currentQueue = queue;
        var process = encoder;
        Thread writer = new Thread(() -> {
            try (OutputStream stream = process.getOutputStream()) {
                while (true) {
                    byte[] data = currentQueue.take();
                    if (data.length == 0) break;
                    stream.write(data);
                }
            } catch (Exception e) { writerError = e.toString(); }
        }, "ParkCamera-encoder");
        writer.setDaemon(true);
        writer.start();
        startedAt = System.nanoTime();
        nextFrame = startedAt;
        status("recording", null);
    }

    private static void finish() {
        if (queue != null) {
            try { queue.put(new byte[0]); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            queue = null;
        }
        if (encoder != null) {
            recordedWallSeconds = (System.nanoTime() - startedAt) / 1e9;
            try { encoder.waitFor(20, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            encoder = null;
            status(writerError == null ? "done" : "error", writerError);
        }
    }

    private static void status(String newState, String error) {
        state = newState;
        lastStatus = System.nanoTime();
        if (CONTROL.isBlank()) return;
        try {
            Minecraft mc = Minecraft.getInstance();
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("id", lastId); data.put("state", state); data.put("frames", frames);
            data.put("fps", mc.getFps()); data.put("width", width); data.put("height", height);
            data.put("eye", eye); data.put("error", error);
            data.put("cameraAttached", mc.getCameraEntity() == camera);
            if (startedAt > 0) data.put("wallSeconds", "recording".equals(state) ? (System.nanoTime() - startedAt) / 1e9 : recordedWallSeconds);
            List<Object> entities = new ArrayList<>();
            if (mc.level != null && mc.player != null) for (var entity : mc.level.entitiesForRendering()) {
                String type = BuiltInRegistries.ENTITY_TYPE.getKey(entity.getType()).toString();
                if ((type.startsWith("jurassicreborn:") || type.startsWith("easy_npc:") || type.startsWith("mts:")) && entity.distanceToSqr(mc.player) < 160 * 160)
                    entities.add(Map.of("type", type, "x", entity.getX(), "y", entity.getY(), "z", entity.getZ()));
            }
            data.put("nearbyEntities", entities);
            Files.createDirectories(OUTPUT);
            Files.writeString(OUTPUT.resolve("status.json"), GSON.toJson(data));
        } catch (Exception ignored) { }
    }

    private static class Request {
        String id, action;
        double[] from, to, lookFrom, lookTo;
        double seconds, warmup;
        int fps;
        Boolean shaders;
        boolean linear;
    }
}
