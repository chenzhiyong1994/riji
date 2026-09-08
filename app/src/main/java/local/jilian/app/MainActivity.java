package local.jilian.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {

  private static final String ORIGIN = "https://app.jilian.local/";
  private static final int EXPORT = 20,
    IMPORT = 21,
    MAX_BACKUP = 16 * 1024 * 1024;
  private WebView web;
  private FrameLayout root;
  private volatile String pendingExport;
  private boolean pageReady;
  private Runnable dismissSystemSplash;

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    if (Build.VERSION.SDK_INT >= 31) {
      getSplashScreen().setOnExitAnimationListener(splash -> {
        if (pageReady) splash.remove();
        else dismissSystemSplash = splash::remove;
      });
    }
    web = new WebView(this);
    web.setBackgroundColor(Color.rgb(40, 39, 44));
    root = new FrameLayout(this);
    root.setBackgroundColor(Color.rgb(40, 39, 44));
    root.addView(web, new FrameLayout.LayoutParams(-1, -1));
    setContentView(root);
    if (Build.VERSION.SDK_INT >= 30) {
      getWindow().setDecorFitsSystemWindows(false);
      root.setOnApplyWindowInsetsListener((view, insets) -> {
        android.graphics.Insets safe = insets.getInsets(
          WindowInsets.Type.systemBars() | WindowInsets.Type.ime()
        );
        view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
        return WindowInsets.CONSUMED;
      });
      root.requestApplyInsets();
    }
    WebView.setWebContentsDebuggingEnabled(
      (getApplicationInfo().flags &
          android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) !=
        0
    );
    web.setImportantForAccessibility(
      android.view.View.IMPORTANT_FOR_ACCESSIBILITY_YES
    );
    // JavaScript 仅用于 APK 内的页面；资源拦截器、CSP 和零网络权限共同限制访问。
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(false);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setSupportZoom(false);
    settings.setMediaPlaybackRequiresUserGesture(true);
    web.addJavascriptInterface(new LocalBridge(), "NativeStore");
    web.setWebViewClient(
      new WebViewClient() {
        @Override
        public void onPageCommitVisible(WebView view, String url) {
          // 首屏内容可以绘制后再移除系统启动图，避免露出空白 WebView。
          pageReady = true;
          if (dismissSystemSplash != null) {
            dismissSystemSplash.run();
            dismissSystemSplash = null;
          }
        }

        @Override
        public boolean shouldOverrideUrlLoading(
          WebView view,
          WebResourceRequest request
        ) {
          return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(
          WebView view,
          WebResourceRequest request
        ) {
          String uri = request.getUrl().toString();
          if (!uri.startsWith(ORIGIN)) return blocked();
          String file = request.getUrl().getPath().substring(1);
          if (file.isEmpty()) file = "index.html";
          if (file.contains("..") || file.contains("\\")) return blocked();
          try {
            String mime = file.endsWith(".js")
              ? "application/javascript"
              : file.endsWith(".css")
                ? "text/css"
                : file.endsWith(".gif")
                  ? "image/gif"
                  : file.endsWith(".webp")
                    ? "image/webp"
                    : file.endsWith(".png")
                      ? "image/png"
                      : file.endsWith(".svg")
                        ? "image/svg+xml"
                        : "text/html";
            return new WebResourceResponse(
              mime,
              "UTF-8",
              getAssets().open(file)
            );
          } catch (Exception ignored) {
            return blocked();
          }
        }
      }
    );
    web.loadUrl(ORIGIN + "index.html");
    if (
      Build.VERSION.SDK_INT >= 33
    ) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
      android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
      this::handleBack
    );
  }

  @Override
  protected void onPause() {
    if (web != null) {
      web.evaluateJavascript(
        "window.pauseExerciseAnimation && window.pauseExerciseAnimation()",
        null
      );
      web.onPause();
    }
    super.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (web != null) web.onResume();
  }

  private WebResourceResponse blocked() {
    return new WebResourceResponse(
      "text/plain",
      "UTF-8",
      403,
      "Blocked",
      java.util.Collections.emptyMap(),
      new ByteArrayInputStream(new byte[0])
    );
  }

  private void callback(String function, String message) {
    runOnUiThread(() ->
      web.evaluateJavascript(
        "window." + function + "(" + JSONObject.quote(message) + ")",
        null
      )
    );
  }

  public class LocalBridge {

    @JavascriptInterface
    public String load() {
      return getSharedPreferences("training", MODE_PRIVATE).getString(
        "state",
        ""
      );
    }

    @JavascriptInterface
    public boolean save(String state) {
      if (state.length() > MAX_BACKUP) return false;
      try {
        new JSONObject(state);
        return getSharedPreferences("training", MODE_PRIVATE)
          .edit()
          .putString("state", state)
          .commit();
      } catch (Exception ex) {
        return false;
      }
    }

    @JavascriptInterface
    public void exportBackup(String json) {
      if (json.length() > MAX_BACKUP) {
        callback("nativeMessage", "备份文件过大");
        return;
      }
      pendingExport = json;
      runOnUiThread(() -> {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
          .addCategory(Intent.CATEGORY_OPENABLE)
          .setType("application/json")
          .putExtra(Intent.EXTRA_LOCAL_ONLY, true)
          .putExtra(
            Intent.EXTRA_TITLE,
            "日跻备份-" +
              new java.text.SimpleDateFormat(
                "yyyy-MM-dd",
                java.util.Locale.ROOT
              ).format(new java.util.Date()) +
              ".json"
          );
        startActivityForResult(intent, EXPORT);
      });
    }

    @JavascriptInterface
    public void importBackup() {
      runOnUiThread(() ->
        startActivityForResult(
          new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*")
            .putExtra(Intent.EXTRA_LOCAL_ONLY, true),
          IMPORT
        )
      );
    }

    @JavascriptInterface
    public void setTheme(boolean light) {
      runOnUiThread(() -> {
        root.setBackgroundColor(
          Color.parseColor(light ? "#f6f6f8" : "#28272c")
        );
        getWindow().setStatusBarColor(
          Color.parseColor(light ? "#f6f6f8" : "#28272c")
        );
        getWindow().setNavigationBarColor(
          Color.parseColor(light ? "#ffffff" : "#222125")
        );
        if (Build.VERSION.SDK_INT >= 30) {
          WindowInsetsController controller = getWindow().getInsetsController();
          if (controller != null) {
            int appearance =
              WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS |
              WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            controller.setSystemBarsAppearance(
              light ? appearance : 0,
              appearance
            );
          }
        } else getWindow()
          .getDecorView()
          .setSystemUiVisibility(
            light ? android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR : 0
          );
      });
    }
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (result != RESULT_OK || data == null || data.getData() == null) {
      pendingExport = null;
      return;
    }
    try {
      if (request == EXPORT) {
        if (pendingExport == null) throw new java.io.IOException(
          "Export interrupted"
        );
        try (
          OutputStream out = getContentResolver().openOutputStream(
            data.getData()
          )
        ) {
          if (out == null) throw new java.io.IOException();
          out.write(pendingExport.getBytes(StandardCharsets.UTF_8));
        }
        pendingExport = null;
        callback("nativeMessage", "备份已保存");
      } else if (request == IMPORT) {
        try (
          InputStream in = getContentResolver().openInputStream(data.getData());
          ByteArrayOutputStream buffer = new ByteArrayOutputStream()
        ) {
          if (in == null) throw new java.io.IOException();
          byte[] chunk = new byte[8192];
          int count;
          while ((count = in.read(chunk)) != -1) {
            if (
              buffer.size() + count > MAX_BACKUP
            ) throw new java.io.IOException("too large");
            buffer.write(chunk, 0, count);
          }
          callback(
            "receiveImport",
            buffer.toString(StandardCharsets.UTF_8.name())
          );
        }
      }
    } catch (Exception e) {
      pendingExport = null;
      callback("nativeMessage", "文件操作失败，请检查文件和保存位置");
    }
  }

  private void handleBack() {
    web.evaluateJavascript(
      "window.handleBack && window.handleBack()",
      result -> {
        if (!"true".equals(result)) moveTaskToBack(true);
      }
    );
  }

  @Override
  public boolean onKeyUp(int keyCode, android.view.KeyEvent event) {
    if (
      Build.VERSION.SDK_INT < 33 &&
      keyCode == android.view.KeyEvent.KEYCODE_BACK
    ) {
      handleBack();
      return true;
    }
    return super.onKeyUp(keyCode, event);
  }

  @Override
  protected void onDestroy() {
    if (dismissSystemSplash != null) {
      dismissSystemSplash.run();
      dismissSystemSplash = null;
    }
    web.removeJavascriptInterface("NativeStore");
    web.destroy();
    super.onDestroy();
  }
}
