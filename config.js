/*
 * 出荷チェック 設定。公開されても安全な値のみ。
 * CLIENT_ID は demo_rental / portal と同一（共通ログイン＝同一 aud）。
 */
window.APP_CONFIG = {
  CLIENT_ID: '1061860031109-005vd0tcpi6l515d0c97npmg29saju86.apps.googleusercontent.com',
  ALLOWED_DOMAIN: 'hanshinco.com',
  // ★API化した出荷チェックGASの /exec URL（access:ANYONE の新デプロイ）。現行の /a/macros/... とは別物。
  GAS_URL: 'https://script.google.com/macros/s/AKfycby0TFDZ8dff118PZ-J1sSLAn_C2pKq7FnyhEqhXiLyTd4OhbcIm3pXla4tHjlaWeW7dRA/exec'
};
