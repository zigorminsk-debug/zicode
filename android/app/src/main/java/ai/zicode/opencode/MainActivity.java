package ai.zicode.opencode;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        if (getWindow() != null) {
            getWindow().setStatusBarColor(Color.parseColor("#0A0C10"));
            getWindow().setNavigationBarColor(Color.parseColor("#0A0C10"));
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0A0C10"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.clearCache(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new ZiCodeBridge(), "ZiCodeNativeBridge");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html?v=260");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class ZiCodeBridge {

        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }

        @JavascriptInterface
        public String runShell(String command) {
            try {
                File workDir = new File(getFilesDir(), "workspace");
                if (!workDir.exists()) {
                    workDir.mkdirs();
                }
                Process process = new ProcessBuilder("/system/bin/sh", "-c", command)
                        .directory(workDir)
                        .redirectErrorStream(true)
                        .start();

                StringBuilder out = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        out.append(line).append("\n");
                    }
                }
                process.waitFor();
                return out.toString();
            } catch (Exception e) {
                return "Shell error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String readFile(String relativePath) {
            try {
                File workDir = new File(getFilesDir(), "workspace");
                File target = new File(workDir, relativePath);
                if (!target.exists()) return "";
                try (FileInputStream fis = new FileInputStream(target)) {
                    byte[] bytes = new byte[(int) target.length()];
                    int read = fis.read(bytes);
                    if (read <= 0) return "";
                    return new String(bytes, 0, read, StandardCharsets.UTF_8);
                }
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean writeFile(String relativePath, String content) {
            try {
                File workDir = new File(getFilesDir(), "workspace");
                File target = new File(workDir, relativePath);
                File parent = target.getParentFile();
                if (parent != null && !parent.exists()) {
                    parent.mkdirs();
                }
                try (FileOutputStream fos = new FileOutputStream(target)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String httpPost(String urlString, String headersJson, String body) {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(urlString);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(25000);
                conn.setReadTimeout(60000);
                conn.setDoOutput(true);
                conn.setDoInput(true);

                if (headersJson != null && !headersJson.isEmpty()) {
                    JSONObject headers = new JSONObject(headersJson);
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        conn.setRequestProperty(k, headers.optString(k, ""));
                    }
                }

                byte[] payload = body != null ? body.getBytes(StandardCharsets.UTF_8) : new byte[0];
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(payload);
                    os.flush();
                }

                int code = conn.getResponseCode();
                InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                if (is == null) {
                    return "{\"__bridgeError\":true,\"status\":" + code + "}";
                }
                StringBuilder sb = new StringBuilder();
                try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                }
                return sb.toString();
            } catch (Exception e) {
                return "{\"__bridgeError\":true,\"message\":\"" + e.getMessage().replace("\"", "'") + "\"}";
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }
    }
}
