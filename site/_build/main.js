document.addEventListener('DOMContentLoaded', function() {
  initPage();

  // --- Instant navigation: fetch HTML, swap only <main> ---
  var pageCache = {};
  var navigating = false;

  // Prefetch into cache on hover
  document.addEventListener('pointerenter', function(e) {
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
    if (!href || href === window.location.pathname || href.indexOf('#') === 0) return;
    if (link.onclick || link.closest('form')) return;

    e.preventDefault();
    if (navigating) return;
    navigating = true;

    var promise = pageCache[href] || fetch(href).then(function(r) { return r.text(); });
    pageCache[href] = promise;

    promise.then(function(html) {
      swap(html, href);
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

  function swap(html, href) {
    var doc = new DOMParser().parseFromString(html, 'text/html');

    // Swap main content
    var newMain = doc.querySelector('main');
    var oldMain = document.querySelector('main');
    if (newMain && oldMain) {
      oldMain.replaceWith(newMain);
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

    // Update sidebar active state
    var slug = href.replace(/^\/|\/$/g, '') || '';
    document.querySelectorAll('.sidebar li a').forEach(function(a) {
      var linkSlug = a.getAttribute('href').replace(/^\/|\/$/g, '');
      a.classList.toggle('active', linkSlug === slug);
    });

    // Scroll sidebar to active link
    var activeLink = document.querySelector('.sidebar li a.active');
    var sidebarList = document.querySelector('.sidebar ul');
    if (activeLink && sidebarList) {
      sidebarList.scrollTop = Math.max(0, activeLink.offsetTop - sidebarList.clientHeight / 3);
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Re-init page behaviors
    initPage();

    // Update page views from cached stats
    if (window._statsData) {
      var el = document.getElementById('page-views');
      if (el) {
        var views = window._statsData.pages[href] || 0;
        el.textContent = views.toLocaleString() + ' views';
      }
    }
  }

  // --- Page behaviors (run on load + after each swap) ---

  function initPage() {
    // Make h2 titles clickable
    document.querySelectorAll('.content h2').forEach(function(h2) {
      if (h2._bound) return;
      h2._bound = true;
      var anchor = h2.querySelector('a[href^="#"]');
      if (anchor) {
        h2.style.cursor = 'pointer';
        h2.addEventListener('click', function(e) {
          if (e.target.tagName !== 'A') {
            window.location.hash = anchor.getAttribute('href').slice(1);
          }
        });
      }
    });

    // Sidebar scroll hint
    var scrollHint = document.getElementById('sidebar-scroll-hint');
    var sidebarList = document.querySelector('.sidebar ul');
    if (sidebarList && scrollHint && !sidebarList._bound) {
      sidebarList._bound = true;
      function checkScroll() {
        var atBottom = sidebarList.scrollTop + sidebarList.clientHeight >= sidebarList.scrollHeight - 40;
        scrollHint.classList.toggle('hidden', atBottom);
      }
      checkScroll();
      sidebarList.addEventListener('scroll', checkScroll, { passive: true });
    }

    // Sidebar toggle (mobile)
    var toggle = document.querySelector('.sidebar-toggle');
    var sidebar = document.getElementById('sidebar');
    if (toggle && sidebar && !toggle._bound) {
      toggle._bound = true;
      toggle.addEventListener('click', function() {
        var open = sidebar.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open);
        toggle.textContent = open ? 'Hide categories' : 'Browse categories';
      });
    }

    // Close mobile sidebar after swap
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Browse categories';
      }
    }

    // Homepage search
    var homepageSearch = document.getElementById('homepage-search');
    var _searchTimer = null;
    if (homepageSearch && !homepageSearch._bound) {
      homepageSearch._bound = true;
      homepageSearch.addEventListener('input', function() {
        var q = this.value.toLowerCase();
        clearTimeout(_searchTimer);
        if (q.length >= 2) {
          _searchTimer = setTimeout(function() {
            if (typeof umami !== 'undefined') umami.track('search', { query: q });
          }, 800);
        }
        document.querySelectorAll('.cat-group').forEach(function(group) {
          var anyVisible = false;
          group.querySelectorAll('li').forEach(function(li) {
            var match = li.textContent.toLowerCase().indexOf(q) !== -1;
            li.style.display = match ? '' : 'none';
            if (match) anyVisible = true;
          });
          group.style.display = anyVisible ? '' : 'none';
        });
        filterSidebarLinks(q);
      });
    }

    // Scroll sidebar to active on initial load
    var activeLink = document.querySelector('.sidebar li a.active');
    var sidebarList = document.querySelector('.sidebar ul');
    if (activeLink && sidebarList) {
      sidebarList.scrollTop = Math.max(0, activeLink.offsetTop - sidebarList.clientHeight / 3);
    }
  }

  function filterSidebarLinks(q) {
    var links = document.querySelectorAll('.sidebar li');
    if (!q) {
      links.forEach(function(li) { li.style.display = ''; });
      return;
    }
    links.forEach(function(li) {
      var text = li.textContent.toLowerCase();
      li.style.display = text.indexOf(q) !== -1 ? '' : 'none';
    });
  }
});
