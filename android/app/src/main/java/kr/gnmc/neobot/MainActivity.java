package kr.gnmc.neobot;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * 웹앱(assets/www)을 WebView로 띄우고, USB 동글(CP210x) 통신을 NBAndroid 브리지로 제공.
 * 페이지 쪽에서는 android-serial.js가 이 브리지를 navigator.serial 모양으로 감쌈.
 */
public class MainActivity extends Activity {
    private static final String TAG = "NeobotTablet";
    private static final String HOST = "appassets.androidplatform.net";   // 가상 https 주소 → fetch·모듈 import 정상 동작
    private static final String ACTION_PERM = "kr.gnmc.neobot.USB_PERMISSION";

    private WebView web;
    private UsbManager usb;
    private Cp210x dev;
    private Thread reader;
    private volatile boolean running;
    private int pendingBaud = 115200;

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            String a = i.getAction();
            if (ACTION_PERM.equals(a)) {
                boolean ok = i.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                if (ok) doOpen(); else js("onOpen", "false", q("동글 사용을 허용하지 않았어요"));
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(a)) {
                UsbDevice d = i.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (Cp210x.isCp210x(d)) { closeDev(); js("onDetach"); }
            }
        }
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        usb = (UsbManager) getSystemService(Context.USB_SERVICE);

        IntentFilter f = new IntentFilter(ACTION_PERM);
        f.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(usbReceiver, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(usbReceiver, f);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage: 보정값·기록 저장
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        web.addJavascriptInterface(new Bridge(), "NBAndroid");
        web.setWebViewClient(new AssetClient());
        setContentView(web);
        web.loadUrl("https://" + HOST + "/index.html");
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        closeDev();
        try { unregisterReceiver(usbReceiver); } catch (Exception ignored) { }
        web.destroy();
        super.onDestroy();
    }

    // ---- USB ----
    private UsbDevice findDevice() {
        for (UsbDevice d : usb.getDeviceList().values()) if (Cp210x.isCp210x(d)) return d;
        return null;
    }

    private void doOpen() {
        UsbDevice d = findDevice();
        if (d == null) { js("onOpen", "false", q("동글이 꽂혀 있지 않아요")); return; }
        closeDev();
        Cp210x c = new Cp210x(d);
        try { c.open(usb, pendingBaud); }
        catch (IOException e) { c.close(); js("onOpen", "false", q(e.getMessage())); return; }
        dev = c;
        running = true;
        reader = new Thread(() -> {
            byte[] buf = new byte[256];
            while (running) {
                int n = c.read(buf, 200);
                if (n > 0) {
                    String b64 = Base64.encodeToString(buf, 0, n, Base64.NO_WRAP);
                    js("onData", q(b64));
                }
            }
        }, "cp210x-read");
        reader.start();
        js("onOpen", "true", "''");
    }

    private void closeDev() {
        running = false;
        if (reader != null) { try { reader.join(500); } catch (InterruptedException ignored) { } reader = null; }
        if (dev != null) { dev.close(); dev = null; }
    }

    // 페이지의 window.__nbAndroid.<fn>(args) 호출
    private void js(String fn, String... args) {
        final String code = "window.__nbAndroid&&window.__nbAndroid." + fn + "(" + String.join(",", args) + ")";
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }
    private static String q(String s) { return "'" + (s == null ? "" : s.replace("\\", "\\\\").replace("'", "\\'")) + "'"; }

    private class Bridge {
        @JavascriptInterface public boolean hasDevice() { return findDevice() != null; }

        @JavascriptInterface public void open(int baud) {
            pendingBaud = baud;
            runOnUiThread(() -> {
                UsbDevice d = findDevice();
                if (d == null) { js("onOpen", "false", q("동글이 꽂혀 있지 않아요")); return; }
                if (usb.hasPermission(d)) { doOpen(); return; }
                Intent i = new Intent(ACTION_PERM).setPackage(getPackageName());
                int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
                usb.requestPermission(d, PendingIntent.getBroadcast(MainActivity.this, 0, i, flags));
            });
        }

        @JavascriptInterface public boolean write(String b64) {
            Cp210x c = dev;
            if (c == null) return false;
            try { c.write(Base64.decode(b64, Base64.DEFAULT)); return true; }
            catch (Exception e) { Log.w(TAG, "write", e); return false; }
        }

        @JavascriptInterface public boolean setSignals(boolean dtr, boolean rts) {
            Cp210x c = dev;
            if (c == null) return false;
            try { c.setSignals(dtr, rts); return true; } catch (IOException e) { return false; }
        }

        @JavascriptInterface public void close() { runOnUiThread(MainActivity.this::closeDev); }
    }

    // ---- assets/www 를 https://appassets.androidplatform.net/ 으로 제공 ----
    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css"); MIME.put("json", "application/json"); MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg"); MIME.put("jpeg", "image/jpeg"); MIME.put("svg", "image/svg+xml");
        MIME.put("ico", "image/x-icon"); MIME.put("woff2", "font/woff2"); MIME.put("woff", "font/woff");
        MIME.put("ttf", "font/ttf"); MIME.put("mp3", "audio/mpeg"); MIME.put("wav", "audio/wav");
        MIME.put("ogg", "audio/ogg"); MIME.put("dat", "text/plain"); MIME.put("ldr", "text/plain"); MIME.put("mpd", "text/plain");
    }

    private class AssetClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (HOST.equals(u.getHost())) return false;
            // 바깥 주소(깃허브 등)는 기본 브라우저로
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
            return true;
        }

        @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath();
            if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
            if (path.endsWith("/")) path += "index.html";
            String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
            String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
            try {
                InputStream in = getAssets().open("www" + Uri.decode(path));
                if (ext.equals("html")) in = injectSerial(in);
                WebResourceResponse res = new WebResourceResponse(mime, mime.startsWith("text/") || mime.endsWith("json") ? "utf-8" : null, in);
                Map<String, String> h = new HashMap<>();
                h.put("Access-Control-Allow-Origin", "*");
                h.put("Cache-Control", "no-cache");
                res.setResponseHeaders(h);
                return res;
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
            }
        }
    }

    // 모든 페이지 <head> 맨 앞에 android-serial.js를 넣어 웹앱 코드보다 먼저 실행
    private static InputStream injectSerial(InputStream in) throws IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] b = new byte[8192]; int n;
        while ((n = in.read(b)) > 0) bo.write(b, 0, n);
        in.close();
        String html = bo.toString("UTF-8");
        String tag = "<script src=\"/android-serial.js\"></script>";
        int i = html.indexOf("<head>");
        html = i >= 0 ? html.substring(0, i + 6) + tag + html.substring(i + 6) : tag + html;
        return new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8));
    }
}
