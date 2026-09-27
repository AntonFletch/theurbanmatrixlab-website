package com.theurbanmatrixlab.aurenlife;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;

public class MainActivity extends Activity {
    private static final int REQ_PERMS = 1001;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView status;
    private TextView counts;
    private TextView timeline;
    private Button privateButton;

    private final Runnable refresher = new Runnable() {
        @Override public void run() {
            refresh();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildUi());
        requestRuntimePermissions();
    }

    @Override protected void onResume() {
        super.onResume();
        handler.post(refresher);
    }

    @Override protected void onPause() {
        handler.removeCallbacks(refresher);
        super.onPause();
    }

    private View buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(getColor(R.color.umx_bg));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(24), dp(20), dp(40));
        scroll.addView(root, new ScrollView.LayoutParams(-1, -2));

        TextView brand = text("UMX // AUREN LIFE", 14, R.color.umx_gold, true);
        root.addView(brand);

        TextView title = text("Your day. Captured on your terms.", 28, R.color.umx_text, true);
        LinearLayout.LayoutParams titleLp = lp();
        titleLp.topMargin = dp(10);
        root.addView(title, titleLp);

        TextView legal = text("Life Mode always shows an Android notification while the microphone is active. Use PRIVATE whenever other people have not agreed to be recorded.", 14, R.color.umx_muted, false);
        LinearLayout.LayoutParams legalLp = lp();
        legalLp.topMargin = dp(10);
        legalLp.bottomMargin = dp(18);
        root.addView(legal, legalLp);

        LinearLayout panel = panel();
        root.addView(panel, lpWithBottom(16));

        status = text("STATUS: OFFLINE", 20, R.color.umx_text, true);
        panel.addView(status);
        counts = text("TODAY: 0 captures", 14, R.color.umx_muted, false);
        panel.addView(counts, lpWithTop(8));
        panel.addView(text("T-VIRUS: GREEN  •  UMX BRAIN: LOCAL-FIRST", 13, R.color.umx_green, true), lpWithTop(8));

        Button start = button("START LIFE MODE", R.color.umx_gold);
        start.setOnClickListener(v -> beginLifeMode());
        root.addView(start, lpWithBottom(10));

        privateButton = button("PRIVATE / RESUME", R.color.umx_purple);
        privateButton.setOnClickListener(v -> togglePrivate());
        root.addView(privateButton, lpWithBottom(10));

        Button mark = button("MARK MOMENT — KEEP LAST 30 SEC", R.color.umx_purple);
        mark.setOnClickListener(v -> sendServiceAction(LifeCaptureService.ACTION_MARK));
        root.addView(mark, lpWithBottom(10));

        Button note = button("NOTE TO AUREN", R.color.umx_purple);
        note.setOnClickListener(v -> promptNote());
        root.addView(note, lpWithBottom(10));

        Button bio = button("QUEUE TODAY FOR BIO REVIEW", R.color.umx_purple);
        bio.setOnClickListener(v -> {
            EventStore.log(this, "bio_review_requested", "Today's captured material was queued for future UMX Brain biography review.", null);
            Toast.makeText(this, "Queued locally. Nothing is published automatically.", Toast.LENGTH_LONG).show();
            refresh();
        });
        root.addView(bio, lpWithBottom(10));

        Button delete5 = button("DELETE LAST 5 MINUTES", R.color.umx_red);
        delete5.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("Delete recent captured audio?")
                .setMessage("This deletes WAV files saved during the last five minutes and clears the rolling buffer. This cannot be undone.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete", (d, w) -> sendServiceAction(LifeCaptureService.ACTION_DELETE_5))
                .show());
        root.addView(delete5, lpWithBottom(10));

        Button stop = button("STOP LIFE MODE", R.color.umx_red);
        stop.setOnClickListener(v -> sendServiceAction(LifeCaptureService.ACTION_STOP));
        root.addView(stop, lpWithBottom(20));

        TextView t = text("RECENT TIMELINE", 15, R.color.umx_gold, true);
        root.addView(t, lpWithBottom(8));

        timeline = text("No events yet.", 14, R.color.umx_text, false);
        timeline.setPadding(dp(14), dp(14), dp(14), dp(14));
        timeline.setBackground(panelBackground());
        root.addView(timeline);

        TextView footer = text("Auren Life v0.1 • raw capture stays in this app's private storage. AI transcription/sync is intentionally separated from the phone capture service.", 12, R.color.umx_muted, false);
        root.addView(footer, lpWithTop(18));
        return scroll;
    }

    private void beginLifeMode() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestRuntimePermissions();
            Toast.makeText(this, "Allow microphone access, then tap Start Life Mode again.", Toast.LENGTH_LONG).show();
            return;
        }

        new AlertDialog.Builder(this)
                .setTitle("Start Auren Life Mode")
                .setMessage("Auren will use the microphone in a visible Android foreground service, keep a 30-second rolling buffer, and save voice-active segments locally. Use PRIVATE around anyone who has not agreed to recording.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Start", (dialog, which) -> sendServiceAction(LifeCaptureService.ACTION_START))
                .show();
    }

    private void togglePrivate() {
        SharedPreferences prefs = getSharedPreferences("auren_life_state", MODE_PRIVATE);
        boolean active = prefs.getBoolean("service_active", false);
        boolean isPrivate = prefs.getBoolean("private_mode", false);
        if (!active) {
            Toast.makeText(this, "Start Life Mode first.", Toast.LENGTH_SHORT).show();
            return;
        }
        sendServiceAction(isPrivate ? LifeCaptureService.ACTION_RESUME : LifeCaptureService.ACTION_PRIVATE);
    }

    private void sendServiceAction(String action) {
        Intent i = new Intent(this, LifeCaptureService.class).setAction(action);
        if (LifeCaptureService.ACTION_START.equals(action)) {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
        } else {
            startService(i);
        }
    }

    private void promptNote() {
        EditText input = new EditText(this);
        input.setHint("What should Auren remember about this moment?");
        input.setMinLines(3);
        input.setPadding(dp(16), dp(10), dp(16), dp(10));
        new AlertDialog.Builder(this)
                .setTitle("Note to Auren")
                .setView(input)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (d, w) -> {
                    String note = input.getText().toString().trim();
                    if (!note.isEmpty()) EventStore.log(this, "anthony_note", note, null);
                    refresh();
                })
                .show();
    }

    private void refresh() {
        SharedPreferences prefs = getSharedPreferences("auren_life_state", MODE_PRIVATE);
        boolean active = prefs.getBoolean("service_active", false);
        boolean isPrivate = prefs.getBoolean("private_mode", false);

        if (!active) {
            status.setText("STATUS: OFFLINE");
            status.setTextColor(getColor(R.color.umx_muted));
            privateButton.setText("PRIVATE / RESUME");
        } else if (isPrivate) {
            status.setText("STATUS: PRIVATE — MIC PAUSED");
            status.setTextColor(getColor(R.color.umx_gold));
            privateButton.setText("RESUME LIFE MODE");
        } else {
            status.setText("STATUS: LISTENING");
            status.setTextColor(getColor(R.color.umx_green));
            privateButton.setText("ENTER PRIVATE MODE");
        }

        counts.setText("TODAY: " + EventStore.todayCaptureCount(this) + " saved capture(s)  •  buffer: 30 sec");
        List<String> recent = EventStore.recent(this, 10);
        if (recent.isEmpty()) {
            timeline.setText("No events yet.");
        } else {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < recent.size(); i++) {
                if (i > 0) sb.append("\n\n");
                sb.append(recent.get(i));
            }
            timeline.setText(sb.toString());
        }
    }

    private void requestRuntimePermissions() {
        java.util.ArrayList<String> permissions = new java.util.ArrayList<>();
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!permissions.isEmpty()) requestPermissions(permissions.toArray(new String[0]), REQ_PERMS);
    }

    private LinearLayout panel() {
        LinearLayout p = new LinearLayout(this);
        p.setOrientation(LinearLayout.VERTICAL);
        p.setPadding(dp(16), dp(16), dp(16), dp(16));
        p.setBackground(panelBackground());
        return p;
    }

    private GradientDrawable panelBackground() {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(getColor(R.color.umx_panel));
        bg.setCornerRadius(dp(16));
        bg.setStroke(dp(1), getColor(R.color.umx_purple));
        return bg;
    }

    private TextView text(String value, int sp, int colorRes, boolean bold) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextSize(sp);
        v.setTextColor(getColor(colorRes));
        v.setLineSpacing(0, 1.15f);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }

    private Button button(String label, int colorRes) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(getColor(R.color.umx_text));
        b.setTextSize(14);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setGravity(Gravity.CENTER);
        b.setAllCaps(false);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(getColor(colorRes));
        bg.setCornerRadius(dp(14));
        b.setBackground(bg);
        b.setMinHeight(dp(54));
        return b;
    }

    private LinearLayout.LayoutParams lp() {
        return new LinearLayout.LayoutParams(-1, -2);
    }

    private LinearLayout.LayoutParams lpWithTop(int topDp) {
        LinearLayout.LayoutParams p = lp();
        p.topMargin = dp(topDp);
        return p;
    }

    private LinearLayout.LayoutParams lpWithBottom(int bottomDp) {
        LinearLayout.LayoutParams p = lp();
        p.bottomMargin = dp(bottomDp);
        return p;
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }
}
