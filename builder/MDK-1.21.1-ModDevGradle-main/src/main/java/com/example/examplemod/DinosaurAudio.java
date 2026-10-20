package com.example.examplemod;

import com.google.gson.JsonParser;
import com.mojang.logging.LogUtils;
import net.minecraft.core.Holder;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.sounds.SoundEvent;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.PlayLevelSoundEvent;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public final class DinosaurAudio {
    private final Map<ResourceLocation, Holder<SoundEvent>> sounds = new HashMap<>();

    public DinosaurAudio() {
        try (var reader = new InputStreamReader(Objects.requireNonNull(
                DinosaurAudio.class.getResourceAsStream("/dinosaur-audio.json")), StandardCharsets.UTF_8)) {
            var config = JsonParser.parseReader(reader).getAsJsonObject();
            float radius = config.get("radius").getAsFloat();
            if (!Float.isFinite(radius) || radius <= 0) throw new IllegalArgumentException("Invalid sound radius");
            for (var entry : config.getAsJsonArray("events")) {
                var id = ResourceLocation.parse(entry.getAsString());
                sounds.put(id, Holder.direct(SoundEvent.createFixedRangeEvent(id, radius)));
            }
            LogUtils.getLogger().info("Dinosaur audio: {} events, radius {} blocks", sounds.size(), radius);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to load dinosaur audio ranges", e);
        }
    }

    @SubscribeEvent
    public void play(PlayLevelSoundEvent event) {
        var original = event.getSound();
        if (original == null) return;
        var replacement = sounds.get(original.value().getLocation());
        // Extend packet delivery as well as client attenuation, without changing volume or pitch.
        if (replacement != null) event.setSound(replacement);
    }
}
