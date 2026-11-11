package com.agencyos.app;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the web app paint the system bar areas with its own background, so the app looks native in
 * light and dark mode (instead of the launch-screen green showing above and below the WebView).
 *
 * JS: Capacitor.nativePromise('AgencyShell', 'setSystemBars', { color: '#121212', dark: true })
 */
@CapacitorPlugin(name = "AgencyShell")
public class AgencyShellPlugin extends Plugin {

    @PluginMethod
    public void setSystemBars(PluginCall call) {
        String hex = call.getString("color", "#ffffff");
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        final int color;
        try {
            color = Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid color: " + hex);
            return;
        }

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            // Areas around the WebView (status/navigation bar insets) show the window background.
            window.getDecorView().setBackgroundColor(color);
            window.setStatusBarColor(color);
            window.setNavigationBarColor(color);
            getBridge().getWebView().setBackgroundColor(color);

            WindowInsetsControllerCompat insets = WindowCompat.getInsetsController(window, window.getDecorView());
            insets.setAppearanceLightStatusBars(!dark);
            insets.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
