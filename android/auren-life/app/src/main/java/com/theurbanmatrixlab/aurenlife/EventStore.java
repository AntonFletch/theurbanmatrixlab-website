package com.theurbanmatrixlab.aurenlife;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public final class EventStore {
    private static final Object LOCK = new Object();
    private static final String PREFS = "auren_life_state";

    private EventStore() {}

    public static File lifeRoot(Context context) {
        File dir = new File(context.getFilesDir(), "life");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public static File todayDir(Context context) {
        String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        File dir = new File(lifeRoot(context), day);
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private static File eventsFile(Context context) {
        return new File(lifeRoot(context), "events.jsonl");
    }

    public static void log(Context context, String type, String detail, String filePath) {
        synchronized (LOCK) {
            long now = System.currentTimeMillis();
            try {
                JSONObject event = new JSONObject();
                event.put("ts", now);
                event.put("iso", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date(now)));
                event.put("type", type);
                event.put("detail", detail == null ? "" : detail);
                if (filePath != null) event.put("file", filePath);

                try (FileWriter writer = new FileWriter(eventsFile(context), true)) {
                    writer.write(event.toString());
                    writer.write("\n");
                }

                SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                int todayCount = prefs.getInt(todayCounterKey(), 0);
                if ("audio_segment".equals(type) || "marked_moment".equals(type)) {
                    todayCount++;
                    prefs.edit().putInt(todayCounterKey(), todayCount).apply();
                }
                prefs.edit()
                        .putString("last_event", type + ": " + (detail == null ? "" : detail))
                        .putLong("last_event_at", now)
                        .apply();
            } catch (Exception ignored) {}
        }
    }

    public static List<String> recent(Context context, int limit) {
        synchronized (LOCK) {
            File file = eventsFile(context);
            if (!file.exists()) return Collections.emptyList();
            ArrayList<String> lines = new ArrayList<>();
            try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.trim().isEmpty()) lines.add(line);
                }
            } catch (IOException ignored) {}

            int start = Math.max(0, lines.size() - limit);
            ArrayList<String> out = new ArrayList<>();
            for (int i = lines.size() - 1; i >= start; i--) {
                try {
                    JSONObject e = new JSONObject(lines.get(i));
                    long ts = e.optLong("ts");
                    String time = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date(ts));
                    String type = e.optString("type", "event").replace('_', ' ');
                    String detail = e.optString("detail", "");
                    out.add(time + "  " + type.toUpperCase(Locale.US) + (detail.isEmpty() ? "" : "\n" + detail));
                } catch (Exception ignored) {}
            }
            return out;
        }
    }

    public static int todayCaptureCount(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(todayCounterKey(), 0);
    }

    public static int deleteAudioSince(Context context, long cutoffMs) {
        synchronized (LOCK) {
            int deleted = deleteRecursivelyNewerThan(lifeRoot(context), cutoffMs);
            log(context, "privacy_delete", "Deleted " + deleted + " recent audio file(s).", null);
            return deleted;
        }
    }

    private static int deleteRecursivelyNewerThan(File f, long cutoffMs) {
        if (f == null || !f.exists()) return 0;
        if (f.isDirectory()) {
            int count = 0;
            File[] files = f.listFiles();
            if (files != null) {
                for (File child : files) count += deleteRecursivelyNewerThan(child, cutoffMs);
            }
            return count;
        }
        if (!f.getName().endsWith(".wav")) return 0;
        if (f.lastModified() >= cutoffMs && f.delete()) return 1;
        return 0;
    }

    private static String todayCounterKey() {
        return "captures_" + new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date());
    }
}
