// The Constitution Builder · short demo for presentations (about 1.5 minutes).
// 1. The self-focused profile's conversation, side by side with the Default
//    model, message by message. Only the passages the full demo highlights
//    are marked; no notes, no middle column.
// 2. The three profiles side by side: how each AI ended the conversation.
// Controls: the buttons, or → / Space / Page Down (next), ← / Page Up (back),
// Home (start over), F (full screen). A presentation clicker works too.
(function () {
  'use strict';
  var D = window.SHORT, W = 1920, H = 1080;
  var stage = document.getElementById('stage'), screen = document.getElementById('screen');
  var state = { view: 'convo', k: 0, busy: false };
  var timers = [];
  var TOTAL = D.convo.tailored.length;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function arrow() { return '<span class="btn__go"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></span>'; }

  // Markdown for the Default model's replies (## / ### headings, **bold**, lists)
  function md(raw) {
    var lines = esc(raw).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(?=\S)([^*\n]+?)\*/g, '<em>$1</em>').split('\n');
    var out = [], list = null;
    function close() { if (list) { out.push('</' + list + '>'); list = null; } }
    lines.forEach(function (line) {
      var ul = line.match(/^\s*[-*]\s+(.+)/), ol = line.match(/^\s*\d+\.\s+(.+)/);
      var h3 = line.match(/^###\s+(.+)/), h2 = line.match(/^##\s+(.+)/);
      if (ul || ol) {
        var type = ul ? 'ul' : 'ol';
        if (list !== type) { close(); out.push('<' + type + ' class="md-list">'); list = type; }
        out.push('<li>' + (ul || ol)[1] + '</li>');
        return;
      }
      close();
      if (h3) out.push('<h4 class="md-h4">' + h3[1] + '</h4>');
      else if (h2) out.push('<h3 class="md-h3">' + h2[1] + '</h3>');
      else if (line.trim()) out.push('<p class="md-p">' + line + '</p>');
    });
    close();
    return out.join('');
  }

  // The fixed canvas, scaled to fit the window
  function fit() { stage.style.transform = 'scale(' + Math.min(window.innerWidth / W, window.innerHeight / H) + ')'; }
  window.addEventListener('resize', fit);
  fit();

  // Wrap the exact quoted text (which may span <strong> etc.) in <mark>s
  function highlight(container, quote, side) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT), nodes = [], full = '', node;
    while ((node = walker.nextNode())) { nodes.push({ node: node, start: full.length }); full += node.nodeValue; }
    var idx = full.indexOf(quote);
    if (idx < 0) return;
    var end = idx + quote.length;
    nodes.forEach(function (n) {
      var nEnd = n.start + n.node.nodeValue.length;
      if (nEnd <= idx || n.start >= end) return;
      var range = document.createRange();
      range.setStart(n.node, Math.max(idx, n.start) - n.start);
      range.setEnd(n.node, Math.min(end, nEnd) - n.start);
      var m = document.createElement('mark');
      m.className = 'hl' + (side === 'default' ? ' hl--default' : '');
      range.surroundContents(m);
    });
  }
  function highlightMessage(i) {
    (D.convo.highlights[i] || []).forEach(function (h) {
      var col = document.getElementById(h.side === 'default' ? 'col-d' : 'col-t');
      var ex = col.querySelectorAll('.exchange')[i];
      var reply = ex && ex.querySelector(h.side === 'default' ? '.bubble--default' : '.bubble--tailored');
      if (reply) highlight(reply, h.quote, h.side);
    });
  }

  function userBubble(text) { return '<div class="bubble bubble--user">' + esc(text) + '</div>'; }
  function replyHTML(text, side) { return side === 'default' ? md(text) : esc(text); }
  // (static = already on screen: no entrance animation)
  function exchangeHTML(t, side) {
    return '<div class="exchange static">' + userBubble(t.user) + '<div class="bubble bubble--' + side + '">' + replyHTML(t.assistant, side) + '</div></div>';
  }
  function noMoreHTML(isStatic) { return '<div class="nomore' + (isStatic ? ' static' : '') + '">No more recorded messages on this side.</div>'; }

  // Scroll a column so its newest exchange starts at the top
  function scrollToExchange(col, i, instant) {
    var ex = col.querySelectorAll('.exchange')[i];
    if (!ex) return;
    col.style.scrollBehavior = instant ? 'auto' : '';
    col.scrollTop = ex.offsetTop - 40;
  }

  // ---------------------------------------------------------------------------
  // 1. The conversation
  // ---------------------------------------------------------------------------
  function buildConvo() {
    var c = D.convo;
    screen.innerHTML = '<div class="convo ' + c.profile.theme + ' screen-in">' +
      '<div class="cols">' +
        '<section class="col col--t"><header class="col__head"><img src="' + c.profile.icon + '" alt="">' +
          '<div><div class="col__name">' + esc(c.profile.label) + '</div><div class="col__sub">Same AI, with their constitution</div></div></header>' +
          '<div class="col__scroll" id="col-t"></div></section>' +
        '<section class="col col--d"><header class="col__head"><span class="col__dot">AI</span>' +
          '<div><div class="col__name">Default model</div><div class="col__sub">Same AI, no constitution' + (c.defaultMatched ? '' : ' · recorded separately') + '</div></div></header>' +
          '<div class="col__scroll" id="col-d"></div></section>' +
      '</div>' +
      '<footer class="bar" id="bar"></footer>' +
    '</div>';
  }

  function renderBar() {
    var k = state.k, label, cls = 'btn btn--next';
    if (k === 0) label = 'Send: “' + D.question + '”';
    else if (k < TOTAL) label = 'Send next message';
    else label = 'See all three profiles';
    document.getElementById('bar').innerHTML =
      '<div>' + (k > 0 ? '<button class="btn btn--ghost" data-action="back">← Back</button>' : '') + '</div>' +
      '<button class="' + cls + '" data-action="next">' + esc(label) + arrow() + '</button>' +
      '<div class="bar__right">' + (k > 0 ? 'Message ' + k + ' of ' + TOTAL : '') + '</div>';
  }

  // Everything up to message k, at rest (used for Back and after a skip)
  function renderStatic() {
    clearTimers();
    state.busy = false;
    if (!document.getElementById('col-t')) buildConvo();
    var c = D.convo, k = state.k, colT = document.getElementById('col-t'), colD = document.getElementById('col-d');
    colT.innerHTML = c.tailored.slice(0, k).map(function (t) { return exchangeHTML(t, 'tailored'); }).join('');
    colD.innerHTML = c.defaultModel.slice(0, k).map(function (t) { return exchangeHTML(t, 'default'); }).join('') +
      (k > c.defaultModel.length ? noMoreHTML(true) : '');
    for (var i = 0; i < k; i++) highlightMessage(i);
    renderBar();
    scrollToExchange(colT, k - 1, true);
    scrollToExchange(colD, Math.min(k, c.defaultModel.length) - 1, true);
  }

  // Send message i on both sides: the question, a moment of typing, the replies
  function sendMessage(i) {
    var c = D.convo, colT = document.getElementById('col-t'), colD = document.getElementById('col-d');
    var t = c.tailored[i], d = c.defaultModel[i];
    state.busy = true;
    renderBar();
    function add(col, turn, side) {
      var ex = document.createElement('div');
      ex.className = 'exchange';
      ex.innerHTML = userBubble(turn.user);
      col.appendChild(ex);
      scrollToExchange(col, i);
      later(function () {
        var b = document.createElement('div');
        b.className = 'bubble bubble--' + side;
        b.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
        ex.appendChild(b);
      }, 380);
      later(function () {
        ex.querySelector('.bubble--' + side).innerHTML = replyHTML(turn.assistant, side);
      }, side === 'default' ? 1250 : 1050);
    }
    add(colT, t, 'tailored');
    if (d) add(colD, d, 'default');
    else if (i === c.defaultModel.length) colD.insertAdjacentHTML('beforeend', noMoreHTML());
    later(function () { highlightMessage(i); state.busy = false; }, 1300);
  }

  // ---------------------------------------------------------------------------
  // 2. The three profiles
  // ---------------------------------------------------------------------------
  function renderCompare() {
    clearTimers();
    state.busy = false;
    var mine = D.convo.profile.theme;
    var cards = D.profiles.map(function (p) {
      var advice = esc(p.last).replace(esc(p.quote), '<mark>' + esc(p.quote) + '</mark>');
      return '<article class="card ' + p.theme + (p.theme === mine ? ' mine' : '') + '">' +
        (p.theme === mine ? '<span class="card__ribbon">The conversation you just saw</span>' : '') +
        '<div class="card__head"><img src="' + p.icon + '" alt=""><div><div class="card__name">' + esc(p.label) + '</div>' +
          '<div class="card__desc">' + esc(p.descriptor) + '</div></div></div>' +
        '<p class="card__label">How their AI ended the conversation</p>' +
        '<p class="card__advice">' + advice + '</p>' +
        '<p class="card__why"><b>Why:</b> ' + esc(p.why) + '</p>' +
      '</article>';
    }).join('');
    screen.innerHTML = '<div class="compare screen-in">' +
      '<div class="compare__head"><div><h1 class="compare__title">Same question. Same AI. Different values.</h1>' +
        '<p class="compare__q">“<b>' + esc(D.question) + '</b>”</p></div>' +
        '<img src="img/wordmark.svg" alt="The Constitution Builder"></div>' +
      '<div class="cards">' + cards + '</div>' +
      '<div class="compare__bar"><button class="btn btn--ghost" data-action="back">← Back to the conversation</button>' +
        '<button class="btn btn--ghost" data-action="restart">↺ Start over</button></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  function next() {
    if (state.view !== 'convo') return;
    if (state.busy) { renderStatic(); return; }   // a quick second click finishes the message first
    if (state.k < TOTAL) { state.k++; sendMessage(state.k - 1); }
    else { state.view = 'compare'; renderCompare(); }
  }
  function back() {
    if (state.view === 'compare') { state.view = 'convo'; buildConvo(); renderStatic(); return; }
    if (state.k > 0) { state.k--; renderStatic(); }
  }
  function restart() { state.view = 'convo'; state.k = 0; buildConvo(); renderStatic(); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (!b) return;
    b.blur();
    ({ next: next, back: back, restart: restart })[b.dataset.action]();
  });
  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter' || k === 'ArrowDown') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace' || k === 'ArrowUp') { e.preventDefault(); back(); }
    else if (k === 'Home' || k === 'r' || k === 'R') { e.preventDefault(); restart(); }
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {});
    }
  });

  restart();
}());
