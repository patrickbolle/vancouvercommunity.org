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

    // Scroll to hash target or top
    var scrollTarget = hash && document.getElementById(hash.slice(1));
    if (scrollTarget) {
      scrollTarget.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }

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

  // --- Outbound link verification toast ---

  document.addEventListener('click', function(e) {
    var link = e.target.closest('.content a[href^="http"]');
    if (!link) return;

    // Only target "Find it" links (links inside list items in content)
    var li = link.closest('li');
    if (!li) return;

    // Find the group name from the nearest h2
    var groupName = '';
    var el = li.closest('ul');
    while (el && el.previousElementSibling) {
      el = el.previousElementSibling;
      if (el.tagName === 'H2') {
        groupName = el.textContent.replace(/\s*#\s*$/, '').trim();
        break;
      }
    }
    if (!groupName) return;

    // Open link in new tab so user stays on page
    e.preventDefault();
    window.open(link.href, '_blank', 'noopener');

    // Show feedback toast after a short delay
    var category = window.location.pathname.replace(/^\/|\/$/g, '');
    setTimeout(function() {
      showVerifyToast(groupName, link.href, category);
    }, 600);
  });

  function showVerifyToast(groupName, url, category) {
    // Remove any existing toast
    var existing = document.getElementById('verify-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'verify-toast';
    toast.className = 'verify-toast';
    toast.innerHTML =
      '<div class="verify-toast-inner">' +
        '<p class="verify-toast-question">Anything wrong with <strong>' + groupName + '</strong>?</p>' +
        '<p class="verify-toast-subtitle">Dead link, wrong info, closed group — anything helps.</p>' +
        '<div class="verify-toast-actions">' +
          '<button class="verify-btn verify-btn-yes" data-status="active">Looks good</button>' +
          '<button class="verify-btn verify-btn-no" data-status="issue">Report an issue</button>' +
          '<button class="verify-btn verify-btn-dismiss" aria-label="Dismiss">&times;</button>' +
        '</div>' +
        '<div class="verify-toast-detail" style="display:none">' +
          '<input type="text" class="verify-detail-input" placeholder="e.g. link is broken, wrong meeting time, group shut down">' +
          '<button class="verify-btn verify-btn-send">Send</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(function() {
      toast.classList.add('visible');
    });

    // Dismiss on backdrop click
    toast.addEventListener('click', function(e) {
      if (e.target === toast) dismissToast(toast);
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

    // Auto-dismiss after 15 seconds if no interaction
    var autoDismiss = setTimeout(function() { dismissToast(toast); }, 15000);
    toast.querySelector('.verify-toast-inner').addEventListener('click', function() { clearTimeout(autoDismiss); });
  }

  function showToastThanks(toast) {
    toast.querySelector('.verify-toast-inner').innerHTML =
      '<p class="verify-toast-thanks">Thanks, that helps keep this list accurate \u2764\ufe0f</p>';
    setTimeout(function() { dismissToast(toast); }, 1200);
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
