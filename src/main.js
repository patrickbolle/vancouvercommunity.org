document.addEventListener('DOMContentLoaded', function() {
  // Scroll sidebar to show active category
  var activeLink = document.querySelector('.sidebar li a.active');
  var sidebarList = document.querySelector('.sidebar ul');
  if (activeLink && sidebarList) {
    var linkTop = activeLink.offsetTop;
    var visibleHeight = sidebarList.clientHeight;
    sidebarList.scrollTop = Math.max(0, linkTop - visibleHeight / 3);
  }

  // Sidebar scroll hint — hide when user has scrolled near the bottom
  var scrollHint = document.getElementById('sidebar-scroll-hint');
  if (sidebarList && scrollHint) {
    function checkScroll() {
      var atBottom = sidebarList.scrollTop + sidebarList.clientHeight >= sidebarList.scrollHeight - 40;
      scrollHint.classList.toggle('hidden', atBottom);
    }
    checkScroll();
    sidebarList.addEventListener('scroll', checkScroll, { passive: true });
  }

  // Make h2 titles clickable (navigates to their anchor)
  document.querySelectorAll('.content h2').forEach(function(h2) {
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

  // Sidebar toggle (mobile)
  var toggle = document.querySelector('.sidebar-toggle');
  var sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function() {
      var open = sidebar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      toggle.textContent = open ? 'Hide categories' : 'Browse categories';
    });
  }

  // Homepage search — filter grouped category list
  var homepageSearch = document.getElementById('homepage-search');
  var _searchTimer = null;
  if (homepageSearch) {
    homepageSearch.addEventListener('input', function() {
      var q = this.value.toLowerCase();
      // Track search with debounce
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

  // Filter sidebar links by query
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

  // Prefetch pages on hover for instant navigation
  var prefetched = {};
  document.addEventListener('pointerenter', function(e) {
    var link = e.target.closest('a[href^="/"]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (prefetched[href] || href === window.location.pathname) return;
    prefetched[href] = true;
    var prefetchLink = document.createElement('link');
    prefetchLink.rel = 'prefetch';
    prefetchLink.href = href;
    document.head.appendChild(prefetchLink);
  }, true);
});
