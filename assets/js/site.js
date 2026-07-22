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

  // Mobile pe body hi scroll container hai (snap sections), desktop pe window.
  // Dono ka scroll position dekhna padta hai.
  var scrollTop = function () {
    return window.scrollY || document.body.scrollTop || 0;
  };
  var onScroll = function () {
    nav.classList.toggle('stuck', scrollTop() > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  document.body.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile app shell ----------
     Mobile pe website ek app ki tarah chalti hai: neeche tabs, beech me screen.
     Phone mock ek hi hai (uski animation isi DOM node pe chalti hai), isliye
     use utha kar mobile ke home screen me daal dete hain — copy nahi banate.  */
  var mapp = document.getElementById('mapp');
  if (mapp) {
    var mq = window.matchMedia('(max-width: 900px)');
    var stage = document.querySelector('.phone-stage');
    var deskSlot = document.querySelector('.hero-grid');
    var mobSlot = document.getElementById('mPhoneSlot');

    var placePhone = function () {
      if (!stage) return;
      var target = mq.matches ? mobSlot : deskSlot;
      if (target && stage.parentElement !== target) target.appendChild(stage);
    };
    placePhone();
    mq.addEventListener('change', placePhone);

    var tabs = document.getElementById('mtabs');
    var screens = mapp.querySelectorAll('.mscreen');

    var order = [];
    screens.forEach(function (sc) { order.push(sc.dataset.tab); });
    var current = order[0];

    var showTab = function (go) {
      if (go === current) return;

      // kis taraf ja rahe hain — usi taraf se screen aati hai
      var back = order.indexOf(go) < order.indexOf(current);
      current = go;

      tabs.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.go === go); });
      screens.forEach(function (sc) {
        var on = sc.dataset.tab === go;
        sc.classList.remove('from-left', 'from-right');
        sc.classList.toggle('on', on);
        if (on) {
          sc.scrollTop = 0;
          sc.classList.add(back ? 'from-left' : 'from-right');
        }
      });

      if (navigator.vibrate) navigator.vibrate(8);
    };

    // ?tab=price — deep link, aur screenshot lene ke liye bhi
    var wanted = new URLSearchParams(location.search).get('tab');
    if (wanted && mapp.querySelector('.mscreen[data-tab="' + wanted + '"]')) showTab(wanted);

    // side swipe se bhi tab badle — app jaisa lage
    var touchX = null, touchY = null;
    mapp.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });

    mapp.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      var dy = e.changedTouches[0].clientY - touchY;
      touchX = null;

      // sirf saaf horizontal swipe — warna scroll me ghalti se tab badal jayega
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8) return;

      var i = order.indexOf(current) + (dx < 0 ? 1 : -1);
      if (i >= 0 && i < order.length) showTab(order[i]);
    }, { passive: true });

    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-go]');
      if (!btn) return;

      showTab(btn.dataset.go);
    });

    // mobile ke apne theme/rang buttons — wahi kaam jo desktop pe hota hai
    var mTheme = document.getElementById('mTheme');
    if (mTheme) mTheme.addEventListener('click', function () { themeBtn.click(); });

    var mPicker = document.getElementById('mPicker');
    if (mPicker) {
      var order = ['nimbu', 'kesari', 'pudina', 'genda', 'jamun'];
      mPicker.addEventListener('click', function () {
        var now = root.getAttribute('data-accent') || 'nimbu';
        applyAccent(order[(order.indexOf(now) + 1) % order.length]);
      });
    }
  }

  /* ---------- download card ----------
     APK seedha girane ke bajaye pehle card: kya, kitna bada, install kaise.
     Version/size/checksum GitHub se live aate hain, taki nayi release pe
     yahan haath lagane ki zaroorat na pade.                                */
  var dlModal = document.getElementById('dlModal');
  if (dlModal) {
    var RELEASE_API = 'https://api.github.com/repos/Obitouchiha002/hisaabi/releases/latest';
    var dlGo = dlModal.querySelector('#dlGo');
    var lastFocus = null;
    var loaded = false;

    var setText = function (id, value) {
      var el = document.getElementById(id);
      if (el && value) el.textContent = value;
    };

    var loadRelease = function () {
      fetch(RELEASE_API)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rel) {
          if (!rel) return;
          var apk = (rel.assets || []).filter(function (a) { return /\.apk$/.test(a.name); })[0];
          setText('dlVersion', rel.tag_name);
          if (apk) {
            setText('dlSize', (apk.size / 1048576).toFixed(1) + ' MB');
            if (apk.digest) setText('dlHash', String(apk.digest).replace(/^sha256:/, ''));
          }
          if (rel.published_at) {
            setText('dlDate', new Date(rel.published_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric'
            }));
          }
        })
        .catch(function () { /* net na ho to HTML wali values hi theek hain */ });
    };

    var closeDl = function () {
      dlModal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };

    var openDl = function (e) {
      if (e) e.preventDefault();
      lastFocus = document.activeElement;
      dlModal.hidden = false;
      document.body.style.overflow = 'hidden';
      if (dlGo) dlGo.focus();
      if (!loaded) { loaded = true; loadRelease(); }
    };

    // har APK link ab card kholta hai (card ke andar wala button chhod ke)
    document.querySelectorAll('a[href="/hisaabi.apk"], a[href="/apk"]').forEach(function (a) {
      if (a.id === 'dlGo') return;
      a.addEventListener('click', openDl);
    });

    dlModal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeDl();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !dlModal.hidden) closeDl();
    });
    if (dlGo) dlGo.addEventListener('click', function () { setTimeout(closeDl, 900); });

    // ?dl=1 — card seedha khula hua (share ya testing ke liye)
    if (new URLSearchParams(location.search).has('dl')) setTimeout(openDl, 60);
  }

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

  var EMPTY_HTML =
    '<div class="p-empty">' +
      '<span class="e-ico" aria-hidden="true">👋</span>' +
      '<span class="e-t">Namaste!</span>' +
      '<span class="e-s">Aaj ka hisaab abhi khaali hai. Mic dabao aur jitne kharche hain, ek saath bol do.</span>' +
      '<span class="e-chip">“chai bees, auto saath…”</span>' +
    '</div>';

  function hideEmpty() {
    var empty = body.querySelector('.p-empty');
    if (!empty || empty.classList.contains('out')) return;
    empty.classList.add('out');
    setTimeout(function () { if (empty.parentNode) empty.remove(); }, 500);
  }

  function addRow(e) {
    hideEmpty();
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
    body.innerHTML = EMPTY_HTML;
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
