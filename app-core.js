/* 出荷チェック アプリ本体（GitHub Pages SPA）。
 * 現行 _legacy/Index.html の <script> を移植。google.script.run は auth.js のシムが fetch に橋渡しするため無改変。
 * 初期化: 旧 DOMContentLoaded ハンドラを __initApp() 化し、ログイン成功後に auth.js が呼ぶ boot() から起動する。
 */

// auth.js が失敗時に任意参照（未定義でも動くが no-op を用意）。
function busyOff() {}

/* ===== モノトーンSVGアイコン（絵文字置換） =====
   currentColor 線画。サイズ/色は CSS(.ic) と親要素の color/font-size に追従。
   ・動的HTML内: ic('name') を埋め込む
   ・静的HTML(index.html)内: <span class="ic" data-ic="name"></span> を置き、boot時 hydrateIcons() で流し込む */
const ICON = {
  box:        '<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
  clipboard:  '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v2.5H9zM8.5 11h7M8.5 15h5"/></svg>',
  warn:       '<svg viewBox="0 0 24 24"><path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4.5M12 17.6h.01"/></svg>',
  inbox:      '<svg viewBox="0 0 24 24"><path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14"/><path d="M12 3.5v10M8 9.5l4 4 4-4"/></svg>',
  refresh:    '<svg viewBox="0 0 24 24"><path d="M20.5 12a8.5 8.5 0 1 1-2.4-6"/><path d="M18 2.5V6h-3.5"/></svg>',
  reload:     '<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.4-6"/><path d="M6 2.5V6h3.5"/></svg>',
  check:      '<svg viewBox="0 0 24 24"><path d="M5 12.5 9.5 17 19 6.5"/></svg>',
  checkcircle:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.2 10.8 15 16 8.8"/></svg>',
  trash:      '<svg viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l1 12.2a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/></svg>',
  printer:    '<svg viewBox="0 0 24 24"><path d="M7 9V4h10v5"/><path d="M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/></svg>',
  link:       '<svg viewBox="0 0 24 24"><path d="M9.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.4 1.4"/><path d="M14.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4"/></svg>',
  hand:       '<svg viewBox="0 0 24 24"><path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V10m0-.5V5a1.5 1.5 0 0 1 3 0v5m0-.5V6.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-3.9-1.9l-2.2-2.8a1.5 1.5 0 0 1 2.3-1.9L8 13.5"/></svg>',
  question:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.7 1.1c0 1.7-2.3 2-2.3 3.7M12 16.5h.01"/></svg>',
  exclaim:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.2h.01"/></svg>',
  wrench:     '<svg viewBox="0 0 24 24"><path d="M15.5 8.5a4 4 0 0 1-5-5l2.2 2.2 1.6-1.6L12.1 2A4 4 0 0 1 17 6.9l-1.5 1.6Z"/><path d="m13.5 10.5-8 8a2 2 0 0 1-3-3l8-8"/></svg>',
  ban:        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/></svg>',
  truck:      '<svg viewBox="0 0 24 24"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/></svg>',
  file:       '<svg viewBox="0 0 24 24"><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z"/><path d="M14 3.5v5h5"/></svg>',
  gear:       '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4 7l2.6 1.5M17.4 15.5 20 17M4 17l2.6-1.5M17.4 8.5 20 7"/></svg>',
  user:       '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>',
  search:     '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.6-3.6"/></svg>',
  edit:       '<svg viewBox="0 0 24 24"><path d="M4 20h4L18.5 9.5l-4-4L4 16z"/><path d="m13 7 4 4"/></svg>',
  undo:       '<svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5M4 12h10.5a5.5 5.5 0 0 1 0 11H13"/></svg>',
  mail:       '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
  x:          '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
// 動的HTML用: アイコン1個ぶんのspanを返す
function ic(name) { return '<span class="ic">' + (ICON[name] || '') + '</span>'; }
// 静的HTML(index.html)の <span data-ic="name"> に SVG を流し込む（boot時に1回）
function hydrateIcons(root) {
  (root || document).querySelectorAll('[data-ic]').forEach(function (el) {
    var n = el.getAttribute('data-ic'); if (ICON[n]) el.innerHTML = ICON[n];
  });
}

(function forceMobileLayout(){
  function apply(){
    var w = Math.min(
      window.innerWidth || 9999,
      document.documentElement.clientWidth || 9999,
      window.visualViewport ? window.visualViewport.width : 9999
    );
    var ua = navigator.userAgent || '';
    var isMobile = /iPhone|iPod|Android.*Mobile|Windows Phone/.test(ua) || w <= 980;
    document.documentElement.classList.toggle('force-mobile', isMobile);
  }
  apply();
  window.addEventListener('resize', apply);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);
})();
// ===== State =====
let allRows = [], skipRows = [];
let currentFilter = 'ALL', delMode = false;
let gIsAdmin = false;
let gIsViewOnly = false;  // IMPORT_EMAILSのみ（管理者でない）: チェック操作・完了ボタン非表示
let _checklistLoading = false;  // 同時実行防止フラグ
const fileWarnings = { yamato: false, sagawa: false };  // Excel破損警告フラグ
const selectedIds = new Set();
const files = { yayoi: null, yamato: null, sagawa: null };

// ===== Init =====
function __initApp() {
  document.getElementById('hdrDate').textContent =
    new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
  loadDateList();
  // 削除モードボタン：管理者のみ表示
  google.script.run
    .withSuccessHandler(status => {
      if (status.email) {
        document.getElementById('hdrEmail').innerHTML = ic('user') + esc(status.email);
      }
      gIsAdmin = status.isAdmin;
      gIsViewOnly = status.isImporter && !status.isAdmin;
      if (status.isAdmin) {
        document.getElementById('btnDelMode').style.display = '';
        document.getElementById('tabBtnSkip').style.display = '';
        document.getElementById('tabBtnImport').style.display = '';
        if (allRows.length > 0) render();
      } else if (status.isImporter) {
        document.getElementById('tabBtnImport').style.display = '';
        document.getElementById('btnComplete').style.display = 'none';
        if (allRows.length > 0) render();
      }
    })
    .withFailureHandler(err => { console.error('getAdminStatus error:', err); })
    .getAdminStatus();
}

function loadDateList() {
  google.script.run
    .withSuccessHandler(dates => {
      console.log('getAvailableDates OK:', dates.length, '件');
      ['dateSelect','skipDateSelect'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">-- 選択 --</option>';
        dates.forEach(d => { const o=document.createElement('option'); o.value=o.textContent=d; sel.appendChild(o); });
        if (dates.length > 0) sel.value = dates[0];
      });
      if (dates.length > 0) { loadChecklist(); loadSkipCandidates(); }
    })
    .withFailureHandler(err => {
      console.error('getAvailableDates FAILED:', err.message);
      toast('日付取得エラー: ' + err.message, 'err');
    })
    .getAvailableDates();
}

// ===== チェックリスト =====
function loadChecklist() {
  const date = document.getElementById('dateSelect').value;
  if (!date) {
    document.getElementById('emptyMsg').style.display = 'block';
    document.getElementById('clList').innerHTML = '';
    document.getElementById('summaryWrap').style.display = 'none';
    document.getElementById('filterBar').style.display = 'none';
    return;
  }
  if (_checklistLoading) return;  // 既に読み込み中なら無視（clListはそのまま）
  if (delMode) exitDelMode();
  _checklistLoading = true;
  setLoading('list', true);
  document.getElementById('emptyMsg').style.display = 'none';
  const _reloadBtn = document.getElementById('btnReload');
  const _reloadBtnOrig = _reloadBtn ? _reloadBtn.innerHTML : '';
  if (_reloadBtn) { _reloadBtn.disabled = true; _reloadBtn.innerHTML = '<div class="spin" style="width:14px;height:14px;border-width:2px;display:inline-block"></div>'; }
  // 30秒でタイムアウト保険
  if (window._listTimeoutId) clearTimeout(window._listTimeoutId);
  window._listTimeoutId = setTimeout(() => {
    _checklistLoading = false;
    setLoading('list', false);
  }, 30000);
  google.script.run
    .withSuccessHandler(rows => {
      clearTimeout(window._listTimeoutId);
      _checklistLoading = false;
      if (_reloadBtn) { _reloadBtn.disabled = false; _reloadBtn.innerHTML = _reloadBtnOrig; }
      try {
        allRows = (rows || []).sort((a, b) => {
          const carrierOrder = {'ヤマト':0, '佐川':1, '持参/引取':2, '':3};
          const ca = carrierOrder[a.carrier] ?? 3;
          const cb = carrierOrder[b.carrier] ?? 3;
          if (ca !== cb) return ca - cb;
          const ta = String(a.slip_type || '');
          const tb = String(b.slip_type || '');
          if (ta !== tb) return ta.localeCompare(tb);
          const a4 = String(a.tracking_no || '').slice(-4); const b4 = String(b.tracking_no || '').slice(-4); return a4.localeCompare(b4);
        });
        setLoading('list', false);
        render();
      } catch(e) {
        setLoading('list', false);
        toast('表示エラー: ' + e.message, 'err');
        console.error('render error:', e);
      }
    })
    .withFailureHandler(err => {
      clearTimeout(window._listTimeoutId);
      _checklistLoading = false;
      setLoading('list', false);
      if (_reloadBtn) { _reloadBtn.disabled = false; _reloadBtn.innerHTML = _reloadBtnOrig; }
      toast('読み込みエラー: ' + err.message, 'err');
      console.error('getChecklist error:', err);
    })
    .getChecklist(date);
}

function render() {
  const rows = filteredRows();
  const list = document.getElementById('clList');
  list.innerHTML = '';  // GAS正常返却後にのみ到達するのでここでクリア
  if (!rows.length) {
    list.innerHTML = '<div class="empty"><div class="icon">' + ic('search') + '</div><div>条件に一致する件数がありません</div></div>';
  } else {
    rows.forEach(r => list.appendChild(makeItem(r)));
  }
  updateSummary();
  document.getElementById('summaryWrap').style.display = '';
  document.getElementById('filterBar').style.display = delMode ? 'none' : '';
  document.getElementById('emptyMsg').style.display = 'none';
}

function makeItem(row) {
  const wrap = document.createElement('div');
  wrap.className = 'cl-item' + (row.checked?' done':'') + warnClass(row) + (selectedIds.has(row.id)?' del-selected':'');
  wrap.dataset.id = row.id;

  const items = (row.items_text||'').split(' / ').filter(Boolean);
  const itemRows = items.map(it => {
    const m = it.match(/^(.+?)\s*×\s*(.+)$/);
    return m ? `<tr><td>${esc(m[1])}</td><td style="text-align:right;white-space:nowrap">${esc(m[2])}</td></tr>`
             : `<tr><td colspan="2">${esc(it)}</td></tr>`;
  }).join('');

  const cCls = carrierClass(row.carrier);
  const codHtml = row.cod > 0 ? `<span style="font-size:11px;color:var(--warn)"> 代引¥${Number(row.cod).toLocaleString()}</span>` : '';

  // ① 弥生あり・発送データなし → サマリ行にボタン表示
  const isNoShip = row.match_status === 'NO_SHIP' || row.match_status === 'TRACKING_NOT_FOUND';
  const inlineBtns = isNoShip ? `
    <div class="cl-inline-btns" onclick="event.stopPropagation()">
      <button class="btn-jissha" onclick="doMarkJissha('${row.id}',event)">${ic('hand')}持参 / 引取に変更</button>
      <button class="btn-del-row" onclick="doDeleteRow('${row.id}',event)">${ic('trash')}リストから削除</button>
    </div>` : '';

  // ② 送り状データのみ → 詳細エリアにボタン
  const isNoYayoi = row.match_status === 'NO_YAYOI';

  // ④ 送り状番号入力（TRACKING_NOT_FOUNDかつ発送データなし以外）
  const needsManualLink = ['TRACKING_NOT_FOUND','MANUAL_MATCHED','MATCHED'].includes(row.match_status);

  // 送り状番号の個数分テキストボックスを生成
  const _mlNos = (needsManualLink && row.tracking_no) ? String(row.tracking_no).split(',').map(s=>s.trim()).filter(Boolean) : [];
  if (_mlNos.length === 0) _mlNos.push('');
  const _mlCount = _mlNos.length;
  const _mlInputsHtml = _mlNos.map((no,i) =>
    '<input type="text" placeholder="送り状番号を入力…" id="mlInp_'+row.id+'_'+i+'"'+
    ' value="'+esc(no)+'"'+
    ' style="padding:6px 10px;border:1px solid #f6e05e;border-radius:6px;font:13px inherit;width:100%;box-sizing:border-box">'
  ).join('');

  wrap.innerHTML = `
    <div class="cl-summary">
      <div class="cl-chk-cell">
        <input type="checkbox" class="del-chk" ${selectedIds.has(row.id)?'checked':''}
          onchange="toggleSelect('${row.id}',this)" onclick="event.stopPropagation()">
      </div>
      <div class="cl-slip">
        <div>${row.slip_no||'<span style="color:#ccc">ー</span>'}</div>
        ${row.tracking_no ? String(row.tracking_no).split(',').map(no=>no.trim()).filter(Boolean).map(no=>'<div style="font-size:14px;color:var(--sub);font-family:monospace;margin-top:2px">'+esc(no)+'</div>').join('') : ''}
      </div>
      <div class="cl-dest-wrap" onclick="handleSummaryClick(event,'${row.id}')">
        <div class="cl-dest">${esc(row.dest_display)}</div>
        <div style="font-size:11px;color:var(--sub);margin-top:2px">${kindBadge(row.kind)} ${statusBadge(row.match_status)}${row.bundled ? ' <span class="tag" style="background:#e9d8fd;color:#553c9a">同梱あり</span>' : ''}${row.checked && row.checker ? ' <span class="tag" style="background:#c6f6d5;color:#276749">' + ic('check') + esc(row.checker.includes('@') ? row.checker.split('@')[0] : row.checker) + '</span>' : ''}</div>
        ${inlineBtns}
      </div>
      <div class="cl-carrier ${cCls}" onclick="handleSummaryClick(event,'${row.id}')">${esc(row.carrier)}${row.slip_type?'<span style="font-size:10px;font-weight:600;opacity:.8;margin-left:3px">'+esc(slipTypeLabel(row.carrier,row.slip_type))+'</span>':''}${codHtml}</div>
      ${'' /* <div class="cl-count" onclick="handleSummaryClick(event,'${row.id}')">${row.count>0?row.count+'口':'ー'}</div> */}
      <div class="cl-chevron" onclick="handleSummaryClick(event,'${row.id}')">⌄</div>
    </div>
    <div class="cl-detail">
      <div class="detail-grid">
        <div class="dg-item"><label>得意先</label><span>${esc(row.client_name)||'ー'}</span></div>
        <div class="dg-item"><label>担当者</label><span>${esc(row.staff_name)||'ー'}</span></div>
        <div class="dg-item"><label>発送会社</label><span class="${cCls}">${esc(row.carrier)||'ー'}</span></div>
        <div class="dg-item"><label>送り状番号</label><span style="font-family:monospace;font-size:12px">${row.tracking_no ? String(row.tracking_no).split(',').map(no=>esc(no.trim())).filter(Boolean).join('<br>') : 'ー'}</span></div>
      </div>
      ${items.length ? `<table class="item-table"><thead><tr><th>商品名</th><th style="text-align:right">数量</th></tr></thead><tbody>${itemRows}</tbody></table>` : ''}
      ${needsManualLink && gIsAdmin ? `
      <div class="manual-link" id="mlWrap_${row.id}" data-ml-count="${_mlCount}">
        <label>${['MATCHED','MANUAL_MATCHED'].includes(row.match_status) ? ic('link')+'送り状番号を修正' : '送り状番号を手動入力'}</label>
        <div id="mlInputsDiv_${row.id}" style="display:flex;flex-direction:column;gap:4px;flex:1">${_mlInputsHtml}</div>
        <button class="btn btn-warn btn-sm" onclick="doManualLink('${row.id}',event)" style="align-self:flex-start">
          <span id="mlBtnTxt_${row.id}">${row.match_status === 'MANUAL_MATCHED' ? '修正する' : '紐付け実行'}</span>
        </button>
      </div>` : ''}
      ${isNoYayoi && gIsAdmin ? `
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="openNoYayoiModal('${row.id}',event)">${ic('clipboard')}弥生伝票を紐付け / デモ機・その他</button>
      </div>` : ''}
      ${row.match_status === 'DEMO_OTHER' ? `
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-warn btn-sm" onclick="openDemoEditModal('${row.id}',event)">${ic('edit')}デモ機 / その他を修正</button>
      </div>` : ''}
      <div class="cl-actions" style="margin-top:10px">
        ${gIsViewOnly ? '' : row.match_status === 'CANCELLED' ? `<span style="color:var(--sub);font-size:12px">${ic('ban')}キャンセル済み</span>` : row.checked
          ? `<button class="btn btn-ghost btn-sm" onclick="doCheck('${row.id}',false,event)">${ic('undo')}完了を取り消す</button>`
          : `<button class="btn btn-success btn-lg" onclick="doCheck('${row.id}',true,event)">${ic('checkcircle')}この件を完了にする</button>`}
        ${row.match_status !== 'CANCELLED' && gIsAdmin ? `<button class="btn btn-ghost btn-sm" style="color:var(--sub);border-color:var(--sub);margin-left:auto" onclick="doCancelRow('${row.id}',event)">${ic('ban')}キャンセル</button>` : ''}
      </div>
    </div>`;
  return wrap;
}

// ① 持参/引取に変更
function doMarkJissha(id, event) {
  event.stopPropagation();
  const btn = event.currentTarget;
  const orig = btn.innerHTML;
  btn.disabled = true; btn.textContent = '…';
  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; btn.innerHTML = orig;
      if (!res.ok) { toast('エラー: '+res.error,'err'); return; }
      const row = allRows.find(r=>r.id===id);
      if (row) { row.match_status='JISSHA'; row.carrier='持参/引取'; row.tracking_no=''; row.count=0; }
      const el = document.querySelector(`.cl-item[data-id="${id}"]`);
      if (el) { const n=makeItem(row); n.classList.add('open'); el.replaceWith(n); }
      updateSummary();
      toast('持参/引取に変更しました','ok');
    })
    .withFailureHandler(err=>{ btn.disabled=false; btn.innerHTML=orig; toast(err.message,'err'); })
    .markAsJissha(id);
}

// ① リストから削除（単行・管理者不要）
function doDeleteRow(id, event) {
  event.stopPropagation();
  if (!confirm('この行をリストから削除しますか？')) return;
  const btn = event.currentTarget;
  btn.disabled = true; btn.textContent = '…';
  google.script.run
    .withSuccessHandler(res => {
      if (!res.ok) { btn.disabled=false; btn.innerHTML=ic('trash')+'リストから削除'; toast('エラー: '+res.error,'err'); return; }
      allRows = allRows.filter(r=>r.id!==id);
      document.querySelector(`.cl-item[data-id="${id}"]`)?.remove();
      updateSummary();
      toast('削除しました','info');
    })
    .withFailureHandler(err=>{ btn.disabled=false; btn.innerHTML=ic('trash')+'リストから削除'; toast(err.message,'err'); })
    .deleteRowFromList(id);
}

// DEMO_OTHER修正モーダルを開く
function openDemoEditModal(id, event) {
  event.stopPropagation();
  _noYayoiTargetId = id;
  const row = allRows.find(r => r.id === id);
  // 現在の値をフォームに入れておく
  document.getElementById('noYayoiDesc').textContent =
    `送り状: ${row?.tracking_no||''} / 届け先: ${row?.dest_display||''}`;
  // デモタブで開く
  switchModal2Tab('demo', null);
  document.getElementById('demoRequester').value   = row?.staff_name  || '';
  document.getElementById('demoDescription').value = row?.items_text  || '';
  openModal('modalNoYayoi');
}

// ② NO_YAYOIモーダルを開く
let _noYayoiTargetId = null;
function openNoYayoiModal(id, event) {
  event.stopPropagation();
  _noYayoiTargetId = id;
  const row = allRows.find(r=>r.id===id);
  document.getElementById('noYayoiDesc').textContent =
    `届け先: ${row?.dest_display||''} / 送り状: ${row?.tracking_no||''}`;
  // タブ初期化
  switchModal2Tab('slip', document.querySelector('.tab2-btn'));
  // スルー候補プルダウン読込
  const sel = document.getElementById('slipSelectDD');
  sel.innerHTML = '<option value="">読み込み中…</option>';
  document.getElementById('slipPreview').style.display='none';
  const date = document.getElementById('dateSelect').value;
  google.script.run
    .withSuccessHandler(slips => {
      sel.innerHTML = '<option value="">--- 伝票番号を選択 ---</option>';
      if (!slips.length) sel.innerHTML += '<option disabled>スルー候補がありません</option>';
      slips.forEach(s => {
        const o=document.createElement('option');
        o.value=s.slip_no;
        o.textContent=`${s.slip_no} | ${s.client_name} | ${s.items_text.substring(0,30)}`;
        sel.appendChild(o);
      });
    })
    .withFailureHandler(()=>{ sel.innerHTML='<option>読み込み失敗</option>'; })
    .getUnlinkedSlips(date);
  openModal('modalNoYayoi');
}

// 伝票選択時にプレビュー表示
document.addEventListener('change', e => {
  if (e.target.id !== 'slipSelectDD') return;
  const preview = document.getElementById('slipPreview');
  const opt = e.target.options[e.target.selectedIndex];
  if (!opt.value) { preview.style.display='none'; return; }
  preview.innerHTML = `<strong>選択:</strong> ${esc(opt.textContent)}`;
  preview.style.display='block';
});

function switchModal2Tab(name, btn) {
  document.querySelectorAll('.tab2-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab2-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('modal2-'+name).classList.add('active');
  // btn が null / Event / element のいずれかに対応
  if (btn && !(btn instanceof Event)) {
    btn.classList.add('active');
  } else if (btn instanceof Event) {
    btn.target.classList.add('active');
  } else {
    // null の場合はタブボタンをname で探してアクティブに
    const tabBtn = document.querySelector(`.tab2-btn[onclick*="${name}"]`);
    if (tabBtn) tabBtn.classList.add('active');
  }
}

// Submit
function submitNoYayoi() {
  const id = _noYayoiTargetId;
  const activeTab = document.querySelector('.tab2-pane.active').id;

  const loadEl  = document.getElementById('noYayoiLoading');
  const actEl   = document.getElementById('noYayoiActions');
  const msgEl   = document.getElementById('noYayoiLoadingMsg');
  loadEl.style.display='flex'; actEl.style.display='none';

  if (activeTab === 'modal2-slip') {
    const slipNo = document.getElementById('slipSelectDD').value;
    if (!slipNo) { loadEl.style.display='none'; actEl.style.display='flex'; toast('伝票番号を選択してください','err'); return; }
    msgEl.textContent='紐付け中…';
    google.script.run
      .withSuccessHandler(res => {
        loadEl.style.display='none'; actEl.style.display='flex';
        closeModal('modalNoYayoi');
        if (!res.ok) { toast('エラー: '+res.error,'err'); return; }
        toast('伝票を紐付けました','ok');
        // ローカル更新
        const row = allRows.find(r=>r.id===id);
        if (row) {
          row.id=res.new_id; row.slip_no=slipNo.padStart?String(slipNo).padStart(8,'0'):slipNo;
          row.client_name=res.client; row.items_text=res.items; row.match_status='MANUAL_MATCHED'; row.kind='SALES';
        }
        const el = document.querySelector(`.cl-item[data-id="${id}"]`);
        if (el && row) { const n=makeItem(row); n.classList.add('open'); el.replaceWith(n); }
        updateSummary();
        loadSkipCandidates();
      })
      .withFailureHandler(err=>{loadEl.style.display='none';actEl.style.display='flex';toast(err.message,'err');})
      .linkSlipToShipRow(id, slipNo);

  } else {
    const req  = document.getElementById('demoRequester').value.trim();
    const desc = document.getElementById('demoDescription').value.trim();
    // 届け先は送り状の届け先をそのまま引き継ぐ
    const targetRow = allRows.find(r => r.id === id);
    const rec = targetRow ? (targetRow.dest_display || '') : '';
    if (!req||!desc) { loadEl.style.display='none'; actEl.style.display='flex'; toast('依頼先と内容を入力してください','err'); return; }
    msgEl.textContent='登録中…';
    google.script.run
      .withSuccessHandler(res => {
        loadEl.style.display='none'; actEl.style.display='flex';
        closeModal('modalNoYayoi');
        if (!res.ok) { toast('エラー: '+res.error,'err'); return; }
        toast('デモ機/その他として登録しました','ok');
        const row = allRows.find(r=>r.id===id);
        if (row) { row.match_status='DEMO_OTHER'; row.kind='DEMO'; row.client_name=''; row.staff_name=req; row.items_text=desc; row.qty_text='-'; }
        const el = document.querySelector(`.cl-item[data-id="${id}"]`);
        if (el && row) { const n=makeItem(row); n.classList.add('open'); el.replaceWith(n); }
        updateSummary();
      })
      .withFailureHandler(err=>{loadEl.style.display='none';actEl.style.display='flex';toast(err.message,'err');})
      .markAsDemoOrOther(id, req, rec, desc);
  }
}

// ④ 手動紐付け（チェックリスト上）
function doManualLink(id, event) {
  event.stopPropagation();
  const btn = event.currentTarget;
  const txtEl = document.getElementById('mlBtnTxt_' + id);
  const wrap = document.getElementById('mlWrap_' + id);
  const count = wrap ? (parseInt(wrap.getAttribute('data-ml-count')) || 1) : 1;
  const nos = [];
  for (let i = 0; i < count; i++) {
    const inp = document.getElementById('mlInp_' + id + '_' + i);
    if (inp && inp.value.trim()) nos.push(inp.value.trim());
  }
  const trackingNo = nos.join(',');
  if (!trackingNo) { toast('送り状番号を入力してください', 'err'); return; }

  btn.disabled = true;
  txtEl.innerHTML = '<div class="spin" style="width:14px;height:14px;border-width:2px;display:inline-block"></div>';

  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; txtEl.textContent = '紐付け実行';
      if (!res.ok) { toast('エラー: ' + res.error, 'err'); return; }
      toast(`紐付け完了 ${res.carrier ? '(' + res.carrier + ')' : ''}`, 'ok');
      // ローカルデータ更新して再描画
      const row = allRows.find(r => r.id === id);
      if (row) {
        row.tracking_no  = trackingNo;
        row.carrier      = res.carrier || row.carrier;
        row.dest_display = res.dest_name || row.dest_display;
        row.count        = res.count || row.count;
        row.cod          = res.cod || row.cod;
        row.match_status = 'MANUAL_MATCHED'; row.kind = 'SALES';
      }
      const el = document.querySelector(`.cl-item[data-id="${id}"]`);
      if (el) { const newEl = makeItem(row); newEl.classList.add('open'); el.replaceWith(newEl); }
      updateSummary();
    })
    .withFailureHandler(err => { btn.disabled=false; txtEl.textContent='紐付け実行'; toast(err.message,'err'); })
    .manualLinkTracking(id, trackingNo);
}

function handleSummaryClick(event, id) {
  if (delMode) return;
  const el = document.querySelector(`.cl-item[data-id="${id}"]`);
  if (el) el.classList.toggle('open');
}
function toggleItem(el) {
  el.classList.toggle('open');
}

// ===== スルー候補 =====
function loadSkipCandidates() {
  const date = document.getElementById('skipDateSelect').value;
  document.getElementById('skipList').innerHTML = '';
  document.getElementById('skipEmpty').style.display = 'none';
  if (!date) { document.getElementById('skipEmpty').style.display = 'block'; return; }
  setLoading('skip', true);
  google.script.run
    .withSuccessHandler(rows => {
      skipRows = rows;
      setLoading('skip', false);
      renderSkip();
      // バッジ更新
      const active = rows.filter(r => !r.excluded).length;
      const badge = document.getElementById('skipBadge');
      badge.style.display = active > 0 ? '' : 'none';
      badge.textContent = active;
    })
    .withFailureHandler(err => { setLoading('skip', false); toast(err.message, 'err'); })
    .getSkipCandidates(date);
}

function renderSkip() {
  const list = document.getElementById('skipList');
  list.innerHTML = '';
  if (!skipRows.length) { document.getElementById('skipEmpty').style.display = 'block'; return; }
  skipRows.forEach(row => list.appendChild(makeSkipItem(row)));
}

function makeSkipItem(row) {
  const wrap = document.createElement('div');
  wrap.className = 'skip-item' + (row.excluded ? ' excluded' : '');
  wrap.dataset.id = row.id;
  wrap.innerHTML = `
    <div class="skip-summary" onclick="handleSkipSummaryClick(event,this.closest('.skip-item'))">
      <input type="checkbox" class="skip-chk" onclick="event.stopPropagation()" onchange="toggleSkipSelect('${row.id}',this)" ${row.excluded?'disabled':''}>
      <div style="font-size:11px;color:var(--sub);font-family:monospace">${esc(row.slip_no)}</div>
      <div>
        <div style="font-weight:700">${esc(row.client_name)}</div>
        <div style="font-size:11px;color:var(--sub)">直送先: ${esc(row.dest_display)||'ー'}</div>
        <div style="font-size:11px;margin-top:2px">${esc(row.items_text).substring(0,60)}${row.items_text.length>60?'…':''}</div>
        ${row.excluded ? '<span style="font-size:10px;color:var(--sub);font-weight:600">除外済み</span>' : ''}
      </div>
      <div class="skip-chevron">⌄</div>
    </div>
    <div class="skip-detail">
      <div style="font-size:12px;color:var(--sub);margin-bottom:8px"><strong>担当者:</strong> ${esc(row.staff_name)||'ー'}</div>
      <div style="font-size:12px;margin-bottom:8px"><strong>商品:</strong> ${esc(row.items_text)||'ー'}</div>
      <div style="font-size:12px;margin-bottom:4px;color:var(--warn);font-weight:600">理由: ${esc(row.reason)}</div>
      ${row.excluded ? '<p style="color:var(--sub);font-size:12px">この件は除外済みです。</p>' : `
      <div class="skip-actions">
        <input type="text" class="skip-inp" id="skipInp_${row.id}" placeholder="送り状番号を入力して紐付け…">
        <button class="btn btn-warn btn-sm" onclick="resolveSkip('${row.id}','ADD_TO_LIST',event)">
          <span id="skipBtnAdd_${row.id}">${ic('clipboard')}リストに追加</span>
        </button>
        <button class="btn btn-ghost btn-sm" style="color:var(--sub);border-color:var(--sub)" onclick="resolveSkip('${row.id}','EXCLUDE',event)">
          <span id="skipBtnExc_${row.id}">${ic('x')}リストに追加しない</span>
        </button>
      </div>`}
    </div>`;
  return wrap;
}

function toggleSkip(el) {
  el.classList.toggle('open');
}
function handleSkipSummaryClick(event, el) {
  if (event.target.classList.contains('skip-chk')) return;
  toggleSkip(el);
}

function resolveSkip(id, action, event) {
  event.stopPropagation();
  const trackingNo = action === 'ADD_TO_LIST'
    ? (document.getElementById('skipInp_' + id) || {}).value?.trim() || ''
    : '';

  if (action === 'ADD_TO_LIST' && !trackingNo) {
    toast('送り状番号を入力してください', 'err'); return;
  }

  const btnId = action === 'ADD_TO_LIST' ? 'skipBtnAdd_' + id : 'skipBtnExc_' + id;
  const btnEl = document.getElementById(btnId);
  const triggerBtn = event.currentTarget;
  const origTxt = btnEl.innerHTML;
  btnEl.innerHTML = '<div class="spin" style="width:14px;height:14px;border-width:2px;display:inline-block"></div>';
  triggerBtn.disabled = true;

  google.script.run
    .withSuccessHandler(res => {
      triggerBtn.disabled = false;
      btnEl.innerHTML = origTxt;
      if (!res.ok) { toast('エラー: ' + res.error, 'err'); return; }
      if (action === 'EXCLUDE') {
        toast('除外しました', 'info');
        const row = skipRows.find(r => r.id === id);
        if (row) row.excluded = true;
        const el = document.querySelector(`.skip-item[data-id="${id}"]`);
        if (el) { const newEl = makeSkipItem(row); el.replaceWith(newEl); }
      } else {
        toast(`チェックリストに追加しました ${res.carrier ? '(' + res.carrier + ')' : ''}`, 'ok');
        skipRows = skipRows.filter(r => r.id !== id);
        renderSkip();
        // バッジ更新
        const active = skipRows.filter(r => !r.excluded).length;
        const badge = document.getElementById('skipBadge');
        badge.style.display = active > 0 ? '' : 'none';
        badge.textContent = active;
      }
    })
    .withFailureHandler(err => {
      triggerBtn.disabled = false; btnEl.innerHTML = origTxt;
      toast(err.message, 'err');
    })
    .resolveSkipCandidate(id, action, trackingNo);
}

function doCancelRow(id, event) {
  event.stopPropagation();
  if (!confirm('このレコードをキャンセルとしてマークしますか？\nキャンセル後は再インポートしてもスキップされます。')) return;
  const btn = event.currentTarget;
  const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '…';
  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; btn.innerHTML = orig;
      if (!res.ok) { toast('エラー: ' + res.error, 'err'); return; }
      const row = allRows.find(r => r.id === id);
      if (row) { row.match_status = 'CANCELLED'; row.checked = false; }
      const el = document.querySelector('.cl-item[data-id="' + id + '"]');
      if (el && row) { try { const n = makeItem(row); n.classList.add('open'); el.replaceWith(n); } catch(e) {} }
      updateSummary();
      toast('キャンセルしました', 'info');
    })
    .withFailureHandler(err => { btn.disabled = false; btn.innerHTML = orig; toast(err.message, 'err'); })
    .markAsCancelled(id);
}

// ===== スルー候補 一括操作 =====
const skipSelectedIds = new Set();

function toggleSkipSelect(id, checkbox) {
  checkbox.checked ? skipSelectedIds.add(id) : skipSelectedIds.delete(id);
  const el = document.querySelector(`.skip-item[data-id="${id}"]`);
  if (el) el.classList.toggle('skip-selected', checkbox.checked);
  updateSkipBulkBar();
}

function skipSelectAll() {
  skipRows.filter(r => !r.excluded).forEach(row => {
    skipSelectedIds.add(row.id);
    const el = document.querySelector(`.skip-item[data-id="${row.id}"]`);
    if (el) { el.classList.add('skip-selected'); const c = el.querySelector('.skip-chk'); if (c) c.checked = true; }
  });
  updateSkipBulkBar();
}

function skipDeselectAll() {
  skipSelectedIds.clear();
  document.querySelectorAll('.skip-chk').forEach(c => c.checked = false);
  document.querySelectorAll('.skip-item.skip-selected').forEach(el => el.classList.remove('skip-selected'));
  updateSkipBulkBar();
}

function updateSkipBulkBar() {
  const n = skipSelectedIds.size;
  const bar = document.getElementById('skipBulkBar');
  bar.style.display = n > 0 ? 'flex' : 'none';
  document.getElementById('skipSelCount').textContent = n;
  document.getElementById('btnSkipBulkExclude').disabled = n === 0;
}

function skipBulkExclude() {
  if (!confirm(`選択した ${skipSelectedIds.size} 件をリストに追加しないとして除外しますか？`)) return;
  const ids = Array.from(skipSelectedIds);
  const btn = document.getElementById('btnSkipBulkExclude');
  btn.disabled = true; btn.textContent = '処理中…';
  google.script.run
    .withSuccessHandler(res => {
      btn.innerHTML = ic('x') + '選択をリストに追加しない';
      if (!res.ok) { toast('エラー: ' + res.error, 'err'); btn.disabled = false; return; }
      toast(`${res.count}件を除外しました`, 'info');
      ids.forEach(id => {
        const row = skipRows.find(r => r.id === id);
        if (row) row.excluded = true;
      });
      skipSelectedIds.clear();
      renderSkip();
      updateSkipBulkBar();
      const active = skipRows.filter(r => !r.excluded).length;
      const badge = document.getElementById('skipBadge');
      badge.style.display = active > 0 ? '' : 'none';
      badge.textContent = active;
    })
    .withFailureHandler(err => { btn.disabled = false; btn.innerHTML = ic('x') + '選択をリストに追加しない'; toast(err.message, 'err'); })
    .bulkExcludeSkip(ids);
}

// ===== チェック操作 =====
function doCheck(id, checked, event) {
  event.stopPropagation();
  const row = allRows.find(r => r.id === id);
  if (!row) return;

  // 同梱あり・完了操作のとき → 同じ送り状番号の未完了行を確認
  if (checked && row.bundled && row.tracking_no) {
    const siblings = allRows.filter(r =>
      r.id !== id &&
      r.tracking_no === row.tracking_no &&
      !r.checked
    );
    if (siblings.length > 0) {
      _bundledTargetId  = id;
      _bundledSiblings  = siblings;
      _bundledBtn       = event.currentTarget;
      _bundledBtnOrig   = event.currentTarget.innerHTML;
      showBundledModal(row, siblings);
      return;
    }
  }

  execDoCheck(id, checked, event.currentTarget, event.currentTarget.innerHTML);
}

// 同梱モーダル用の状態
let _bundledTargetId = null, _bundledSiblings = [], _bundledBtn = null, _bundledBtnOrig = '';

function showBundledModal(row, siblings) {
  const list = document.getElementById('bundledList');
  list.innerHTML = '';

  // 自分の行
  const selfEl = document.createElement('div');
  selfEl.style.cssText = 'padding:8px 10px;background:#f0fff4;border-radius:6px;font-size:12px;border-left:3px solid var(--success)';
  selfEl.innerHTML = `<strong>${esc(row.dest_display)}</strong> <span style="color:var(--sub)">${esc(row.slip_no)}</span>`;
  list.appendChild(selfEl);

  // 同梱の兄弟行
  siblings.forEach(s => {
    const el = document.createElement('div');
    el.style.cssText = 'padding:8px 10px;background:#fafbfc;border-radius:6px;font-size:12px;border-left:3px solid var(--warn)';
    el.innerHTML = `<strong>${esc(s.dest_display)}</strong> <span style="color:var(--sub)">${esc(s.slip_no)}</span> <span style="color:var(--warn);font-size:11px">未完了</span>`;
    list.appendChild(el);
  });

  document.getElementById('bundledLoading').style.display = 'none';
  document.getElementById('bundledActions').style.display = 'flex';
  openModal('modalBundled');
}

function cancelBundledModal() {
  // ×ボタン：完了処理せずモーダルを閉じる
  closeModal('modalBundled');
  // ボタンの状態を元に戻す
  if (_bundledBtn) { _bundledBtn.disabled = false; _bundledBtn.innerHTML = _bundledBtnOrig; }
  _bundledTargetId = null; _bundledSiblings = []; _bundledBtn = null; _bundledBtnOrig = '';
}

function closeBundledModal(withSiblings) {
  closeModal('modalBundled');
  const loadEl = document.getElementById('bundledLoading');
  const actEl  = document.getElementById('bundledActions');

  // ローディング表示
  loadEl.style.display = 'flex'; actEl.style.display = 'none';
  if (_bundledBtn) { _bundledBtn.disabled = true; _bundledBtn.innerHTML = '<div class="spin" style="width:16px;height:16px;border-width:2px"></div>'; }

  const idsToComplete = withSiblings
    ? [_bundledTargetId, ..._bundledSiblings.map(s => s.id)]
    : [_bundledTargetId];

  // 順次完了処理
  let done = 0;
  let lastChecker = '';
  idsToComplete.forEach(id => {
    google.script.run
      .withSuccessHandler(res => {
        done++;
        if (res.ok) {
          const row = allRows.find(r => r.id === id);
          if (row) {
            row.checked = true;
            if (res.checker) { row.checker = res.checker; lastChecker = res.checker; }
            const el = document.querySelector(`.cl-item[data-id="${id}"]`);
            if (el) {
              try { const newEl = makeItem(row); el.replaceWith(newEl); } catch(e) {}
            }
          }
        }
        if (done === idsToComplete.length) {
          loadEl.style.display = 'none'; actEl.style.display = 'flex';
          if (_bundledBtn) { _bundledBtn.disabled = false; _bundledBtn.innerHTML = _bundledBtnOrig; }
          updateSummary();
          const who = lastChecker ? ` (${lastChecker})` : '';
          toast(withSiblings ? `${idsToComplete.length}件まとめて完了${who}` : `完了${who}`, 'ok');
          _bundledTargetId = null; _bundledSiblings = []; _bundledBtn = null;
        }
      })
      .withFailureHandler(err => {
        done++;
        if (done === idsToComplete.length) {
          loadEl.style.display = 'none'; actEl.style.display = 'flex';
          if (_bundledBtn) { _bundledBtn.disabled = false; _bundledBtn.innerHTML = _bundledBtnOrig; }
          toast('一部の完了に失敗しました: ' + err.message, 'err');
        }
      })
      .updateCheckStatus(id, true, '');
  });
}

function execDoCheck(id, checked, btn, origHTML) {
  btn.disabled = true;
  btn.innerHTML = '<div class="spin" style="width:16px;height:16px;border-width:2px"></div>';
  google.script.run
    .withSuccessHandler(res => {
      btn.disabled=false; btn.innerHTML=origHTML;
      if (!res.ok) { toast('更新失敗: '+res.error,'err'); return; }
      // スプシのチェック状態を取得して画面に差分反映
      refreshCheckStatus();
      const who = res.checker ? ` (${res.checker})` : '';
      toast(checked ? `完了${who}` : '取り消しました', checked ? 'ok' : 'info');
    })
    .withFailureHandler(err => { btn.disabled=false; btn.innerHTML=origHTML; toast(err.message,'err'); })
    .updateCheckStatus(id, checked, '');
}

// チェック状態のみをスプシから取得してallRowsに反映（リストは消さない）
function refreshCheckStatus() {
  const date = document.getElementById('dateSelect').value;
  const btn = document.getElementById('btnRefresh');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spin" style="width:14px;height:14px;border-width:2px;display:inline-block"></div>'; }
  google.script.run
    .withSuccessHandler(statusMap => {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
      if (!statusMap || typeof statusMap !== 'object') return;
      let changed = false;
      allRows.forEach(row => {
        const s = statusMap[row.id];
        if (!s) return;
        if (row.checked !== s.checked || row.checker !== s.checker) {
          row.checked    = s.checked;
          row.checker    = s.checker;
          row.checked_at = s.checked_at;
          const el = document.querySelector(`.cl-item[data-id="${row.id}"]`);
          if (el) {
            try {
              const wasOpen = el.classList.contains('open');
              const newEl = makeItem(row);
              if (wasOpen) newEl.classList.add('open');
              el.replaceWith(newEl);
            } catch(e) {}
          }
          changed = true;
        }
      });
      if (changed) updateSummary();
    })
    .withFailureHandler(() => { if (btn) { btn.disabled = false; btn.innerHTML = orig; } })
    .getCheckStatus(date);
}

// ===== サマリ =====
function updateSummary() {
  // 口数ベースで集計（同梱は送り状番号で重複排除）
  const activeRows = allRows.filter(r=>r.match_status!=='CANCELLED');
  const allBoxMap = {};
  activeRows.forEach(r=>{ if(r.tracking_no&&!(r.tracking_no in allBoxMap)) allBoxMap[r.tracking_no]=Number(r.count)||0; });
  // 持参/引取は総口数・完了口数に含めない（ヤマト＋佐川の実口数のみ）
  const noTrackingCount = activeRows.filter(r=>!r.tracking_no&&r.match_status!=='JISSHA').length;
  const total = Object.values(allBoxMap).reduce((s,v)=>s+v,0) + noTrackingCount;

  const doneRows = allRows.filter(r=>r.checked&&r.match_status!=='CANCELLED');
  const doneBoxMap = {};
  doneRows.forEach(r=>{ if(r.tracking_no&&!(r.tracking_no in doneBoxMap)) doneBoxMap[r.tracking_no]=Number(r.count)||0; });
  const doneNoTrackingCount = doneRows.filter(r=>!r.tracking_no&&r.match_status!=='JISSHA').length;
  const done = Object.values(doneBoxMap).reduce((s,v)=>s+v,0) + doneNoTrackingCount;
  // 持参/引取は口数に含まないが、完了ボタンは全件チェック済みが条件
  const uncheckedJissha = activeRows.filter(r=>r.match_status==='JISSHA'&&!r.checked).length;
  const sales   = allRows.filter(r=>r.kind==='SALES').length;
  const catalog = 0; // カタログはデモ機/その他に統合
  const demo    = allRows.filter(r=>['DEMO','CATALOG','OTHER'].includes(r.kind)||r.match_status==='DEMO_OTHER').length;
  const warn    = allRows.filter(r=>['TRACKING_NOT_FOUND','NO_SHIP','NO_YAYOI','UNMATCHED'].includes(r.match_status)).length;
  document.getElementById('sTotal').textContent   = total;
  document.getElementById('sDone').textContent    = done;
  document.getElementById('sSales').textContent   = sales;
  // sCatalog削除済み
  document.getElementById('sDemo').textContent    = demo;
  document.getElementById('sWarn').textContent    = warn;
  document.getElementById('progText').textContent = `${done} / ${total}`;
  document.getElementById('progFill').style.width = total>0?(done/total*100)+'%':'0%';
  document.getElementById('btnComplete').disabled = (done<total||total===0||allRows.filter(r=>r.match_status!=='CANCELLED').length===0||uncheckedJissha>0);

  // ヤマト/佐川 件数（伝票数）・口数（送り状の実個口数、同梱は重複排除）
  const yamatoRows = allRows.filter(r=>r.carrier==='ヤマト'&&r.match_status!=='CANCELLED');
  const sagawaRows = allRows.filter(r=>r.carrier==='佐川'&&r.match_status!=='CANCELLED');
  const yBoxMap={}, sBoxMap={};
  yamatoRows.forEach(r=>{ if(r.tracking_no&&!(r.tracking_no in yBoxMap)) yBoxMap[r.tracking_no]=Number(r.count)||0; });
  sagawaRows.forEach(r=>{ if(r.tracking_no&&!(r.tracking_no in sBoxMap)) sBoxMap[r.tracking_no]=Number(r.count)||0; });
  document.getElementById('sYamatoCount').textContent = yamatoRows.length;
  document.getElementById('sYamatoBox').textContent   = Object.values(yBoxMap).reduce((s,v)=>s+v,0);
  document.getElementById('sSagawaCount').textContent = sagawaRows.length;
  document.getElementById('sSagawaBox').textContent   = Object.values(sBoxMap).reduce((s,v)=>s+v,0);
}

// ===== フィルタ =====
function filteredRows() {
  return allRows.filter(r => {
    if (currentFilter==='SALES')   return r.kind==='SALES'&&r.match_status!=='JISSHA';
    if (currentFilter==='DEMO')    return ['DEMO','CATALOG','OTHER'].includes(r.kind)||r.match_status==='DEMO_OTHER';
    if (currentFilter==='JISSHA') return r.match_status==='JISSHA';
    if (currentFilter==='WARN')   return ['TRACKING_NOT_FOUND','NO_SHIP','NO_YAYOI','UNMATCHED'].includes(r.match_status);
    if (currentFilter==='UNDONE') return !r.checked;
    return true;
  });
}
function setFilter(f,btn) {
  currentFilter=f;
  document.querySelectorAll('.fil').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');

  render();
}

// ===== 削除モード =====
function toggleDelMode() { delMode ? exitDelMode() : enterDelMode(); }
function enterDelMode() {
  delMode=true; selectedIds.clear();
  document.body.classList.add('del-mode');
  document.getElementById('delBar').classList.add('show');
  document.getElementById('filterBar').style.display='none';
  document.getElementById('btnDelMode').innerHTML=ic('x')+'削除モード終了';
  // btnPrintが常に右端、削除モードボタンはその左に自然に並ぶ
  document.querySelectorAll('.cl-item.open').forEach(i=>i.classList.remove('open'));
  updateDelBar();
}
function exitDelMode() {
  delMode=false; selectedIds.clear();
  document.body.classList.remove('del-mode');
  document.getElementById('delBar').classList.remove('show');
  document.getElementById('filterBar').style.display='';
  document.getElementById('btnDelMode').innerHTML=ic('trash')+'削除モード';
  // btnPrintは常にmargin-left:autoで右端固定
  document.querySelectorAll('.del-chk').forEach(c=>c.checked=false);
  document.querySelectorAll('.cl-item.del-selected').forEach(el=>el.classList.remove('del-selected'));
  updateDelBar();
}
function toggleSelect(id,checkbox) {
  checkbox.checked ? selectedIds.add(id) : selectedIds.delete(id);
  document.querySelector(`.cl-item[data-id="${id}"]`)?.classList.toggle('del-selected', checkbox.checked);
  updateDelBar();
}
function selectAllVisible() {
  filteredRows().forEach(row => {
    selectedIds.add(row.id);
    const el = document.querySelector(`.cl-item[data-id="${row.id}"]`);
    if (el) { el.classList.add('del-selected'); const c=el.querySelector('.del-chk'); if(c) c.checked=true; }
  });
  updateDelBar();
}
function deselectAll() {
  selectedIds.clear();
  document.querySelectorAll('.del-chk').forEach(c=>c.checked=false);
  document.querySelectorAll('.cl-item.del-selected').forEach(el=>el.classList.remove('del-selected'));
  updateDelBar();
}
function updateDelBar() {
  const n=selectedIds.size;
  document.getElementById('delCount').textContent=n;
  document.getElementById('btnDelExec').disabled=n===0;
}
function confirmDeleteSelected() {
  document.getElementById('delSelDesc').textContent=`選択した ${selectedIds.size} 件を削除します。この操作は元に戻せません。`;
  document.getElementById('inpAdminSel').value='';
  openModal('modalDeleteSelected');
}
function execDeleteSelected() {
  const email=document.getElementById('inpAdminSel').value.trim();
  if (!email) { alert('管理者メールアドレスを入力してください'); return; }
  const ids=Array.from(selectedIds);
  document.getElementById('delLoading').style.display='flex';
  document.getElementById('delModalActions').style.display='none';
  google.script.run
    .withSuccessHandler(res => {
      document.getElementById('delLoading').style.display='none';
      document.getElementById('delModalActions').style.display='flex';
      closeModal('modalDeleteSelected');
      if (!res.ok) { toast('エラー: '+res.error,'err'); return; }
      toast(`${res.deleted}件削除しました`,'ok');
      allRows=allRows.filter(r=>!ids.includes(r.id));
      exitDelMode(); render();
    })
    .withFailureHandler(err => {
      document.getElementById('delLoading').style.display='none';
      document.getElementById('delModalActions').style.display='flex';
      toast(err.message,'err');
    })
    .deleteByIds(ids, email);
}

// ===== インポート =====
function _hasBrokenTracking(csvText, colIndex) {
  var lines = csvText.split('\n');
  for (var i = 1; i < Math.min(lines.length, 500); i++) {
    var cols = lines[i].split(',');
    if (cols.length <= colIndex) continue;
    var v = cols[colIndex].replace(/"/g, '').trim();
    if (!v) continue;
    // 科学的記数法 (4.91E+11 等)
    if (v.indexOf('E') !== -1 || v.indexOf('e') !== -1) return true;
    // 小数点を含む数値 (491841493.0 等)
    if (v.indexOf('.') !== -1) {
      var noDot = v.replace(/\./g, '').replace(/-/g, '');
      if (/^[0-9]+$/.test(noDot)) return true;
    }
    // 末尾3桁000の単独判定は誤検知リスクがあるため使わない
    // （正規の送り状番号でも1/1000程度の確率で発生し得る）
  }
  return false;
}


function doImport() {
  const missing = [];
  if (!files.yayoi)  missing.push('① 弥生販売 xlsx');
  if (!files.yamato) missing.push('② ヤマト CSV');
  if (!files.sagawa) missing.push('③ 佐川 CSV');
  if (missing.length > 0) {
    toast('次のファイルが選択されていません：' + missing.join(' / '), 'err');
    return;
  }
  setLoading('import', true, 'CSVチェック中…');
  var toB64 = function(f) { return new Promise(function(res,rej){var r=new FileReader();r.onload=function(e){res(e.target.result.split(',')[1]);};r.onerror=rej;r.readAsDataURL(f);}); };
  var toText = function(f,enc) { return new Promise(function(res,rej){if(!f){res('');return;}var r=new FileReader();r.onload=function(e){res(e.target.result);};r.onerror=rej;r.readAsText(f,enc);}); };
  Promise.all([files.yayoi ? toB64(files.yayoi) : Promise.resolve(''), toText(files.yamato,'Shift_JIS'), toText(files.sagawa,'UTF-8')])
    .then(function(results) {
      var b64=results[0], yt=results[1], st=results[2];
      if (files.yamato && yt && _hasBrokenTracking(yt, 3)) {
        setLoading('import', false);
        toast('ヤマトCSVの送り状番号が破損しています。Excelで開かずメモ帳で開き直してください。', 'err');
        return;
      }
      if (files.sagawa && st && _hasBrokenTracking(st, 0)) {
        setLoading('import', false);
        toast('佐川CSVの送り状番号が破損しています。Excelで開かずメモ帳で開き直してください。', 'err');
        return;
      }
      setLoading('import', true, 'サーバーで突合処理中…');
      google.script.run
        .withSuccessHandler(function(res){
          setLoading('import', false);
          if (!res.ok) { toast('エラー: '+res.error,'err'); return; }
          var msg = ic('checkcircle')+'インポート完了<br>弥生: '+res.yayoi_count+'件 ／ ヤマト: '+res.yamato_count+'件 ／ 佐川: '+res.sagawa_count+'件<br>新規追加: <strong>'+res.added+'件</strong>　スキップ: '+res.skipped+'件';
          if (res.updated > 0) msg += '<br><span style="color:var(--warn)">'+ic('warn')+'内容更新・完了取消: <strong>'+res.updated+'件</strong></span>';
          if (res.skip_added > 0) msg += '<br>'+ic('warn')+'スルー候補: <strong>'+res.skip_added+'件</strong>（スルー候補タブで処理してください）';
          if (res.skip_purged > 0) msg += '<br><span style="color:#48bb78">'+ic('check')+'スルー候補から突合済み削除: <strong>'+res.skip_purged+'件</strong></span>';
          if (res.noyayoi_deleted > 0) msg += '<br><span style="color:var(--sub)">'+ic('trash')+'弥生伝票なし（未処理）自動削除: <strong>'+res.noyayoi_deleted+'件</strong></span>';
          document.getElementById('importResult').innerHTML = msg;
          document.getElementById('importResult').style.display = 'block';
          toast('インポート完了', 'ok');
          loadDateList();
          if (res.updated > 0) loadChecklist();
        })
        .withFailureHandler(function(err){ setLoading('import',false); toast(err.message,'err'); })
        .processImport(b64, files.yayoi ? files.yayoi.name : '', yt, st);
    });
}

// ===== 本日完了ボタン押下時サーバー側二重チェック =====
function checkBeforeComplete() {
  const date = document.getElementById('dateSelect').value;
  if (!date) return;
  const btn = document.getElementById('btnComplete');
  btn.disabled = true;
  google.script.run
    .withSuccessHandler(function(result) {
      btn.disabled = false;
      if (result && result.incomplete) {
        openModal('modalIncompleteWarn');
      } else {
        openModal('modalCompletion');
      }
    })
    .withFailureHandler(function(err) {
      btn.disabled = false;
      toast('確認に失敗しました: ' + err.message, 'err');
    })
    .hasTodayIncomplete(date);
}

// ===== 完了メール =====
function sendCompletion() {
  const checker=document.getElementById('inpChecker').value.trim();
  if (!checker) { alert('完了者名を入力してください'); return; }
  const date=document.getElementById('dateSelect').value;
  const sum={
    total:allRows.length, sales:allRows.filter(r=>r.kind==='SALES').length,
    catalog:allRows.filter(r=>r.kind==='CATALOG').length, demo:allRows.filter(r=>r.kind==='DEMO').length,
    jissha:allRows.filter(r=>r.match_status==='JISSHA').length,
    unmatched:allRows.filter(r=>['TRACKING_NOT_FOUND','NO_SHIP','NO_YAYOI','UNMATCHED'].includes(r.match_status)).length,
    yamato:allRows.filter(r=>r.carrier==='ヤマト').length,
    sagawa:allRows.filter(r=>r.carrier==='佐川').length,
    yamatoBox:(function(){var m={};allRows.filter(r=>r.carrier==='ヤマト'&&r.tracking_no).forEach(r=>{if(!(r.tracking_no in m))m[r.tracking_no]=Number(r.count)||0;});return Object.values(m).reduce((s,v)=>s+v,0);})(),
    sagawaBox:(function(){var m={};allRows.filter(r=>r.carrier==='佐川'&&r.tracking_no).forEach(r=>{if(!(r.tracking_no in m))m[r.tracking_no]=Number(r.count)||0;});return Object.values(m).reduce((s,v)=>s+v,0);})(),
  };
  document.getElementById('completionLoading').style.display='flex';
  document.getElementById('completionActions').style.display='none';
  google.script.run
    .withSuccessHandler(()=>{ document.getElementById('completionLoading').style.display='none'; document.getElementById('completionActions').style.display='flex'; closeModal('modalCompletion'); toast('完了メールを送信しました','ok'); })
    .withFailureHandler(err=>{ document.getElementById('completionLoading').style.display='none'; document.getElementById('completionActions').style.display='flex'; toast('送信失敗: '+err.message,'err'); })
    .sendCompletionEmail(date, checker, sum);
}

// ===== ファイル =====
function resetImport() {
  ['yayoi','yamato','sagawa'].forEach(type => {
    files[type] = null;
    document.getElementById('fn'+cap(type)).textContent = '';
    const zone = document.getElementById('f'+cap(type)).closest('.file-zone');
    if (zone) zone.style.borderColor = '';
    // ファイル入力をリセット
    const input = document.getElementById('f'+cap(type));
    if (input) input.value = '';
  });
  document.getElementById('importResult').style.display = 'none';
  document.getElementById('importResult').innerHTML = '';
  fileWarnings.yamato = false; fileWarnings.sagawa = false;
  toast('リセットしました', 'info');
}

function onFile(input,type) {
  const f=input.files[0]; if(!f)return;
  files[type]=f;
  if ((type==='yamato'||type==='sagawa') && f.name.toLowerCase().endsWith('.csv')) {
    const reader=new FileReader();
    reader.onload=function(e){
      const lines=e.target.result.split('\n').slice(1,20);
      const bad=lines.filter(function(l){ return /"\d{9,}000"[,\r\n"]/.test(l); }).length;
      const fnEl=document.getElementById('fn'+cap(type));
      if(bad>=2){
        fileWarnings[type]=true;
        fnEl.innerHTML=ic('warn')+esc(f.name)+'<br><span style="color:var(--danger);font-size:11px">送り状番号末尾が000になっています。Excelで開いて保存した可能性があります。メモ帳等で開き直してください。</span>';
        input.closest('.file-zone').style.borderColor='var(--danger)';
      } else {
        fileWarnings[type]=false;
        fnEl.innerHTML=ic('check')+esc(f.name);
        input.closest('.file-zone').style.borderColor='var(--success)';
      }
    };
    reader.readAsText(f,type==='yamato'?'Shift_JIS':'UTF-8');
    return;
  }
  document.getElementById('fn'+cap(type)).innerHTML=ic('check')+esc(f.name);
  input.closest('.file-zone').style.borderColor='var(--success)';
}
function onDrop(e,type) {
  e.preventDefault(); e.currentTarget.classList.remove('drag');
  const f=e.dataTransfer.files[0]; if(!f)return;
  files[type]=f;
  const dt=new DataTransfer(); dt.items.add(f);
  const inp=document.getElementById('f'+cap(type));
  inp.files=dt.files;
  onFile(inp,type);
}
function cap(s) { return s.charAt(0).toUpperCase()+s.slice(1); }

// ===== ユーティリティ =====
function switchTab(name,btn) {
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active'); btn.classList.add('active');
  if (name==='skip') { document.getElementById('skipDateSelect').value=document.getElementById('dateSelect').value; loadSkipCandidates(); }
}
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function setLoading(target,show,msg) {
  if (target==='list')  { document.getElementById('listLoading').classList.toggle('show',show); }
  else if (target==='skip') { document.getElementById('skipLoading').classList.toggle('show',show); }
  else { document.getElementById('importLoading').classList.toggle('show',show); document.getElementById('btnImport').disabled=show; if(msg) document.getElementById('importMsg').textContent=msg; }
}
function toast(msg,type='info') {
  const w=document.getElementById('toastWrap');
  const el=document.createElement('div'); el.className=`toast toast-${type}`; el.textContent=msg;
  w.appendChild(el); setTimeout(()=>el.remove(),3500);
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const YAMATO_SLIP_LABELS = {'0':'発払い','2':'コレクト','3':'ゆうメール','4':'タイム','5':'着払い','6':'発払い(複数口)','7':'ゆうパケット','8':'コンパクト','9':'コンパクトコレクト','A':'ネコポス'};
function slipTypeLabel(carrier, slipType) {
  if (!slipType) return '';
  if (carrier === 'ヤマト') return YAMATO_SLIP_LABELS[String(slipType)] || slipType;
  return String(slipType);
}
function carrierClass(c) { return c==='ヤマト'?'carrier-y':c==='佐川'?'carrier-s':'carrier-j'; }
function warnClass(row) {
  if (row.match_status==='NO_YAYOI'||row.match_status==='TRACKING_NOT_FOUND') return ' alert';
  if (['NO_SHIP','UNMATCHED'].includes(row.match_status)) return ' warn';
  return '';
}
function kindBadge(k) {
  const m={SALES:['弥生','tag-sales'],CATALOG:['その他','tag-other'],DEMO:['デモ機/その他','tag-demo']};
  const [lbl,cls]=m[k]||['その他','tag-other'];
  return `<span class="tag ${cls}">${lbl}</span>`;
}
function statusBadge(s) {
  const m={
    MATCHED:          ['突合OK','st-ok','check'],
    MANUAL_MATCHED:   ['手動紐付け','st-manual','link'],
    JISSHA:           ['持参/引取','st-jissha','hand'],
    NO_SHIP:          ['発送データなし','st-noship','warn'],
    NO_YAYOI:         ['弥生伝票なし','st-noyayoi','question'],
    TRACKING_NOT_FOUND:['送り状番号未発見','st-notfound','exclaim'],
    DEMO_OTHER:       ['デモ機/その他','st-manual','wrench'],
    CANCELLED:        ['キャンセル','st-unmatched','ban'],
  };
  const [lbl,cls,icn]=m[s]||['要確認','st-unmatched','warn'];
  return `<span class="stbadge ${cls}">${ic(icn)}${lbl}</span>`;
}

// ===== 起動入口（auth.js がログイン成功後に呼ぶ） =====
function boot() {
  var l = document.getElementById('loading'); if (l) l.style.display = 'none';
  var a = document.getElementById('app');     if (a) a.style.display = '';
  if (window.__deliverInited) return;   // トークン自動更新等での多重初期化を防止
  window.__deliverInited = true;
  hydrateIcons();   // 静的HTML(index.html)の data-ic 属性にSVGを流し込む
  __initApp();   // 旧 DOMContentLoaded 初期化（日付一覧・権限取得・描画）
}
