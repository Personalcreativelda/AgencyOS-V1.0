package com.agencyos.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge starts.
        registerPlugin(AgencyShellPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();

        // Camera + gallery chooser for image uploads (see AgencyWebChromeClient).
        webView.setWebChromeClient(new AgencyWebChromeClient(getBridge()));

        // A WebView ignores downloads by default — hand them to Android's DownloadManager so files
        // land in "Downloads" with the usual system notification. Same session cookies are sent so
        // authenticated downloads keep working.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
                Toast.makeText(this, "Este arquivo não pode ser baixado pelo app.", Toast.LENGTH_SHORT).show();
                return;
            }
            try {
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) request.addRequestHeader("Cookie", cookies);
                request.setTitle(fileName);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                dm.enqueue(request);
                Toast.makeText(this, "Baixando " + fileName + "…", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Não foi possível iniciar o download.", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
