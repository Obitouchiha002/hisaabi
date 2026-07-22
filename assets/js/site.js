/* Hisaabi — landing interactions
   1. theme toggle   2. nav    3. reveal on scroll
   4. ticker         5. hero phone demo loop            */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. theme ---------- */
  var themeBtn = document.getElementById('themeBtn');
  themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('hisaabi-theme', next);
  });

  /* ---------- 1b. accent picker ---------- */
  var ACCENTS = {
    nimbu:  'Nimbu',
    kesari: 'Kesari',
    pudina: 'Pudina',
    genda:  'Genda',
    jamun:  'Jamun'
  };

  var pickerBtn  = document.getElementById('pickerBtn');
  var pickerPop  = document.getElementById('pickerPop');
  var accentName = document.getElementById('accentName');
  var swatches   = pickerPop.querySelectorAll('.sw');

  function applyAccent(key) {
    if (key === 'nimbu') root.removeAttribute('data-accent');
    else root.setAttribute('data-accent', key);

    localStorage.setItem('hisaabi-accent', key);
    accentName.textContent = ACCENTS[key] || ACCENTS.nimbu;
    swatches.forEach(function (s) {
      s.setAttribute('aria-checked', String(s.dataset.accent === key));
    });
  }

  applyAccent(root.getAttribute('data-accent') || 'nimbu');

  swatches.forEach(function (s) {
    s.addEventListener('click', function () { applyAccent(s.dataset.accent); });
  });

  function closePicker() {
    pickerPop.classList.remove('open');
    pickerBtn.setAttribute('aria-expanded', 'false');
  }
  pickerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = pickerPop.classList.toggle('open');
    pickerBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function (e) {
    if (!pickerPop.contains(e.target)) closePicker();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePicker();
  });

  /* ---------- 2. nav ---------- */
  var nav = document.getElementById('nav');
  var navLinks = document.getElementById('navLinks');
  var navToggle = document.getElementById('navToggle');

  navToggle.addEventListener('click', function () {
    var open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  var onScroll = function () {
    nav.classList.toggle('stuck', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('yr').textContent = new Date().getFullYear();

  /* ---------- 3. reveal ---------- */
  var revealables = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- 4. ticker ---------- */
  var TICKS = [
    ['PhonePe', '₹240 · Blinkit'],
    ['🎤 bola', '"auto saath rupaye"'],
    ['SBI', '₹1,200 debited · Rent'],
    ['GPay', '₹85 · Chai Point'],
    ['Telegram', '"petrol 500"'],
    ['Paytm', '₹49 · Recharge'],
    ['🎤 bola', '"sabzi ek sau chalis"'],
    ['HDFC', '₹2,499 · Amazon'],
    ['Swiggy', '₹318 · Dinner'],
    ['GPay', '₹30 · Auto'],
    ['CRED', '₹5,000 · Card bill'],
    ['ICICI', '₹180 · Zomato']
  ];
  var track = document.getElementById('tickerTrack');
  var html = TICKS.map(function (t) {
    return '<span class="tick"><span class="dot"></span><b>' + t[0] + '</b> ' + t[1] + '</span>';
  }).join('');
  track.innerHTML = html + html; // duplicate → seamless loop

  /* ---------- 5. phone demo ---------- */
  var SPOKEN = 'aaj chai bees, auto saath, sabzi ek sau chalis, aur dopahar khana assi';

  var ENTRIES = [
    { icon: '🍵', name: 'Chai',          cat: 'Khana-peena',   amt: 20 },
    { icon: '🛺', name: 'Auto',          cat: 'Aana-jaana',    amt: 60 },
    { icon: '🥬', name: 'Sabzi',         cat: 'Ghar ka saman', amt: 140 },
    { icon: '🍛', name: 'Dopahar khana', cat: 'Khana-peena',   amt: 80 }
  ];
  var AUTO_ENTRY = { icon: '🛒', name: 'Blinkit', cat: 'PhonePe · auto', amt: 240, auto: true };

  var mic        = document.getElementById('pMic');
  var transcript = document.getElementById('pTranscript');
  var body       = document.getElementById('pBody');
  var totalEl    = document.getElementById('pTotal');
  var countEl    = document.getElementById('pCount');
  var statusEl   = document.getElementById('pStatus');
  var toast      = document.getElementById('pToast');

  var looping = false;
  function wait(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }
  function rupees(n) { return '₹' + n.toLocaleString('en-IN'); }

  function rowHTML(e) {
    return '<span class="p-emoji">' + e.icon + '</span>' +
           '<span><span class="p-name">' + e.name + '</span>' +
           '<span class="p-cat">' + e.cat + '</span></span>' +
           (e.auto ? '<span class="p-tag">auto</span>' : '') +
           '<span class="p-amt num">' + rupees(e.amt) + '</span>';
  }

  function addRow(e) {
    var row = document.createElement('div');
    row.className = 'p-row' + (e.auto ? ' auto' : '');
    row.innerHTML = rowHTML(e);
    body.appendChild(row);
    requestAnimationFrame(function () { row.classList.add('show'); });
  }

  var shownTotal = 0;
  function bumpTotal(to) {
    var from = shownTotal, start = null, dur = 550;
    shownTotal = to;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      totalEl.textContent = rupees(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function resetPhone() {
    body.innerHTML = '';
    statusEl.textContent = '';
    toast.classList.remove('show');
    mic.classList.remove('rec');
    transcript.innerHTML = '<span class="p-hint">Dabao aur bol do…</span>';
    totalEl.textContent = '₹0';
    countEl.textContent = '0';
    shownTotal = 0;
  }

  async function type(text) {
    transcript.innerHTML = '<span class="t"></span><span class="caret"></span>';
    var t = transcript.querySelector('.t');
    for (var i = 0; i < text.length && looping; i++) {
      t.textContent += text[i];
      await wait(text[i] === ',' ? 170 : 34);
    }
    var caret = transcript.querySelector('.caret');
    if (caret) caret.remove();
  }

  async function runDemo() {
    resetPhone();
    await wait(900);
    if (!looping) return;

    // bolna
    mic.classList.add('rec');
    statusEl.textContent = 'Sun raha hoon…';
    await type(SPOKEN);
    await wait(350);
    mic.classList.remove('rec');
    if (!looping) return;

    // samajhna
    statusEl.textContent = 'Samajh raha hoon…';
    await wait(750);
    statusEl.textContent = '4 kharche mile';

    // entries
    var running = 0;
    for (var i = 0; i < ENTRIES.length; i++) {
      addRow(ENTRIES[i]);
      running += ENTRIES[i].amt;
      bumpTotal(running);
      countEl.textContent = String(i + 1);
      await wait(430);
      if (!looping) return;
    }

    transcript.innerHTML = '<span class="p-hint">Ho gaya ✓</span>';
    await wait(1400);
    if (!looping) return;

    // auto-capture
    statusEl.textContent = 'Notification se pakda gaya';
    toast.classList.add('show');
    await wait(1300);
    toast.classList.remove('show');
    addRow(AUTO_ENTRY);
    running += AUTO_ENTRY.amt;
    bumpTotal(running);
    countEl.textContent = '5';

    await wait(3200);
  }

  function showStatic() {
    resetPhone();
    var running = 0;
    ENTRIES.concat([AUTO_ENTRY]).forEach(function (e) {
      addRow(e);
      running += e.amt;
    });
    body.querySelectorAll('.p-row').forEach(function (r) {
      r.style.opacity = 1; r.style.transform = 'none';
    });
    totalEl.textContent = rupees(running);
    countEl.textContent = '5';
    transcript.innerHTML = '<span class="p-hint">"chai bees, auto saath, sabzi ek sau chalis…"</span>';
  }

  async function loop() {
    if (looping) return;
    looping = true;
    while (looping) { await runDemo(); }
  }
  function stopLoop() { looping = false; }

  if (reduced) {
    showStatic();
  } else {
    // sirf tab chalao jab phone screen pe dikhe — battery bachao
    var stage = document.querySelector('.phone-stage');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { loop(); }
        else { stopLoop(); }
      }, { threshold: 0.25 }).observe(stage);
    } else {
      loop();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopLoop();
      else if (isInView(stage)) loop();
    });
    function isInView(el) {
      var r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    }
  }

})();
