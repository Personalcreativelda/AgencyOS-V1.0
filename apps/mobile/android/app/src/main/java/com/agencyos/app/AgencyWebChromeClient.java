package com.agencyos.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Parcelable;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.Logger;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Image uploads in the web app use a plain <input type="file" accept="image/*">. Capacitor's
 * default client opens only the file picker for that (the camera only appears with `capture`).
 * This client offers both: "Câmera" and the gallery / files app in one native chooser.
 *
 * - Gallery/files go through the system picker (ACTION_GET_CONTENT), which grants access to the
 *   chosen files only — no READ_MEDIA_* / storage permission needed.
 * - The camera needs the CAMERA permission; it's asked the first time only. If denied, the
 *   chooser still opens with the gallery.
 * Everything else (non-image inputs, inputs with `capture`) falls back to Capacitor's behaviour.
 */
public class AgencyWebChromeClient extends BridgeWebChromeClient {

    private final Bridge bridge;
    private final ActivityResultLauncher<Intent> chooserLauncher;
    private final ActivityResultLauncher<String> cameraPermissionLauncher;

    private ValueCallback<Uri[]> pendingCallback;
    private FileChooserParams pendingParams;
    private Uri cameraOutputUri;

    public AgencyWebChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
        this.chooserLauncher = bridge.registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> deliver(result.getResultCode(), result.getData())
        );
        this.cameraPermissionLauncher = bridge.registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> openChooser(granted)
        );
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams params) {
        if (params.isCaptureEnabled() || !acceptsImages(params)) {
            return super.onShowFileChooser(webView, filePathCallback, params);
        }
        // A previous chooser that never returned must be released, or the input stops responding.
        if (pendingCallback != null) pendingCallback.onReceiveValue(null);
        pendingCallback = filePathCallback;
        pendingParams = params;

        if (hasCameraPermission()) {
            openChooser(true);
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
        }
        return true;
    }

    private boolean acceptsImages(FileChooserParams params) {
        String[] types = params.getAcceptTypes();
        if (types == null || types.length == 0) return false;
        for (String type : types) {
            if (type != null && (type.startsWith("image/") || type.matches("(?i)\\.(png|jpe?g|webp|gif|heic)"))) return true;
        }
        return false;
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(bridge.getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private void openChooser(boolean withCamera) {
        if (pendingCallback == null || pendingParams == null) return;

        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.setType("image/*");
        if (pendingParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }

        List<Parcelable> extra = new ArrayList<>();
        cameraOutputUri = null;
        if (withCamera) {
            Intent camera = buildCameraIntent();
            if (camera != null) extra.add(camera);
        }

        Intent chooser = Intent.createChooser(pick, "Adicionar imagem");
        if (!extra.isEmpty()) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extra.toArray(new Parcelable[0]));

        try {
            chooserLauncher.launch(chooser);
        } catch (ActivityNotFoundException e) {
            Logger.warn("FileChooser", "No activity to pick images");
            deliverNothing();
        }
    }

    private Intent buildCameraIntent() {
        try {
            File dir = new File(bridge.getContext().getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File photo = File.createTempFile("agencyos_", ".jpg", dir);
            cameraOutputUri = FileProvider.getUriForFile(
                bridge.getContext(), bridge.getContext().getPackageName() + ".fileprovider", photo
            );
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return intent;
        } catch (IOException | IllegalArgumentException e) {
            Logger.warn("FileChooser", "Camera unavailable: " + e.getMessage());
            cameraOutputUri = null;
            return null;
        }
    }

    private void deliver(int resultCode, Intent data) {
        if (pendingCallback == null) return;
        Uri[] result = null;
        if (resultCode == Activity.RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                result = new Uri[n];
                for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                result = new Uri[] { data.getData() };
            } else if (cameraOutputUri != null) {
                // Camera apps return no data — the photo was written to our EXTRA_OUTPUT uri.
                result = new Uri[] { cameraOutputUri };
            }
        }
        pendingCallback.onReceiveValue(result);
        pendingCallback = null;
        pendingParams = null;
    }

    private void deliverNothing() {
        if (pendingCallback != null) pendingCallback.onReceiveValue(null);
        pendingCallback = null;
        pendingParams = null;
    }
}
