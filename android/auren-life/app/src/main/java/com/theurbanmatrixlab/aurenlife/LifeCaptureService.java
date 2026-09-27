package com.theurbanmatrixlab.aurenlife;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

public class LifeCaptureService extends Service {
    public static final String ACTION_START = "com.theurbanmatrixlab.aurenlife.START";
    public static final String ACTION_PRIVATE = "com.theurbanmatrixlab.aurenlife.PRIVATE";
    public static final String ACTION_RESUME = "com.theurbanmatrixlab.aurenlife.RESUME";
    public static final String ACTION_MARK = "com.theurbanmatrixlab.aurenlife.MARK";
    public static final String ACTION_DELETE_5 = "com.theurbanmatrixlab.aurenlife.DELETE5";
    public static final String ACTION_STOP = "com.theurbanmatrixlab.aurenlife.STOP";

    private static final int NOTIFICATION_ID = 7611;
    private static final String CHANNEL_ID = "auren_life_capture";
    private static final int SAMPLE_RATE = 16000;
    private static final int FRAME_MS = 100;
    private static final int SAMPLES_PER_FRAME = SAMPLE_RATE * FRAME_MS / 1000;
    private static final int BYTES_PER_SECOND = SAMPLE_RATE * 2;
    private static final int RING_SECONDS = 30;
    private static final int PRE_ROLL_SECONDS = 3;
    private static final int VOICE_START_FRAMES = 2;
    private static final int SILENCE_END_FRAMES = 20;
    private static final double RMS_THRESHOLD = 650.0;
    private static final long MAX_SEGMENT_MS = 5 * 60 * 1000L;

    private final AtomicBoolean alive = new AtomicBoolean(false);
    private final AtomicBoolean privateMode = new AtomicBoolean(false);
    private final Object ringLock = new Object();
    private final Object recorderLock = new Object();
    private final Deque<byte[]> ring = new ArrayDeque<>();
    private int ringBytes = 0;
    private AudioRecord recorder;
    private Thread captureThread;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (action == null) action = ACTION_START;

        switch (action) {
            case ACTION_PRIVATE:
                enterPrivateMode();
                break;
            case ACTION_RESUME:
                leavePrivateMode();
                break;
            case ACTION_MARK:
                markMoment();
                break;
            case ACTION_DELETE_5:
                deleteLastFiveMinutes();
                break;
            case ACTION_STOP:
                stopLifeMode();
                break;
            case ACTION_START:
            default:
                startLifeMode();
                break;
        }
        return START_NOT_STICKY;
    }

    private void startLifeMode() {
        if (alive.get()) {
            updateNotification();
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            EventStore.log(this, "capture_error", "Microphone permission is not granted.", null);
            stopSelf();
            return;
        }

        alive.set(true);
        privateMode.set(false);
        setStatePrefs(true, false);
        startAsMicrophoneForeground(buildNotification());
        acquireWakeLock();
        EventStore.log(this, "life_mode_start", "Life Mode started by Anthony.", null);

        captureThread = new Thread(this::captureLoop, "AurenLifeCapture");
        captureThread.start();
    }

    private void captureLoop() {
        int min = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT);
        int bufferSize = Math.max(min, SAMPLES_PER_FRAME * 2 * 4);

        try {
            synchronized (recorderLock) {
                recorder = new AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        SAMPLE_RATE,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufferSize);
                if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
                    EventStore.log(this, "capture_error", "AudioRecord failed to initialize.", null);
                    alive.set(false);
                    return;
                }
                recorder.startRecording();
            }

            short[] samples = new short[SAMPLES_PER_FRAME];
            ByteArrayOutputStream segment = null;
            int voiceFrames = 0;
            int silenceFrames = 0;
            long segmentStarted = 0L;

            while (alive.get()) {
                if (privateMode.get()) {
                    sleepQuietly(150);
                    continue;
                }

                int read;
                synchronized (recorderLock) {
                    if (recorder == null || recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                        sleepQuietly(100);
                        continue;
                    }
                    read = recorder.read(samples, 0, samples.length);
                }
                if (read <= 0) continue;

                byte[] frame = shortsToBytes(samples, read);
                addToRing(frame);
                boolean voice = rms(samples, read) >= RMS_THRESHOLD;

                if (segment == null) {
                    if (voice) voiceFrames++; else voiceFrames = 0;
                    if (voiceFrames >= VOICE_START_FRAMES) {
                        segment = new ByteArrayOutputStream();
                        writeRingTail(segment, PRE_ROLL_SECONDS * BYTES_PER_SECOND);
                        segmentStarted = System.currentTimeMillis();
                        silenceFrames = 0;
                        voiceFrames = 0;
                    }
                } else {
                    segment.write(frame, 0, frame.length);
                    if (voice) silenceFrames = 0; else silenceFrames++;

                    if (silenceFrames >= SILENCE_END_FRAMES ||
                            System.currentTimeMillis() - segmentStarted >= MAX_SEGMENT_MS) {
                        saveSegment(segment.toByteArray(), "audio_segment", "Speech segment captured.");
                        segment = null;
                        silenceFrames = 0;
                    }
                }
            }

            if (segment != null && segment.size() > BYTES_PER_SECOND) {
                saveSegment(segment.toByteArray(), "audio_segment", "Final segment saved when Life Mode stopped.");
            }
        } catch (Exception e) {
            EventStore.log(this, "capture_error", e.getClass().getSimpleName() + ": " + e.getMessage(), null);
        } finally {
            releaseRecorder();
            setStatePrefs(false, false);
            releaseWakeLock();
            if (!alive.get()) stopForeground(STOP_FOREGROUND_REMOVE);
        }
    }

    private void enterPrivateMode() {
        if (!alive.get() || privateMode.get()) return;
        privateMode.set(true);
        synchronized (recorderLock) {
            try {
                if (recorder != null && recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    recorder.stop();
                }
            } catch (Exception ignored) {}
        }
        setStatePrefs(true, true);
        EventStore.log(this, "private_mode", "Microphone capture paused.", null);
        updateNotification();
    }

    private void leavePrivateMode() {
        if (!alive.get() || !privateMode.get()) return;
        synchronized (recorderLock) {
            try {
                if (recorder != null && recorder.getState() == AudioRecord.STATE_INITIALIZED) {
                    recorder.startRecording();
                }
            } catch (Exception e) {
                EventStore.log(this, "capture_error", "Could not resume microphone: " + e.getMessage(), null);
                return;
            }
        }
        privateMode.set(false);
        setStatePrefs(true, false);
        EventStore.log(this, "private_mode_end", "Microphone capture resumed.", null);
        updateNotification();
    }

    private void markMoment() {
        byte[] recent;
        synchronized (ringLock) {
            if (ringBytes == 0) {
                EventStore.log(this, "mark_moment", "No buffered audio was available.", null);
                return;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream(ringBytes);
            for (byte[] chunk : ring) out.write(chunk, 0, chunk.length);
            recent = out.toByteArray();
        }
        saveSegment(recent, "marked_moment", "Marked the previous ~30 seconds for biography review.");
    }

    private void deleteLastFiveMinutes() {
        synchronized (ringLock) {
            ring.clear();
            ringBytes = 0;
        }
        int deleted = EventStore.deleteAudioSince(this, System.currentTimeMillis() - 5 * 60 * 1000L);
        EventStore.log(this, "privacy_action", "Delete Last 5 Minutes completed: " + deleted + " file(s).", null);
    }

    private void stopLifeMode() {
        if (!alive.get()) {
            stopSelf();
            return;
        }
        EventStore.log(this, "life_mode_stop", "Life Mode stopped.", null);
        alive.set(false);
        privateMode.set(false);
        setStatePrefs(false, false);
        releaseRecorder();
        releaseWakeLock();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void addToRing(byte[] frame) {
        synchronized (ringLock) {
            ring.addLast(frame);
            ringBytes += frame.length;
            int max = RING_SECONDS * BYTES_PER_SECOND;
            while (ringBytes > max && !ring.isEmpty()) {
                byte[] first = ring.removeFirst();
                ringBytes -= first.length;
            }
        }
    }

    private void writeRingTail(ByteArrayOutputStream out, int bytesWanted) {
        synchronized (ringLock) {
            List<byte[]> chunks = new ArrayList<>(ring);
            int total = 0;
            for (int i = chunks.size() - 1; i >= 0; i--) {
                total += chunks.get(i).length;
                if (total >= bytesWanted) {
                    for (int j = i; j < chunks.size(); j++) {
                        byte[] c = chunks.get(j);
                        out.write(c, 0, c.length);
                    }
                    return;
                }
            }
            for (byte[] c : chunks) out.write(c, 0, c.length);
        }
    }

    private void saveSegment(byte[] pcm, String eventType, String detail) {
        if (pcm == null || pcm.length < BYTES_PER_SECOND / 2) return;
        try {
            String stamp = new SimpleDateFormat("HHmmss_SSS", Locale.US).format(new Date());
            File file = new File(EventStore.todayDir(this), eventType + "_" + stamp + ".wav");
            WavWriter.writeMono16(file, pcm, SAMPLE_RATE);
            EventStore.log(this, eventType, detail, file.getAbsolutePath());
        } catch (Exception e) {
            EventStore.log(this, "capture_error", "Could not save WAV: " + e.getMessage(), null);
        }
    }

    private static byte[] shortsToBytes(short[] samples, int count) {
        byte[] out = new byte[count * 2];
        for (int i = 0; i < count; i++) {
            short s = samples[i];
            out[i * 2] = (byte) (s & 0xff);
            out[i * 2 + 1] = (byte) ((s >> 8) & 0xff);
        }
        return out;
    }

    private static double rms(short[] samples, int count) {
        if (count <= 0) return 0;
        double sum = 0;
        for (int i = 0; i < count; i++) {
            double v = samples[i];
            sum += v * v;
        }
        return Math.sqrt(sum / count);
    }

    private void releaseRecorder() {
        synchronized (recorderLock) {
            if (recorder != null) {
                try { if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop(); } catch (Exception ignored) {}
                try { recorder.release(); } catch (Exception ignored) {}
                recorder = null;
            }
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AurenLife:Capture");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(12 * 60 * 60 * 1000L);
        } catch (Exception ignored) {}
    }

    private void releaseWakeLock() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        wakeLock = null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Auren Life Mode",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Visible indicator while Auren Life Mode uses the microphone.");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        boolean isPrivate = privateMode.get();
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(this, 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        b.setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentTitle(isPrivate ? "Auren Life — PRIVATE" : "Auren Life — LISTENING")
                .setContentText(isPrivate ? "Microphone paused. Tap Resume when ready." : "Life Mode active. Visible capture is running.")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openPi);

        if (isPrivate) {
            b.addAction(new Notification.Action.Builder(
                    android.R.drawable.ic_media_play,
                    "Resume",
                    serviceIntent(ACTION_RESUME, 11)).build());
        } else {
            b.addAction(new Notification.Action.Builder(
                    android.R.drawable.ic_media_pause,
                    "Private",
                    serviceIntent(ACTION_PRIVATE, 12)).build());
            b.addAction(new Notification.Action.Builder(
                    android.R.drawable.ic_menu_save,
                    "Mark",
                    serviceIntent(ACTION_MARK, 13)).build());
        }
        b.addAction(new Notification.Action.Builder(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Stop",
                serviceIntent(ACTION_STOP, 14)).build());
        return b.build();
    }

    private PendingIntent serviceIntent(String action, int requestCode) {
        Intent i = new Intent(this, LifeCaptureService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildNotification());
    }

    private void startAsMicrophoneForeground(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void setStatePrefs(boolean active, boolean paused) {
        getSharedPreferences("auren_life_state", MODE_PRIVATE).edit()
                .putBoolean("service_active", active)
                .putBoolean("private_mode", paused)
                .apply();
    }

    private static void sleepQuietly(long millis) {
        try { Thread.sleep(millis); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
    }

    @Override
    public void onDestroy() {
        alive.set(false);
        releaseRecorder();
        releaseWakeLock();
        setStatePrefs(false, false);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
