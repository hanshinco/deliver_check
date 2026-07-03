/* 出荷チェック アプリ本体（GitHub Pages SPA）。
 * 現行 _legacy/Index.html の <script> を移植。google.script.run は auth.js のシムが fetch に橋渡しするため無改変。
 * 初期化: 旧 DOMContentLoaded ハンドラを __initApp() 化し、ログイン成功後に auth.js が呼ぶ boot() から起動する。
 */

// auth.js が失敗時に任意参照（未定義でも動くが no-op を用意）。
function busyOff() {}

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
        document.getElementById('hdrEmail').textContent = '👤 ' + status.email;
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
    list.innerHTML = '<div class="empty"><div class="icon">🔍</div><div>条件に一致する件数がありません</div></div>';
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
      <button class="btn-jissha" onclick="doMarkJissha('${row.id}',event)">🏃 持参 / 引取に変更</button>
      <button class="btn-del-row" onclick="doDeleteRow('${row.id}',event)">🗑️ リストから削除</button>
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
        <div style="font-size:11px;color:var(--sub);margin-top:2px">${kindBadge(row.kind)} ${statusBadge(row.match_status)}${row.bundled ? ' <span class="tag" style="background:#e9d8fd;color:#553c9a">同梱あり</span>' : ''}${row.checked && row.checker ? ' <span class="tag" style="background:#c6f6d5;color:#276749">✅ ' + esc(row.checker.includes('@') ? row.checker.split('@')[0] : row.checker) + '</span>' : ''}</div>
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
        <label>${['MATCHED','MANUAL_MATCHED'].includes(row.match_status) ? '🔗 送り状番号を修正' : '送り状番号を手動入力'}</label>
        <div id="mlInputsDiv_${row.id}" style="display:flex;flex-direction:column;gap:4px;flex:1">${_mlInputsHtml}</div>
        <button class="btn btn-warn btn-sm" onclick="doManualLink('${row.id}',event)" style="align-self:flex-start">
          <span id="mlBtnTxt_${row.id}">${row.match_status === 'MANUAL_MATCHED' ? '修正する' : '紐付け実行'}</span>
        </button>
      </div>` : ''}
      ${isNoYayoi && gIsAdmin ? `
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="openNoYayoiModal('${row.id}',event)">📋 弥生伝票を紐付け / デモ機・その他</button>
      </div>` : ''}
      ${row.match_status === 'DEMO_OTHER' ? `
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-warn btn-sm" onclick="openDemoEditModal('${row.id}',event)">✏️ デモ機 / その他を修正</button>
      </div>` : ''}
      <div class="cl-actions" style="margin-top:10px">
        ${gIsViewOnly ? '' : row.match_status === 'CANCELLED' ? `<span style="color:var(--sub);font-size:12px">🚫 キャンセル済み</span>` : row.checked
          ? `<button class="btn btn-ghost btn-sm" onclick="doCheck('${row.id}',false,event)">↩ 完了を取り消す</button>`
          : `<button class="btn btn-success btn-lg" onclick="doCheck('${row.id}',true,event)">✅ この件を完了にする</button>`}
        ${row.match_status !== 'CANCELLED' && gIsAdmin ? `<button class="btn btn-ghost btn-sm" style="color:var(--sub);border-color:var(--sub);margin-left:auto" onclick="doCancelRow('${row.id}',event)">🚫 キャンセル</button>` : ''}
      </div>
    </div>`;
  return wrap;
}

// ① 持参/引取に変更
function doMarkJissha(id, event) {
  event.stopPropagation();
  const btn = event.currentTarget;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; btn.textContent = orig;
      if (!res.ok) { toast('エラー: '+res.error,'err'); return; }
      const row = allRows.find(r=>r.id===id);
      if (row) { row.match_status='JISSHA'; row.carrier='持参/引取'; row.tracking_no=''; row.count=0; }
      const el = document.querySelector(`.cl-item[data-id="${id}"]`);
      if (el) { const n=makeItem(row); n.classList.add('open'); el.replaceWith(n); }
      updateSummary();
      toast('持参/引取に変更しました','ok');
    })
    .withFailureHandler(err=>{ btn.disabled=false; btn.textContent=orig; toast(err.message,'err'); })
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
      if (!res.ok) { btn.disabled=false; btn.textContent='🗑️ リストから削除'; toast('エラー: '+res.error,'err'); return; }
      allRows = allRows.filter(r=>r.id!==id);
      document.querySelector(`.cl-item[data-id="${id}"]`)?.remove();
      updateSummary();
      toast('削除しました','info');
    })
    .withFailureHandler(err=>{ btn.disabled=false; btn.textContent='🗑️ リストから削除'; toast(err.message,'err'); })
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
        toast('✅ 伝票を紐付けました','ok');
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
        toast('✅ デモ機/その他として登録しました','ok');
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
      toast(`✅ 紐付け完了 ${res.carrier ? '(' + res.carrier + ')' : ''}`, 'ok');
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
          <span id="skipBtnAdd_${row.id}">📋 リストに追加</span>
        </button>
        <button class="btn btn-ghost btn-sm" style="color:var(--sub);border-color:var(--sub)" onclick="resolveSkip('${row.id}','EXCLUDE',event)">
          <span id="skipBtnExc_${row.id}">✕ リストに追加しない</span>
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
  const origTxt = btnEl.textContent;
  btnEl.innerHTML = '<div class="spin" style="width:14px;height:14px;border-width:2px;display:inline-block"></div>';
  triggerBtn.disabled = true;

  google.script.run
    .withSuccessHandler(res => {
      triggerBtn.disabled = false;
      btnEl.textContent = origTxt;
      if (!res.ok) { toast('エラー: ' + res.error, 'err'); return; }
      if (action === 'EXCLUDE') {
        toast('除外しました', 'info');
        const row = skipRows.find(r => r.id === id);
        if (row) row.excluded = true;
        const el = document.querySelector(`.skip-item[data-id="${id}"]`);
        if (el) { const newEl = makeSkipItem(row); el.replaceWith(newEl); }
      } else {
        toast(`✅ チェックリストに追加しました ${res.carrier ? '(' + res.carrier + ')' : ''}`, 'ok');
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
      triggerBtn.disabled = false; btnEl.textContent = origTxt;
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
      toast('🚫 キャンセルしました', 'info');
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
      btn.textContent = '✕ 選択をリストに追加しない';
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
    .withFailureHandler(err => { btn.disabled = false; btn.textContent = '✕ 選択をリストに追加しない'; toast(err.message, 'err'); })
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
          toast(withSiblings ? `✅ ${idsToComplete.length}件まとめて完了${who}` : `✅ 完了${who}`, 'ok');
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
      toast(checked ? `✅ 完了${who}` : '↩ 取り消しました', checked ? 'ok' : 'info');
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
  document.getElementById('btnDelMode').textContent='✕ 削除モード終了';
  // btnPrintが常に右端、削除モードボタンはその左に自然に並ぶ
  document.querySelectorAll('.cl-item.open').forEach(i=>i.classList.remove('open'));
  updateDelBar();
}
function exitDelMode() {
  delMode=false; selectedIds.clear();
  document.body.classList.remove('del-mode');
  document.getElementById('delBar').classList.remove('show');
  document.getElementById('filterBar').style.display='';
  document.getElementById('btnDelMode').textContent='🗑️ 削除モード';
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
          var msg = '✅ インポート完了<br>弥生: '+res.yayoi_count+'件 ／ ヤマト: '+res.yamato_count+'件 ／ 佐川: '+res.sagawa_count+'件<br>新規追加: <strong>'+res.added+'件</strong>　スキップ: '+res.skipped+'件';
          if (res.updated > 0) msg += '<br><span style="color:var(--warn)">⚠️ 内容更新・完了取消: <strong>'+res.updated+'件</strong></span>';
          if (res.skip_added > 0) msg += '<br>⚠️ スルー候補: <strong>'+res.skip_added+'件</strong>（スルー候補タブで処理してください）';
          if (res.skip_purged > 0) msg += '<br><span style="color:#48bb78">✅ スルー候補から突合済み削除: <strong>'+res.skip_purged+'件</strong></span>';
          if (res.noyayoi_deleted > 0) msg += '<br><span style="color:var(--sub)">🗑️ 弥生伝票なし（未処理）自動削除: <strong>'+res.noyayoi_deleted+'件</strong></span>';
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
        fnEl.innerHTML='⚠️ '+f.name+'<br><span style="color:var(--danger);font-size:11px">送り状番号末尾が000になっています。Excelで開いて保存した可能性があります。メモ帳等で開き直してください。</span>';
        input.closest('.file-zone').style.borderColor='var(--danger)';
      } else {
        fileWarnings[type]=false;
        fnEl.textContent='✓ '+f.name;
        input.closest('.file-zone').style.borderColor='var(--success)';
      }
    };
    reader.readAsText(f,type==='yamato'?'Shift_JIS':'UTF-8');
    return;
  }
  document.getElementById('fn'+cap(type)).textContent='✓ '+f.name;
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
    MATCHED:          ['✓ 突合OK','st-ok'],
    MANUAL_MATCHED:   ['🔗 手動紐付け','st-manual'],
    JISSHA:           ['🏃 持参/引取','st-jissha'],
    NO_SHIP:          ['⚠️ 発送データなし','st-noship'],
    NO_YAYOI:         ['❓ 弥生伝票なし','st-noyayoi'],
    TRACKING_NOT_FOUND:['❗ 送り状番号未発見','st-notfound'],
    DEMO_OTHER:       ['🔧 デモ機/その他','st-manual'],
    CANCELLED:        ['🚫 キャンセル','st-unmatched'],
  };
  const [lbl,cls]=m[s]||['⚠️ 要確認','st-unmatched'];
  return `<span class="stbadge ${cls}">${lbl}</span>`;
}

// ===== 起動入口（auth.js がログイン成功後に呼ぶ） =====
function boot() {
  var l = document.getElementById('loading'); if (l) l.style.display = 'none';
  var a = document.getElementById('app');     if (a) a.style.display = '';
  if (window.__deliverInited) return;   // トークン自動更新等での多重初期化を防止
  window.__deliverInited = true;
  __initApp();   // 旧 DOMContentLoaded 初期化（日付一覧・権限取得・描画）
}
