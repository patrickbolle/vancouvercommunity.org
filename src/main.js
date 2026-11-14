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
      ' data-group data-g-name="' + esc(g.n) + '" data-g-desc="' + esc(g.d) + '"' +
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
      el.innerHTML = '<p class="search-empty">Nothing yet — but you could <a href="/blog/start-a-group/">start one</a>.</p>';
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
    var searchTimer = null, trackTimer = null, lastCount = 0;

    // Runs the search. Resolves with the result list, or null if the box was
    // cleared, changed while loading, or the list failed to load.
    function run(immediate) {
      var q = o.input.value.trim();
      clearTimeout(searchTimer);
      clearTimeout(trackTimer);
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
          load().then(function (groups) {
            if (o.input.value.trim() !== q) return resolve(null);
            var list = rank(groups, q);
            lastCount = list.length;
            render(o.results, list, o.source, false);
            o.results.hidden = false;
            window.announce(countText(list.length));
            resolve(list);
          }, function () {
            o.results.innerHTML = '<p class="search-empty">Search didn’t load. Check your connection and try again.</p>';
            o.results.hidden = false;
            window.announce('Search didn’t load');
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
  var navigating = false;

  // Prefetch into cache on hover
  document.addEventListener('pointerenter', function(e) {
    if (!e.target || !e.target.closest) return;
    var link = e.target.closest('a[href^="/"]');
    if (!link || link.onclick || link.closest('form')) return;
    var href = link.getAttribute('href');
    if (href && !pageCache[href] && href !== window.location.pathname) {
      pageCache[href] = fetch(href).then(function(r) { return r.text(); });
    }
  }, true);

  // Also on pointerdown as safety net
  document.addEventListener('pointerdown', function(e) {
    var link = e.target.closest('a[href^="/"]');
    if (!link || link.onclick || link.closest('form')) return;
    var href = link.getAttribute('href');
    if (href && !pageCache[href] && href !== window.location.pathname) {
      pageCache[href] = fetch(href).then(function(r) { return r.text(); });
    }
  }, true);

  // Intercept clicks on internal links
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href^="/"]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var href = link.getAttribute('href');
    if (!href || href.indexOf('#') === 0) return;
    // Extract path and hash separately
    var hashIdx = href.indexOf('#');
    var path = hashIdx >= 0 ? href.substring(0, hashIdx) : href;
    var hash = hashIdx >= 0 ? href.substring(hashIdx) : '';
    if ((!path || path === window.location.pathname) && hash) return; // same-page anchor, let browser handle
    if (!path || path === window.location.pathname) return;
    if (link.onclick || link.closest('form')) return;

    e.preventDefault();
    if (navigating) return;
    navigating = true;

    var promise = pageCache[path] || fetch(path).then(function(r) { return r.text(); });
    pageCache[path] = promise;

    promise.then(function(html) {
      swap(html, path, hash);
      history.pushState(null, '', href);
      if (typeof umami !== 'undefined' && umami.track) {
        umami.track(function(props) { return { ...props, url: href }; });
      }
      navigating = false;
    }).catch(function() {
      window.location.href = href;
    });
  });

  // Handle browser back/forward
  window.addEventListener('popstate', function() {
    var href = window.location.pathname;
    var promise = pageCache[href] || fetch(href).then(function(r) { return r.text(); });
    promise.then(function(html) { swap(html, href); });
  });

  function swap(html, href, hash) {
    var doc = new DOMParser().parseFromString(html, 'text/html');

    // Links inside a dialog (e.g. "See all", "Take me there") navigate in place:
    // close any open dialog and release the inert page before swapping.
    ['group-modal', 'surprise-modal'].forEach(function(id) {
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

    // Swap body class (homepage vs category-page)
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

    // Close topbar menus after navigation
    var browseEl = document.getElementById('topbar-browse');
    if (browseEl) browseEl.classList.remove('open');
    var mobileMenu = document.getElementById('topbar-mobile-menu');
    if (mobileMenu) mobileMenu.classList.remove('open');

    // Scroll to hash target or top
    var scrollTarget = hash && document.getElementById(hash.slice(1));
    if (scrollTarget) {
      scrollTarget.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }

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
  function markTabs(path) {
    var tabs = document.querySelectorAll('.tabs a.tab');
    var match = null;
    tabs.forEach(function(tab) {
      var href = tab.getAttribute('href');
      if (href !== '/' && path.indexOf(href) === 0) match = tab;
    });
    if (!match) match = tabs[0];
    tabs.forEach(function(tab) {
      if (tab === match) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    // Phones: Blog and About live under "More", so mark the match there too.
    var inMore = false;
    document.querySelectorAll('.tabs-more-menu a').forEach(function(a) {
      var current = !!match && a.getAttribute('href') === match.getAttribute('href');
      if (current) { a.setAttribute('aria-current', 'page'); inMore = true; }
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
          setTimeout(function() { showVerifyToast(groupName, visitLink.href, category); }, 600);
        }
        card.addEventListener('click', activateCard);
      }
    });

    // Legacy: Make h2 titles clickable (non-card pages)
    document.querySelectorAll('.content h2').forEach(function(h2) {
      if (h2._bound || h2.closest('.group-card')) return;
      h2._bound = true;
      var sibling = h2.nextElementSibling;
      while (sibling && sibling.tagName !== 'H2' && sibling.tagName !== 'HR') {
        if (sibling.tagName === 'UL') {
          var extLink = sibling.querySelector('a[href^="http"]');
          if (extLink) {
            h2.style.cursor = 'pointer';
            h2.setAttribute('tabindex', '0');
            h2.setAttribute('role', 'link');
            function activateH2(e) {
              if (e.target.tagName === 'A') return;
              window.open(extLink.href, '_blank', 'noopener');
              var category = window.location.pathname.replace(/^\/|\/$/g, '');
              var groupName = h2.textContent.replace(/\s*\(opens in new tab\)/, '').replace(/\s*#\s*$/, '').trim();
              setTimeout(function() { showVerifyToast(groupName, extLink.href, category); }, 600);
            }
            h2.addEventListener('click', activateH2);
            h2.addEventListener('keydown', function(e) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateH2(e); }
            });
            break;
          }
        }
        sibling = sibling.nextElementSibling;
      }
    });

    // Show all categories button (mobile)
    var showAllBtn = document.getElementById('show-all-cats');
    if (showAllBtn && !showAllBtn._bound) {
      showAllBtn._bound = true;
      showAllBtn.addEventListener('click', function() {
        document.querySelectorAll('.hp-cat-group').forEach(function(g) { g.classList.add('show'); });
        showAllBtn.style.display = 'none';
      });
    }

    // Topbar Browse dropdown
    var browseEl = document.getElementById('topbar-browse');
    if (browseEl && !browseEl._bound) {
      browseEl._bound = true;
      var browseBtn = browseEl.querySelector('.topbar-browse-btn');
      browseBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = browseEl.classList.toggle('open');
        browseBtn.setAttribute('aria-expanded', isOpen);
      });
      // Close on outside click
      document.addEventListener('click', function(e) {
        if (!browseEl.contains(e.target)) {
          browseEl.classList.remove('open');
          browseBtn.setAttribute('aria-expanded', 'false');
        }
      });
      // Close on Escape
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && browseEl.classList.contains('open')) {
          browseEl.classList.remove('open');
          browseBtn.setAttribute('aria-expanded', 'false');
          browseBtn.focus();
        }
      });
    }

    // Topbar mobile hamburger
    var hamburger = document.getElementById('topbar-hamburger');
    var mobileMenu = document.getElementById('topbar-mobile-menu');
    if (hamburger && mobileMenu && !hamburger._bound) {
      hamburger._bound = true;
      hamburger.addEventListener('click', function() {
        var isOpen = mobileMenu.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', isOpen);
      });
    }

    // Close mobile menu after page swap
    if (mobileMenu && mobileMenu.classList.contains('open')) {
      mobileMenu.classList.remove('open');
      if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    }

    // Newsletter signup
    document.querySelectorAll('.newsletter-form').forEach(function(form) {
      if (form._bound) return;
      form._bound = true;
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var input = form.querySelector('.newsletter-input');
        var btn = form.querySelector('.newsletter-btn');
        var btnLabel = btn.textContent;
        // Status span might be inside the form's parent container (not inside the form itself)
        var container = form.closest('.hp-newsletter, .category-newsletter, .newsletter-card') || form.parentElement;
        var status = container.querySelector('.newsletter-status');
        var email = input.value.trim();
        if (!email) return;
        btn.disabled = true;
        btn.textContent = 'Subscribing...';
        var source = window.location.pathname.replace(/^\/|\/$/g, '') || 'homepage';
        fetch('https://vancouver-community-newsletter.recipekit.workers.dev/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, source: source })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.success) {
            if (status) {
              status.className = 'newsletter-status success';
              status.textContent = "You're in! We'll be in touch.";
            }
            input.value = '';
            if (typeof umami !== 'undefined') umami.track('newsletter-signup', { source: source });
          } else {
            throw new Error(data.error || 'Something went wrong');
          }
        }).catch(function(err) {
          if (status) {
            status.className = 'newsletter-status error';
            status.textContent = err.message || 'Could not subscribe. Try again?';
          }
        }).finally(function() {
          btn.disabled = false;
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
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener');
      var h2 = card.querySelector('h3');
      var groupName = h2 ? h2.textContent.replace(/\s*\(opens in new tab\)/, '').replace(/\s*#\s*$/, '').trim() : '';
      if (groupName) {
        var category = window.location.pathname.replace(/^\/|\/$/g, '');
        setTimeout(function() { showVerifyToast(groupName, link.href, category); }, 600);
      }
      return;
    }

    // Legacy: "Find it" links (links inside list items in content)
    var li = link.closest('li');
    if (!li) return;

    var groupName = '';
    var el = li.closest('ul');
    while (el && el.previousElementSibling) {
      el = el.previousElementSibling;
      if (el.tagName === 'H2') {
        groupName = el.textContent.replace(/\s*\(opens in new tab\)/, '').replace(/\s*#\s*$/, '').trim();
        break;
      }
    }
    if (!groupName) return;

    e.preventDefault();
    window.open(link.href, '_blank', 'noopener');

    var category = window.location.pathname.replace(/^\/|\/$/g, '');
    setTimeout(function() {
      showVerifyToast(groupName, link.href, category);
    }, 600);
  });

  function escapeHtml(str) {
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function showVerifyToast(groupName, url, category) {
    // Remove any existing toast
    var existing = document.getElementById('verify-toast');
    if (existing) existing.remove();

    var safeName = escapeHtml(groupName);
    var toast = document.createElement('div');
    toast.id = 'verify-toast';
    toast.className = 'verify-toast';
    toast.setAttribute('role', 'region');
    toast.setAttribute('aria-label', 'Check this listing: ' + groupName);
    toast.innerHTML =
      '<div class="verify-toast-inner">' +
        '<p class="verify-toast-question">Anything wrong with <strong>' + safeName + '</strong>?</p>' +
        '<p class="verify-toast-subtitle">Dead link, wrong info, closed group — anything helps.</p>' +
        '<div class="verify-toast-actions">' +
          '<button class="verify-btn verify-btn-yes" data-status="active">Looks good</button>' +
          '<button class="verify-btn verify-btn-no" data-status="issue">Report an issue</button>' +
          '<button class="verify-btn verify-btn-dismiss" aria-label="Dismiss">&times;</button>' +
        '</div>' +
        '<div class="verify-toast-detail" style="display:none">' +
          '<input type="text" class="verify-detail-input" aria-label="What is wrong with ' + safeName.replace(/"/g, '&quot;') + '?" placeholder="e.g. link is broken, wrong meeting time, group shut down">' +
          '<button class="verify-btn verify-btn-send">Send</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(toast);
    window.announce('Anything wrong with ' + groupName + '? Options are at the bottom of the page.');

    // Animate in
    requestAnimationFrame(function() {
      toast.classList.add('visible');
    });

    // Dismiss on X button
    toast.querySelector('.verify-btn-dismiss').addEventListener('click', function() {
      dismissToast(toast);
    });

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

    // Send detail
    toast.querySelector('.verify-btn-send').addEventListener('click', function() {
      var input = toast.querySelector('.verify-detail-input');
      var detail = input.value.trim();
      if (!detail) { input.focus(); return; }
      sendVerification(groupName, url, category, 'issue', detail);
      showToastThanks(toast);
    });

    // Also submit on Enter in the detail input
    toast.querySelector('.verify-detail-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        toast.querySelector('.verify-btn-send').click();
      }
    });

    // Escape key to dismiss
    function onEscape(e) {
      if (e.key === 'Escape') { dismissToast(toast); document.removeEventListener('keydown', onEscape); }
    }
    document.addEventListener('keydown', onEscape);

    // Auto-dismiss after 15 seconds if no interaction
    var autoDismiss = setTimeout(function() { dismissToast(toast); }, 15000);
    toast.querySelector('.verify-toast-inner').addEventListener('click', function() { clearTimeout(autoDismiss); });
  }

  function showToastThanks(toast) {
    var category = window.location.pathname.replace(/^\/|\/$/g, '') || 'homepage';
    var inner = toast.querySelector('.verify-toast-inner');
    inner.innerHTML =
      '<p class="verify-toast-thanks">Thanks, that helps keep this list accurate.</p>' +
      '<div class="verify-toast-funnel">' +
        '<a href="#" class="verify-funnel-link" onclick="sharePage(\'' + category + '-verify\', this); return false;">Tell a friend about this list</a>' +
      '</div>';

    var autoDismiss = setTimeout(function() { dismissToast(toast); }, 5000);
    inner.addEventListener('click', function() { clearTimeout(autoDismiss); });
  }

  function dismissToast(toast) {
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
    setTimeout(function () { if (m.parentNode) m.remove(); }, 180);
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
  }

  window.openGroupModal = function (g) {
    lastFocus = document.activeElement;
    var existing = document.getElementById("group-modal");
    if (existing) existing.remove();

    var domain = "";
    if (g.url) { try { domain = new URL(g.url).hostname.replace(/^www\./, ""); } catch (e) {} }

    var m = document.createElement("div");
    m.id = "group-modal";
    m.className = "group-modal";
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-modal", "true");
    m.setAttribute("aria-label", g.name || "Group details");
    m.setAttribute("tabindex", "-1");

    var html = '<div class="group-modal-inner">';
    html += '<button class="group-modal-close" aria-label="Close">&times;</button>';
    if (g.cat) {
      html += '<a class="group-modal-cat" href="/' + esc(g.slug) + '/">' + esc(g.cat) + '</a>';
    }
    html += '<h2 class="group-modal-name">' + esc(g.name) + '</h2>';
    if (g.badge) html += '<span class="group-modal-badge">' + esc(g.badge) + '</span>';
    if (g.desc) html += '<p class="group-modal-desc">' + esc(g.desc) + '</p>';
    if (g.where) html += '<p class="group-modal-where">\uD83D\uDCCD ' + esc(g.where) + '</p>';
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
    });
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.getElementById("group-modal")) close();
  });
})();
