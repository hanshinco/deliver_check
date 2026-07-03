/* 出荷チェック アプリ本体（移行先スケルトン）。
 *
 * ★移行のやること（MIGRATION_GUIDE §Step3）:
 *   1) 現行 _legacy/Index.html の <script> ロジックを、この app-core.js に移植する。
 *      `google.script.run.xxx(...)` はそのままでOK（auth.js のシムが fetch に橋渡し）。
 *   2) 現行 Index.html の <style> は styles.css へ、マークアップは #app 内に描画する形へ。
 *   3) ログイン後、auth.js が下の boot() を呼ぶ。ここで初期データ取得→初期描画。
 */

function busyOff() {}   // auth.js が任意参照。現行UIのローディング停止関数に合わせて実装。

function boot() {
  // TODO: 現行UIの初期化をここへ。例:
  //   google.script.run.withSuccessHandler(onChecklist).withFailureHandler(onErr).getChecklist('');
  document.getElementById('loading').style.display = 'none';
  var app = document.getElementById('app');
  app.style.display = '';
  app.innerHTML = '<div style="padding:48px;max-width:720px;margin:0 auto;color:#6b7280;font-family:Inter,\'Noto Sans JP\',sans-serif;line-height:1.9">'
    + '<h2 style="color:#1f2430;margin:0 0 8px">出荷チェック（移行スケルトン）</h2>'
    + '認証は完成しています（共通ログイン/SSO）。ここに現行UI（<code>_legacy/Index.html</code>）を移植してください。'
    + '手順は <code>docs/MIGRATION_GUIDE.md</code>。</div>';
}
