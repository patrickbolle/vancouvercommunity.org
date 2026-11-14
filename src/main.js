// ── Accessibility helpers (shared by every dialog and status message) ──
// a11yDialog: while a modal is open, everything else is inert and Tab loops
// inside it. announce(): one polite live region for screen-reader updates.
window.a11yDialog = (function () {
  var active = null;
  function focusables(el) {
    return Array.prototype.filter.call(
      el.querySelectorAll('a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (n) { return n.offsetParent !== null; }
    );
  }
  document.addEventListener('keydown', function (e) {
    if (!active || e.key !== 'Tab') return;
    var f = focusables(active);
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1], cur = document.activeElement;
    if (e.shiftKey && (cur === first || cur === active)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
  });
  function release() {
    active = null;
    document.querySelectorAll('[data-a11y-inert]').forEach(function (n) {
      n.inert = false;
      n.removeAttribute('data-a11y-inert');
    });
  }
  return {
    open: function (el) {
      release();
      active = el;
      Array.prototype.forEach.call(document.body.children, function (n) {
        if (n === el || n.contains(el) || n.tagName === 'SCRIPT' || n.id === 'a11y-live' || n.inert) return;
        n.inert = true;
        n.setAttribute('data-a11y-inert', '');
      });
    },
    close: function (el) { if (!el || el === active) release(); },
    release: release
  };
})();

window.announce = function (text) {
  var r = document.getElementById('a11y-live');
  if (!r) {
    r = document.createElement('div');
    r.id = 'a11y-live';
    r.className = 'visually-hidden';
    r.setAttribute('role', 'status');
    r.setAttribute('aria-live', 'polite');
    document.body.appendChild(r);
  }
  // Clear first so repeating the same message is announced again.
  r.textContent = '';
  setTimeout(function () { r.textContent = text; }, 50);
};
if (document.body && !document.getElementById('a11y-live')) window.announce('');

// ── Group search (homepage box + masthead box on every other page) ──
// One implementation for both. Every word must match, except filler words
// like "group" or "vancouver". Spaces are ignored ("bird watching" finds
// Birdwatching), and words of 5+ letters allow one typo ("frencg" finds French).
window.vcSearch = (function () {
  var CAP = 12; // results shown before "Show all N"

  function normalize(str) {
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function withinOneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      // Swapped neighbours ("excahnge") count as one typo
      if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) { i += 2; j += 2; continue; }
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }
  var FILLER = { a: 1, an: 1, the: 1, in: 1, for: 1, of: 1, and: 1, to: 1, near: 1, me: 1, vancouver: 1, group: 1, groups: 1, club: 1, clubs: 1, meetup: 1, meetups: 1, community: 1 };
  function searchWords(q) {
    var all = normalize(q).split(' ').filter(Boolean);
    var kept = all.filter(function (w) { return !FILLER[w]; });
    return kept.length ? kept : all;
  }
  function searchMatches(g, words, joined) {
    if (!g._hay) {
      g._hay = normalize(g.n + ' ' + g.d + ' ' + g.c);
      g._flat = g._hay.replace(/ /g, '');
      g._words = g._hay.split(' ');
    }
    if (joined.length > 3 && g._flat.indexOf(joined) !== -1) return true;
    // Words match from their start ("run" finds "running", not "brunch")
    return words.every(function (w) {
      return g._words.some(function (hw) {
        if (hw.indexOf(w) === 0) return true;
        if (w.length < 5) return false;
        return withinOneEdit(w, hw) || (hw.length > w.length && withinOneEdit(w, hw.slice(0, w.length)));
      });
    });
  }
  // Best first: the words in the group's name, then in its category, then anywhere
  function searchScore(g, words) {
    var name = ' ' + normalize(g.n) + ' ', cat = ' ' + normalize(g.c) + ' ';
    var score = 0;
    words.forEach(function (w) {
      if (name.indexOf(' ' + w) !== -1) score += 2;
      else if (cat.indexOf(' ' + w) !== -1) score += 1;
    });
    return score;
  }
  // Every matching group, best first (ties keep directory order).
  function rank(groups, q) {
    var words = searchWords(q);
    if (!words.length) return [];
    var joined = normalize(q).replace(/ /g, '');
    return groups
      .filter(function (g) { return searchMatches(g, words, joined); })
      .map(function (g, i) { return { g: g, s: searchScore(g, words), i: i }; })
      .sort(function (a, b) { return b.s - a.s || a.i - b.i; })
      .map(function (m) { return m.g; });
  }

  // The homepage inlines the list; every other page fetches it once, on first use.
  var pending = null;
  function load() {
    if (window._searchGroups && window._searchGroups.length) return Promise.resolve(window._searchGroups);
    if (!pending) {
      pending = fetch('/search-data.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) { window._searchGroups = data; return data; })
        .catch(function (err) { pending = null; throw err; });
    }
    return pending;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function card(g, source) {
    return '<a href="/' + esc(g.s) + '/#' + esc(g.id) + '" class="search-result-card" data-umami-event="click-search-result" data-umami-event-source="' + source + '"' +
      ' data-group aria-haspopup="dialog" data-g-name="' + esc(g.n) + '" data-g-desc="' + esc(g.d) + '"' +
      ' data-g-cat="' + esc(g.c) + '" data-g-slug="' + esc(g.s) + '"' +
      (g.u ? ' data-g-url="' + esc(g.u) + '"' : '') +
      (g.w ? ' data-g-where="' + esc(g.w) + '"' : '') +
      (g.b ? ' data-g-badge="' + esc(g.b) + '"' : '') + '>' +
      '<span class="search-result-name">' + esc(g.n) + '</span>' +
      '<span class="search-result-desc">' + esc(g.d) + '</span>' +
      '<span class="search-result-cat">' + esc(g.c) + '</span>' +
      '</a>';
  }
  // Top CAP results, then a "Show all N" button that reveals the rest.
  function render(el, list, source, showAll) {
    if (!list.length) {
      el.innerHTML = '<p class="search-empty">Nothing yet — but you could <a href="/blog/start-a-group/">start one</a>, or <a href="/submit/">tell us about one</a>.</p>';
      return;
    }
    var shown = showAll ? list : list.slice(0, CAP);
    var html = '<div class="search-results-grid">' + shown.map(function (g) { return card(g, source); }).join('');
    if (shown.length < list.length) {
      html += '<button type="button" class="search-more">Show all ' + list.length + ' groups</button>';
    }
    el.innerHTML = html + '</div>';
    var more = el.querySelector('.search-more');
    if (more) more.addEventListener('click', function () {
      render(el, list, source, true);
      var next = el.querySelectorAll('.search-result-card')[CAP];
      if (next) next.focus();
      window.announce('Showing all ' + list.length + ' groups');
    });
  }
  function countText(n) {
    if (!n) return 'No groups found';
    return n + (n === 1 ? ' group' : ' groups') + ' found' + (n > CAP ? ', showing the top ' + CAP : '');
  }

  // Wire a search box to its results element.
  // o: { input, results, source ("homepage" | "masthead") }
  function bind(o) {
    var searchTimer = null, trackTimer = null, announceTimer = null, loadingTimer = null, lastCount = 0;

    // Screen readers hear the count once typing settles, not on every keystroke.
    function announceLater(text, immediate) {
      clearTimeout(announceTimer);
      announceTimer = setTimeout(function () { window.announce(text); }, immediate ? 0 : 700);
    }

    // Runs the search. Resolves with the result list, or null if the box was
    // cleared, changed while loading, or the list failed to load.
    function run(immediate) {
      var q = o.input.value.trim();
      clearTimeout(searchTimer);
      clearTimeout(trackTimer);
      clearTimeout(announceTimer);
      clearTimeout(loadingTimer);
      if (!q) {
        o.results.hidden = true;
        o.results.innerHTML = '';
        return Promise.resolve(null);
      }
      // Track the settled query only (not every keystroke), with its result count,
      // so zero-result searches show what the directory is missing.
      if (q.length >= 3) {
        trackTimer = setTimeout(function () {
          if (typeof umami !== 'undefined') umami.track('search', { query: q.toLowerCase(), results: lastCount, empty: lastCount === 0, source: o.source });
        }, 2000);
      }
      return new Promise(function (resolve) {
        searchTimer = setTimeout(function () {
          // A slow connection: say so if the list isn't here after a moment.
          var loaded = false;
          loadingTimer = setTimeout(function () {
            if (loaded || o.input.value.trim() !== q) return;
            o.results.innerHTML = '<p class="search-empty">Loading groups…</p>';
            o.results.hidden = false;
          }, 250);
          load().then(function (groups) {
            loaded = true;
            clearTimeout(loadingTimer);
            if (o.input.value.trim() !== q) return resolve(null);
            var list = rank(groups, q);
            lastCount = list.length;
            render(o.results, list, o.source, false);
            o.results.hidden = false;
            announceLater(countText(list.length), immediate);
            resolve(list);
          }, function () {
            loaded = true;
            clearTimeout(loadingTimer);
            if (o.input.value.trim() !== q) return resolve(null);
            o.results.innerHTML = '<p class="search-empty">Search didn’t load. Check your connection and try again.</p>';
            o.results.hidden = false;
            announceLater('Search didn’t load', true);
            resolve(null);
          });
        }, immediate ? 0 : 150);
      });
    }

    o.input.addEventListener('input', function () { run(false); });

    // Enter or the Search button: search now, then move focus to the first result.
    var form = o.input.form;
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      run(true).then(function (list) {
        var first = list && list.length && o.results.querySelector('.search-result-card');
        if (first) first.focus();
      });
    });

    // Arrow keys: down from the box into the results, then between them;
    // up from the first result goes back to the box.
    function items() { return Array.prototype.slice.call(o.results.querySelectorAll('.search-result-card, .search-more')); }
    o.input.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' || o.results.hidden) return;
      var list = items();
      if (list.length) { e.preventDefault(); list[0].focus(); }
    });
    o.results.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var list = items(), i = list.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      if (e.key === 'ArrowDown') { if (list[i + 1]) list[i + 1].focus(); }
      else if (i === 0) o.input.focus();
      else list[i - 1].focus();
    });

    return { run: run };
  }

  return {
    normalize: normalize, words: searchWords, matches: searchMatches, score: searchScore,
    rank: rank, load: load, render: render, bind: bind, CAP: CAP
  };
})();

// Masthead search: a compact box on every page but the homepage, with a
// dropdown of results. The header is never swapped, so this binds once.
window.mastheadSearch = (function () {
  var box, input, panel, refocusing = false;
  function isOpen() { return !!panel && !panel.hidden; }
  function reopen() { if (input.value.trim() && panel.innerHTML) panel.hidden = false; }
  function close(returnFocus) {
    if (!isOpen()) return;
    panel.hidden = true;
    if (returnFocus) { refocusing = true; input.focus(); refocusing = false; }
  }
  // The group popup a result opens takes focus; leave the dropdown open
  // under it, so closing the popup can return focus to that result.
  function popupOpen(target) {
    return !!(document.getElementById('group-modal') || document.getElementById('surprise-modal') ||
      (target && target.closest && target.closest('#group-modal, #surprise-modal')));
  }
  function init() {
    box = document.getElementById('masthead-search');
    if (!box || box._bound) return;
    box._bound = true;
    input = document.getElementById('masthead-search-input');
    panel = document.getElementById('masthead-search-panel');
    window.vcSearch.bind({ input: input, results: panel, source: 'masthead' });

    // aria-expanded follows the panel, whatever opens or closes it.
    function syncExpanded() { input.setAttribute('aria-expanded', String(!panel.hidden)); }
    syncExpanded();
    if (window.MutationObserver) new MutationObserver(syncExpanded).observe(panel, { attributes: true, attributeFilter: ['hidden'] });

    // Fetch the list on first focus, so it's usually ready by the first keystroke.
    input.addEventListener('focus', function () {
      window.vcSearch.load().catch(function () {});
      if (!refocusing) reopen();
    });
    // Down arrow on a closed box brings the last results back.
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && !isOpen()) { e.preventDefault(); reopen(); }
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(true); }
    });
    // Close when focus or a click leaves the search.
    box.addEventListener('focusout', function () {
      setTimeout(function () {
        if (!box.contains(document.activeElement) && !popupOpen()) close(false);
      }, 0);
    });
    // (A detached target is the "Show all" button, replaced as it reveals the rest.)
    document.addEventListener('click', function (e) {
      if (e.target.isConnected && !box.contains(e.target) && !popupOpen(e.target)) close(false);
    });
  }
  return { init: init, close: close };
})();

document.addEventListener('DOMContentLoaded', function() {
  window.mastheadSearch.init();
  initTabsMore();
  initPage();

  // --- Instant navigation: fetch HTML, swap only <main> ---
  var pageCache = {};
  var navSeq = 0; // the latest click wins; earlier fetches are ignored
  var currentPath = window.location.pathname;

  function fetchPage(path) {
    if (!pageCache[path]) {
      pageCache[path] = fetch(path)
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .catch(function(err) { delete pageCache[path]; throw err; });
    }
    return pageCache[path];
  }

  function prefetch(e) {
    if (!e.target || !e.target.closest) return;
    var link = e.target.closest('a[href^="/"]');
    if (!link || link.onclick || link.closest('form')) return;
    var path = (link.getAttribute('href') || '').split('#')[0];
    if (path && path.indexOf('?') === -1 && path !== window.location.pathname) fetchPage(path).catch(function() {});
  }
  // Prefetch into cache on hover, and on pointerdown as a safety net
  document.addEventListener('pointerenter', prefetch, true);
  document.addEventListener('pointerdown', prefetch, true);

  // Fetch a page and swap it in. push: add a history entry (a click), or not (back/forward).
  function navigate(path, hash, href, push) {
    var seq = ++navSeq;
    document.body.classList.add('is-navigating');
    fetchPage(path).then(function(html) {
      if (seq !== navSeq) return;
      swap(html, path, hash);
      if (push) {
        history.pushState(null, '', href);
        if (typeof umami !== 'undefined' && umami.track) {
          umami.track(function(props) { return { ...props, url: href }; });
        }
      }
    }).catch(function() {
      if (seq !== navSeq) return;
      window.location.href = href;
    });
  }

  // Intercept clicks on internal links
  document.addEventListener('click', function(e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var link = e.target.closest('a[href^="/"]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;
    var href = link.getAttribute('href');
    if (!href) return;
    // Extract path and hash separately
    var hashIdx = href.indexOf('#');
    var path = hashIdx >= 0 ? href.substring(0, hashIdx) : href;
    var hash = hashIdx >= 0 ? href.substring(hashIdx) : '';
    if (path.indexOf('?') !== -1) return; // query pages (e.g. /?q=) load normally
    if (!path || path === window.location.pathname) return; // same page: let the browser handle it
    if (link.onclick || link.closest('form')) return;

    e.preventDefault();
    navigate(path, hash, href, true);
  });

  // Handle browser back/forward (a hash change on the same page needs no swap)
  window.addEventListener('popstate', function() {
    var path = window.location.pathname;
    if (path === currentPath) return;
    navigate(path, window.location.hash, path + window.location.search + window.location.hash, false);
  });

  function swap(html, href, hash) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    currentPath = href;

    // Links inside a dialog (e.g. "See all", "Take me there") navigate in place:
    // close any open dialog and release the inert page before swapping.
    ['group-modal', 'surprise-modal', 'verify-toast'].forEach(function(id) {
      var d = document.getElementById(id);
      if (d) d.remove();
    });
    document.body.classList.remove('modal-open');
    window.a11yDialog.release();

    // Swap main content
    var newMain = doc.querySelector('main');
    var oldMain = document.querySelector('main');
    if (newMain && oldMain) {
      oldMain.replaceWith(newMain);
      // Parsed scripts never run on their own; recreate them so page logic
      // inside <main> (e.g. the submit form handler) works after a swap.
      newMain.querySelectorAll('script').forEach(function(old) {
        if (old.type && old.type !== 'text/javascript' && old.type !== 'module') return;
        var s = document.createElement('script');
        s.textContent = old.textContent;
        old.replaceWith(s);
      });
    }

    // Swap title
    document.title = doc.title;

    // Swap body class (homepage vs category-page); this also ends is-navigating
    document.body.className = doc.body.className;

    // Swap the edit modal if present in new page
    var oldModal = document.getElementById('edit-modal');
    var newModal = doc.getElementById('edit-modal');
    if (oldModal && newModal) {
      oldModal.replaceWith(newModal);
    } else if (oldModal && !newModal) {
      oldModal.remove();
    } else if (!oldModal && newModal) {
      document.body.appendChild(newModal);
    }

    // Run any inline scripts from the new page's main content area
    // (edit modal scripts, etc.)
    doc.querySelectorAll('body > script:not([src])').forEach(function(script) {
      var s = document.createElement('script');
      s.textContent = script.textContent;
      document.body.appendChild(s);
      s.remove();
    });

    // Scroll to the hash target or the top, and move focus there, so keyboard
    // and screen-reader users start on the new page, not on the old link.
    var scrollTarget = null;
    if (hash) { try { scrollTarget = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (err) {} }
    var focusTarget = scrollTarget || document.querySelector('main h1');
    if (scrollTarget) {
      scrollTarget.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    if (focusTarget) {
      if (!focusTarget.matches('a[href], button, input, select, textarea, [tabindex]')) focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
    window.announce(document.title);

    // Re-init page behaviors (the new path, since pushState hasn't run yet)
    window._navPath = href;
    initPage();
    window._navPath = null;

    // Update page views from cached stats
    if (window._statsData) {
      var el = document.getElementById('page-views');
      if (el) {
        var views = window._statsData.pages[href] || 0;
        el.textContent = views ? views.toLocaleString() + ' views' : 'New list';
      }
    }
  }

  // --- Page behaviors (run on load + after each swap) ---

  function initPage() {
    initPageBehaviors();
    markTabs(window._navPath || window.location.pathname);
    // The header outlives a page swap: shut its open menus.
    window.mastheadSearch.close(false);
    closeTabsMore(false);
  }

  // "More" tab (phones only): a small menu with the tabs that don't fit.
  function closeTabsMore(returnFocus) {
    var btn = document.querySelector('.tabs-more-btn');
    var menu = document.getElementById('tabs-more-menu');
    if (!btn || !menu || menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn.focus();
  }
  function initTabsMore() {
    var wrap = document.getElementById('tabs-more');
    if (!wrap) return;
    var btn = wrap.querySelector('.tabs-more-btn');
    var menu = document.getElementById('tabs-more-menu');
    btn.addEventListener('click', function() {
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    wrap.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); closeTabsMore(true); }
    });
    wrap.addEventListener('focusout', function() {
      setTimeout(function() { if (!wrap.contains(document.activeElement)) closeTabsMore(false); }, 0);
    });
    document.addEventListener('click', function(e) {
      if (!wrap.contains(e.target)) closeTabsMore(false);
    });
  }

  // Mark the current section tab (the tab bar sits outside the swapped <main>).
  // Takes the path explicitly: during a swap, location still shows the old page.
  // Category pages have no tab of their own, so they fall back to Directory.
  // Same values as topbar.njk renders: "page" on the tab's own page,
  // "true" on a page inside its section (a blog post, a category page).
  function markTabs(path) {
    var tabs = document.querySelectorAll('.tabs a.tab');
    var match = null;
    tabs.forEach(function(tab) {
      var href = tab.getAttribute('href');
      if (href !== '/' && path.indexOf(href) === 0) match = tab;
    });
    if (!match) match = tabs[0];
    var value = match && path === match.getAttribute('href') ? 'page' : 'true';
    tabs.forEach(function(tab) {
      if (tab === match) tab.setAttribute('aria-current', value);
      else tab.removeAttribute('aria-current');
    });
    // Phones: Blog and About live under "More", so mark the match there too.
    var inMore = false;
    document.querySelectorAll('.tabs-more-menu a').forEach(function(a) {
      var current = !!match && a.getAttribute('href') === match.getAttribute('href');
      if (current) { a.setAttribute('aria-current', value); inMore = true; }
      else a.removeAttribute('aria-current');
    });
    var moreBtn = document.querySelector('.tabs-more-btn');
    if (moreBtn) moreBtn.classList.toggle('is-current', inMore);
  }

  function initPageBehaviors() {

    // Homepage search: same engine as the masthead box (vcSearch, above).
    // A ?q= (from the masthead box without JS, or a shared link) fills it in and runs it.
    var groupSearch = document.getElementById('homepage-group-search');
    var groupResults = document.getElementById('search-results');
    if (groupSearch && groupResults && !groupSearch._bound) {
      groupSearch._bound = true;
      var homeSearch = window.vcSearch.bind({ input: groupSearch, results: groupResults, source: 'homepage' });
      var startQuery = !window._navPath && new URLSearchParams(window.location.search).get('q');
      if (startQuery) { groupSearch.value = startQuery; homeSearch.run(true); }
    }

    // Make entire group card clickable — open the group's visit link
    document.querySelectorAll('.group-card').forEach(function(card) {
      if (card._bound) return;
      card._bound = true;
      var visitLink = card.querySelector('.group-card-link');
      var h2 = card.querySelector('h3');
      if (visitLink && h2) {
        card.style.cursor = 'pointer';
        function activateCard(e) {
          // Real links handle themselves (the outbound handler below opens group links)
          if (e.target.closest('a')) return;
          // Selecting text in a description is not a request to open the site
          if (String(window.getSelection && window.getSelection()).trim()) return;
          window.open(visitLink.href, '_blank', 'noopener');
          var category = window.location.pathname.replace(/^\/|\/$/g, '');
          var groupName = h2.textContent.replace(/\s*\(opens in new tab\)/, '').replace(/\s*#\s*$/, '').trim();
          setTimeout(function() { showVerifyToast(groupName, visitLink.href, category, visitLink); }, 600);
        }
        card.addEventListener('click', activateCard);
      }
    });

    // Group links and "Surprise me" buttons open a dialog
    document.querySelectorAll('[data-group], [onclick^="goRandom"]').forEach(function(t) {
      t.setAttribute('aria-haspopup', 'dialog');
    });

    // Newsletter signup
    document.querySelectorAll('.newsletter-form').forEach(function(form) {
      if (form._bound) return;
      form._bound = true;
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        // Busy guard instead of disabling the button, so focus stays on it.
        if (form._busy) return;
        var input = form.querySelector('.newsletter-input');
        var btn = form.querySelector('.newsletter-btn');
        // Status span might be inside the form's parent container (not inside the form itself)
        var container = form.closest('.hp-newsletter, .category-newsletter, .newsletter-card') || form.parentElement;
        var status = container.querySelector('.newsletter-status');
        var email = input.value.trim();
        if (!email) return;
        function say(kind, text) {
          if (status) {
            status.className = 'newsletter-status' + (kind ? ' ' + kind : '');
            status.textContent = text;
          }
          if (text) window.announce(text);
        }
        say('', '');
        form._busy = true;
        var btnLabel = btn.textContent;
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Subscribing...';
        var source = window.location.pathname.replace(/^\/|\/$/g, '') || 'homepage';
        fetch('https://vancouver-community-newsletter.recipekit.workers.dev/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, source: source })
        }).then(function(r) {
          // A non-JSON reply (an error page) counts as a server error.
          return r.json().catch(function() { return {}; }).then(function(data) {
            return { ok: r.ok, data: data || {} };
          });
        }).then(function(res) {
          if (res.ok && res.data.success) {
            say('success', "You're in! We'll be in touch.");
            input.value = '';
            if (typeof umami !== 'undefined') umami.track('newsletter-signup', { source: source });
          } else {
            var serverMsg = typeof res.data.error === 'string' && res.data.error.trim();
            say('error', serverMsg || 'Could not subscribe just now. Try again, or email vancouver@bolle.co.');
          }
        }, function() {
          say('error', 'Could not reach the server. Check your connection and try again.');
        }).then(function() {
          form._busy = false;
          btn.removeAttribute('aria-disabled');
          btn.textContent = btnLabel;
        });
      });
    });

  }

  // --- Outbound link verification toast ---

  document.addEventListener('click', function(e) {
    var link = e.target.closest('main a[href^="http"]');
    if (!link) return;

    // Card layout: "Visit →" links
    var card = link.closest('.group-card');
    if (card && link.classList.contains('group-card-link')) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener');
      var h2 = card.querySelector('h3');
      var groupName = h2 ? h2.textContent.replace(/\s*\(opens in new tab\)/, '').replace(/\s*#\s*$/, '').trim() : '';
      if (groupName) {
        var category = window.location.pathname.replace(/^\/|\/$/g, '');
        setTimeout(function() { showVerifyToast(groupName, link.href, category, link); }, 600);
      }
    }
  });

  function escapeHtml(str) {
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // One Escape listener for the toast, added once. It only closes the toast
  // when nothing above it handled the key (an open dialog, the search panel).
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    var toast = document.getElementById('verify-toast');
    if (!toast || toast._dismissed) return;
    if (document.querySelector('#group-modal, #surprise-modal, .edit-modal[style*="block"]')) return;
    dismissToast(toast);
  });

  // returnTo: where focus goes if it is inside the toast when the toast closes.
  function showVerifyToast(groupName, url, category, returnTo) {
    // Remove any existing toast
    var existing = document.getElementById('verify-toast');
    if (existing) { clearTimeout(existing._timer); existing.remove(); }

    var safeName = escapeHtml(groupName);
    var toast = document.createElement('div');
    toast.id = 'verify-toast';
    toast.className = 'verify-toast';
    toast._returnTo = returnTo || null;
    toast.setAttribute('role', 'region');
    toast.setAttribute('aria-label', 'Check this listing: ' + groupName);
    toast.innerHTML =
      '<div class="verify-toast-inner">' +
        '<p class="verify-toast-question">Anything wrong with <strong>' + safeName + '</strong>?</p>' +
        '<p class="verify-toast-subtitle">Dead link, wrong info, closed group — anything helps.</p>' +
        '<div class="verify-toast-actions">' +
          '<button type="button" class="verify-btn verify-btn-yes" data-status="active">Looks good</button>' +
          '<button type="button" class="verify-btn verify-btn-no" data-status="issue">Report an issue</button>' +
          '<button type="button" class="verify-btn verify-btn-dismiss" aria-label="Dismiss">&times;</button>' +
        '</div>' +
        '<div class="verify-toast-detail" style="display:none">' +
          '<input type="text" class="verify-detail-input" aria-label="What is wrong with ' + safeName.replace(/"/g, '&quot;') + '?" aria-describedby="verify-toast-hint" placeholder="e.g. link is broken, wrong meeting time, group shut down">' +
          '<button type="button" class="verify-btn verify-btn-send">Send</button>' +
          '<button type="button" class="verify-btn verify-btn-cancel">Cancel</button>' +
        '</div>' +
        '<p class="verify-toast-subtitle verify-toast-hint" id="verify-toast-hint" hidden>Tell us what’s wrong first, or choose Cancel.</p>' +
      '</div>';

    document.body.appendChild(toast);
    window.announce('Anything wrong with ' + groupName + '? Options are at the bottom of the page.');

    // Animate in
    requestAnimationFrame(function() {
      toast.classList.add('visible');
    });

    // Auto-dismiss after 15 seconds, unless the reader starts using the toast.
    toast._timer = setTimeout(function() { dismissToast(toast); }, 15000);
    function hold() { clearTimeout(toast._timer); }
    toast.addEventListener('focusin', hold);
    toast.addEventListener('pointerenter', hold);
    toast.addEventListener('keydown', hold);
    toast.addEventListener('click', hold);

    // Dismiss on X button (and Cancel in the "Report an issue" view)
    toast.querySelector('.verify-btn-dismiss').addEventListener('click', function() { dismissToast(toast); });
    toast.querySelector('.verify-btn-cancel').addEventListener('click', function() { dismissToast(toast); });

    // "Looks good" — quick positive signal
    toast.querySelector('.verify-btn-yes').addEventListener('click', function() {
      sendVerification(groupName, url, category, 'active', '');
      showToastThanks(toast);
    });

    // "Something's wrong" — expand detail input
    toast.querySelector('.verify-btn-no').addEventListener('click', function() {
      toast.querySelector('.verify-toast-actions').style.display = 'none';
      toast.querySelector('.verify-toast-detail').style.display = 'flex';
      toast.querySelector('.verify-detail-input').focus();
    });

    var input = toast.querySelector('.verify-detail-input');
    var hint = toast.querySelector('.verify-toast-hint');
    function clearHint() {
      hint.hidden = true;
      input.removeAttribute('aria-invalid');
    }
    input.addEventListener('input', clearHint);

    // Send detail
    toast.querySelector('.verify-btn-send').addEventListener('click', function() {
      var detail = input.value.trim();
      if (!detail) {
        hint.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        window.announce(hint.textContent);
        input.focus();
        return;
      }
      sendVerification(groupName, url, category, 'issue', detail);
      showToastThanks(toast);
    });

    // Also submit on Enter in the detail input
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        toast.querySelector('.verify-btn-send').click();
      }
    });
  }

  function showToastThanks(toast) {
    var category = window.location.pathname.replace(/^\/|\/$/g, '') || 'homepage';
    var inner = toast.querySelector('.verify-toast-inner');
    var thanks = 'Thanks, that helps keep this list accurate.';
    inner.innerHTML =
      '<p class="verify-toast-thanks" tabindex="-1">' + thanks + '</p>' +
      '<div class="verify-toast-funnel verify-toast-actions">' +
        '<a href="#" class="verify-funnel-link" onclick="sharePage(\'' + category + '-verify\', this); return false;">Tell a friend about this list</a>' +
        '<button type="button" class="verify-btn verify-btn-dismiss" aria-label="Dismiss">&times;</button>' +
      '</div>';
    inner.querySelector('.verify-btn-dismiss').addEventListener('click', function() { dismissToast(toast); });

    // Focus the message (the button that was clicked is gone). The reader is
    // now inside the toast, so it stays until they dismiss it.
    clearTimeout(toast._timer);
    inner.querySelector('.verify-toast-thanks').focus();
    window.announce(thanks);
  }

  function dismissToast(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    // Don't strand focus on a toast that is about to go away.
    if (toast.contains(document.activeElement)) {
      var back = toast._returnTo;
      if (back && back.isConnected && back.focus) back.focus();
      else document.activeElement.blur();
    }
    toast.classList.remove('visible');
    setTimeout(function() { toast.remove(); }, 300);
  }

  function sendVerification(groupName, url, category, status, detail) {
    if (typeof umami !== 'undefined') {
      umami.track('verify-link', { group: groupName, status: status });
    }
    fetch('https://vancouver-community-submit.recipekit.workers.dev/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group: groupName,
        url: url,
        category: category,
        status: status,
        detail: detail
      })
    }).catch(function() { /* silent fail */ });
  }

});

// ── Group detail modal ─────────────────────────────────────────────
// A focused "here's the group you clicked" popup, opened from any card
// carrying data-group attributes. Replaces the jarring jump-to-anchor.
// Progressive enhancement: the underlying links still work without JS.
(function () {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  var lastFocus = null;

  function close() {
    var m = document.getElementById("group-modal");
    if (!m) return;
    m.classList.remove("visible");
    document.body.classList.remove("modal-open");
    window.a11yDialog.close(m);
    m.id = ""; // fading out: no longer "the" open modal
    setTimeout(function () { if (m.parentNode) m.remove(); }, 180);
    if (lastFocus && lastFocus.isConnected && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  // trigger: the link that opened the modal. Safari doesn't focus links on
  // click, so document.activeElement can't be trusted to return focus to.
  window.openGroupModal = function (g, trigger) {
    lastFocus = trigger || document.activeElement;
    var existing = document.getElementById("group-modal");
    if (existing) existing.remove();

    var domain = "";
    if (g.url) { try { domain = new URL(g.url).hostname.replace(/^www\./, ""); } catch (e) {} }

    var m = document.createElement("div");
    m.id = "group-modal";
    m.className = "group-modal";
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-modal", "true");
    m.setAttribute("aria-labelledby", "group-modal-name");
    if (g.desc) m.setAttribute("aria-describedby", "group-modal-desc");
    m.setAttribute("tabindex", "-1");

    var html = '<div class="group-modal-inner">';
    html += '<button type="button" class="group-modal-close" aria-label="Close">&times;</button>';
    if (g.cat) {
      html += '<a class="group-modal-cat" href="/' + esc(g.slug) + '/">' + esc(g.cat) + '</a>';
    }
    html += '<h2 class="group-modal-name" id="group-modal-name">' + esc(g.name || "Group details") + '</h2>';
    if (g.badge) html += '<span class="group-modal-badge">' + esc(g.badge) + '</span>';
    if (g.desc) html += '<p class="group-modal-desc" id="group-modal-desc">' + esc(g.desc) + '</p>';
    if (g.where) html += '<p class="group-modal-where">Where: ' + esc(g.where) + '</p>';
    if (g.when) html += '<p class="group-modal-where">When: ' + esc(g.when) + '</p>';
    if (g.cost) html += '<p class="group-modal-where">Cost: ' + esc(g.cost) + '</p>';
    html += '<div class="group-modal-actions">';
    if (g.url) {
      html += '<a class="group-modal-visit" href="' + esc(g.url) + '" target="_blank" rel="noopener noreferrer" data-umami-event="outbound-link" data-umami-event-url="' + esc(domain) + '">Visit' + (domain ? " " + esc(domain) : "") + ' \u2192<span class="visually-hidden"> (opens in new tab)</span></a>';
    }
    if (g.slug) {
      html += '<a class="group-modal-more" href="/' + esc(g.slug) + '/">See all ' + esc(g.cat || "in this category") + '</a>';
    }
    html += '</div></div>';
    m.innerHTML = html;
    document.body.appendChild(m);
    document.body.classList.add("modal-open");
    requestAnimationFrame(function () { m.classList.add("visible"); });

    m.querySelector(".group-modal-close").addEventListener("click", close);
    m.addEventListener("click", function (e) { if (e.target === m) close(); });
    // Move focus into the dialog itself (not the close button) so no focus
    // outline box appears around the × on open; keyboard nav still works.
    window.a11yDialog.open(m);
    m.focus();
    if (typeof umami !== "undefined") umami.track("group-modal", { group: g.name });
  };

  // Delegated on the CAPTURE phase so this pre-empts the site's SPA
  // link-interceptor: any [data-group] element opens the modal instead of
  // navigating to the group's anchor. Real outbound links are left alone.
  document.addEventListener("click", function (e) {
    if (e.target.closest('a[target="_blank"]')) return;
    var t = e.target.closest("[data-group]");
    if (!t) return;
    // Ctrl/Cmd/Shift-click or a middle click: let the link open normally.
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.openGroupModal({
      name: t.getAttribute("data-g-name"),
      desc: t.getAttribute("data-g-desc"),
      cat: t.getAttribute("data-g-cat"),
      slug: t.getAttribute("data-g-slug"),
      url: t.getAttribute("data-g-url"),
      where: t.getAttribute("data-g-where"),
      when: t.getAttribute("data-g-when"),
      cost: t.getAttribute("data-g-cost"),
      badge: t.getAttribute("data-g-badge")
    }, t);
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.getElementById("group-modal")) {
      e.preventDefault(); // the toast's Escape listener leaves it alone
      close();
    }
  });
})();
