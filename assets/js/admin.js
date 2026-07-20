/**
 * Dhruval Admin Command Palette JS
 */
(function($) {
  'use strict';

  // Stop words to filter out of search query and vectorization
  const stopWords = new Set([
    'i', 'want', 'to', 'how', 'do', 'can', 'should', 'the', 'a', 'an', 'on', 'in',
    'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'my',
    'our', 'your', 'their', 'his', 'her', 'its', 'set', 'change', 'configure',
    'setup', 'add', 'create', 'make', 'install', 'get', 'find', 'search', 'please',
    'need', 'know', 'show', 'view', 'go', 'last', 'days', 'for', 'about', 'some', 'see', 'modify'
  ]);

  // Stemmer function for matching root words (e.g. orders -> order, shipping -> ship)
  function stem(word) {
    word = word.toLowerCase().trim();
    if (word.length <= 2) return word;
    
    if (word.endsWith('sses')) return word.slice(0, -2);
    if (word.endsWith('ies')) return word.slice(0, -3) + 'i';
    if (word.endsWith('ss')) return word;
    if (word.endsWith('s') && !word.endsWith('us') && !word.endsWith('is') && !word.endsWith('as')) return word.slice(0, -1);
    
    if (word.endsWith('eed')) {
      if (word.length > 4) return word.slice(0, -1);
    }
    if (word.endsWith('ing')) {
      const base = word.slice(0, -3);
      if (/[aeiou]/.test(base)) return base;
    }
    if (word.endsWith('ed')) {
      const base = word.slice(0, -2);
      if (/[aeiou]/.test(base)) return base;
    }
    if (word.endsWith('y') && word.length > 3) {
      const vowels = ['a','e','i','o','u'];
      if (!vowels.includes(word.charAt(word.length - 2))) {
        return word.slice(0, -1) + 'i';
      }
    }
    if (word.endsWith('tional')) return word.slice(0, -6) + 'tion';
    if (word.endsWith('ment')) return word.slice(0, -4);
    if (word.endsWith('ability')) return word.slice(0, -5) + 'able';
    if (word.endsWith('fully')) return word.slice(0, -5);
    if (word.endsWith('ly')) return word.slice(0, -2);
    
    return word;
  }

  // Tokenize and stem helper
  function tokenizeAndStem(text) {
    return text
      .toLowerCase()
      .split(/[\s,.\-!?_›>]+/)
      .map(w => w.trim())
      .filter(w => w.length > 1)
      .map(stem)
      .filter(w => !stopWords.has(w));
  }

  // TF-IDF engine
  class TfIdfEngine {
    constructor(pages) {
      this.pages = pages;
      this.vocab = new Set();
      this.docTermFreqs = [];
      this.df = {};
      this.idf = {};
      this.docVectors = [];
      this.train();
    }
    
    train() {
      try {
        const N = this.pages.length;
        
        this.pages.forEach((page) => {
          if (!page) return;
          const kws = Array.isArray(page.keywords) ? page.keywords.join(' ') : 
                      (page.keywords && typeof page.keywords === 'object' ? Object.values(page.keywords).join(' ') : '');
          const docText = `${page.title || ''} ${page.plugin || ''} ${page.path || ''} ${page.description || ''} ${kws}`;
          const tokens = tokenizeAndStem(docText);
          
          const termCounts = {};
          tokens.forEach(token => {
            termCounts[token] = (termCounts[token] || 0) + 1;
            this.vocab.add(token);
          });
          
          this.docTermFreqs.push(termCounts);
          
          Object.keys(termCounts).forEach(term => {
            this.df[term] = (this.df[term] || 0) + 1;
          });
        });
        
        this.vocab.forEach(term => {
          this.idf[term] = Math.log(1 + (N / (1 + (this.df[term] || 0))));
        });
        
        this.docVectors = this.docTermFreqs.map((termCounts) => {
          const vector = {};
          let sumSquares = 0;
          
          Object.keys(termCounts).forEach(term => {
            const tf = termCounts[term];
            const tfidf = tf * this.idf[term];
            vector[term] = tfidf;
            sumSquares += tfidf * tfidf;
          });
          
          const magnitude = Math.sqrt(sumSquares);
          const normalizedVector = {};
          
          if (magnitude > 0) {
            Object.keys(vector).forEach(term => {
              normalizedVector[term] = vector[term] / magnitude;
            });
          }
          
          return normalizedVector;
        });
      } catch (e) {
        console.error('Error training TF-IDF search engine:', e);
      }
    }

    search(query) {
      try {
        const syntheticPages = [];
        const adminUrl = dacpData.adminUrl || '';
        const homeUrl = adminUrl.replace('wp-admin/', '');

        // 1. ID Parameter extraction (e.g. "user id 5", "post id 10", "order 20", "id 5")
        const idMatch = query.match(/(?:user|post|page|order|id)\s+(?:id\s+)?(\d+)/i) || query.match(/\bid\s+(\d+)/i);
        if (idMatch) {
          const id = idMatch[1];
          if (/user|role|member/i.test(query)) {
            syntheticPages.push({
              title: `Edit User Profile (ID: #${id})`,
              path: "Users › Edit User",
              url: adminUrl + `user-edit.php?user_id=${id}`,
              plugin: "WordPress Core",
              description: `Direct link to edit user profile information, email, and security roles for User ID ${id}.`,
              keywords: ["user", "role", "profile", "edit", id]
            });
          } else if (/order|purchase/i.test(query)) {
            // Check if WooCommerce uses custom URL page=wc-orders (HPOS) or post.php (legacy)
            const wcOrdersPage = (dacpData.pages || []).find(p => p.url && p.url.includes('page=wc-orders'));
            const orderEditUrl = wcOrdersPage ? (adminUrl + `admin.php?page=wc-orders&action=edit&id=${id}`) : (adminUrl + `post.php?post=${id}&action=edit`);
            
            syntheticPages.push({
              title: `Edit WooCommerce Order (ID: #${id})`,
              path: "WooCommerce › Orders › Edit Order",
              url: orderEditUrl,
              plugin: "WooCommerce",
              description: `Direct link to edit billing details, shipping, products, and order status for Order ID ${id}.`,
              keywords: ["order", "purchase", "billing", "edit", id]
            });
          } else {
            // General post/page edit
            syntheticPages.push({
              title: `Edit Post / Page (ID: #${id})`,
              path: "Posts › Edit Item",
              url: adminUrl + `post.php?post=${id}&action=edit`,
              plugin: "WordPress Core",
              description: `Direct link to edit WordPress Post or Page ID ${id} inside the editor.`,
              keywords: ["post", "page", "edit", "editor", id]
            });
          }
        }

        // 2. Email Parameter extraction (e.g. "orders from email xyz@test.com")
        const emailMatch = query.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
        if (emailMatch) {
          const email = emailMatch[1];
          if (/order|purchase|billing|sale/i.test(query)) {
            // Check if WooCommerce uses wc-orders page
            const wcOrdersPage = (dacpData.pages || []).find(p => p.url && p.url.includes('page=wc-orders'));
            const ordersSearchUrl = wcOrdersPage ? (adminUrl + `admin.php?page=wc-orders&s=` + encodeURIComponent(email)) : (adminUrl + `edit.php?post_type=shop_order&s=` + encodeURIComponent(email));
            
            syntheticPages.push({
              title: `Search Orders for "${email}"`,
              path: "WooCommerce › Orders › Search",
              url: ordersSearchUrl,
              plugin: "WooCommerce",
              description: `Search WooCommerce transaction records and purchase history matching email "${email}".`,
              keywords: ["order", "purchase", "search", "email", email]
            });
          } else {
            // Default to user/customer search
            syntheticPages.push({
              title: `Search Users for "${email}"`,
              path: "Users › All Users › Search",
              url: adminUrl + `users.php?s=` + encodeURIComponent(email),
              plugin: "WordPress Core",
              description: `Search the WordPress user database for profiles matching email "${email}".`,
              keywords: ["user", "search", "email", email]
            });
          }
        }

        // 3. Name Parameter extraction (e.g. "property with name abcd", "page named contact")
        const nameMatch = query.match(/(?:name|named|called)\s+["']?([^"'\s]+)["']?/i) || 
                            query.match(/(?:property|post|page|cpt)\s+["']?([a-zA-Z0-9_-]+)["']?/i);
                            
        if (nameMatch && !idMatch && !emailMatch) {
          const name = nameMatch[1];
          let postType = "post";
          let postTypeLabel = "Post";
          let postTypePlural = "Posts";
          let pluginName = "WordPress Core";
          
          if (/property/i.test(query)) {
            postType = "property";
            postTypeLabel = "Property";
            postTypePlural = "Properties";
            pluginName = "Custom Post Type";
          } else if (/page/i.test(query)) {
            postType = "page";
            postTypeLabel = "Page";
            postTypePlural = "Pages";
          } else if (/post/i.test(query)) {
            postType = "post";
            postTypeLabel = "Post";
            postTypePlural = "Posts";
          } else if (/product/i.test(query)) {
            postType = "product";
            postTypeLabel = "Product";
            postTypePlural = "Products";
            pluginName = "WooCommerce";
          }
          
          // Synthesize Admin Edit link
          syntheticPages.push({
            title: `Edit ${postTypePlural} matching "${name}"`,
            path: `${postTypePlural} › All ${postTypePlural} › Search`,
            url: adminUrl + `edit.php?post_type=${postType}&s=` + encodeURIComponent(name),
            plugin: pluginName,
            description: `Open the WordPress admin list for ${postTypePlural.toLowerCase()} and search for items named "${name}".`,
            keywords: [postType, "search", "edit", name]
          });
          
          // Synthesize Frontend view link
          syntheticPages.push({
            title: `View "${name}" ${postTypeLabel} on Frontend`,
            path: `Site Front › Search Results`,
            url: homeUrl + `?s=` + encodeURIComponent(name) + `&post_type=${postType}`,
            plugin: "Frontend Link",
            description: `Visit the public frontend search results for ${postTypePlural.toLowerCase()} matching "${name}".`,
            keywords: [postType, "frontend", "view", name]
          });
        }

        // --- Standard TF-IDF Search ---
        const queryTokens = tokenizeAndStem(query);
        if (queryTokens.length === 0) {
          return syntheticPages.slice(0, 5);
        }
        
        const queryTermCounts = {};
        queryTokens.forEach(token => {
          queryTermCounts[token] = (queryTermCounts[token] || 0) + 1;
        });
        
        const queryVector = {};
        let querySumSquares = 0;
        
        Object.keys(queryTermCounts).forEach(term => {
          const idf = this.idf[term] || 0;
          const tfidf = queryTermCounts[term] * idf;
          queryVector[term] = tfidf;
          querySumSquares += tfidf * tfidf;
        });
        
        const queryMagnitude = Math.sqrt(querySumSquares);
        if (queryMagnitude === 0) {
          return syntheticPages.slice(0, 5);
        }
        
        const results = this.pages.map((page, idx) => {
          const docVector = this.docVectors[idx];
          if (!docVector) return { page: page, score: 0 };
          
          let dotProduct = 0;
          
          Object.keys(queryVector).forEach(term => {
            if (docVector[term]) {
              dotProduct += queryVector[term] * docVector[term];
            }
          });
          
          let cosineSimilarity = dotProduct / queryMagnitude;
          
          // Contextual boosting
          let boost = 0;
          const queryLower = query.toLowerCase();
          const titleLower = (page.title || '').toLowerCase();
          const pluginLower = (page.plugin || '').toLowerCase();
          const pathLower = (page.path || '').toLowerCase();
          
          if (titleLower.includes(queryLower)) {
            boost += 60;
          } else if (pathLower.includes(queryLower)) {
            boost += 30;
          }
          
          // Exact keyword matching gives extra weight
          if (Array.isArray(page.keywords) && page.keywords.length > 0) {
            queryTokens.forEach(token => {
              if (page.keywords.includes(token)) boost += 15;
              if (titleLower.includes(token)) boost += 15;
              if (pluginLower.includes(token)) boost += 8;
            });
          } else if (page.keywords && typeof page.keywords === 'object') {
            const kwValues = Object.values(page.keywords);
            queryTokens.forEach(token => {
              if (kwValues.includes(token)) boost += 15;
              if (titleLower.includes(token)) boost += 15;
              if (pluginLower.includes(token)) boost += 8;
            });
          } else {
            queryTokens.forEach(token => {
              if (titleLower.includes(token)) boost += 15;
              if (pluginLower.includes(token)) boost += 8;
            });
          }
          
          const finalScore = (cosineSimilarity * 100) + boost;
          
          return {
            page: page,
            score: finalScore
          };
        });
        
        const sortedResults = results
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(r => r.page);
        
        // Merge synthetic deep links at the top
        return syntheticPages.concat(sortedResults).slice(0, 5);
      } catch (e) {
        console.error('Error in TF-IDF search:', e);
        return [];
      }
    }
  }

  // Main UI components
  let $modalOverlay;
  let $modalInput;
  let $modalResults;
  let $inlineInput;
  let $inlineResults;
  
  let activeIndex = -1;
  let wporgDebounceTimer = null;
  let currentResults = [];
  let tfIdfEngine = null;
  let activeWpOrgRequest = null;

  // Initialize
  $(document).ready(function() {
    initUI();
    bindEvents();
    if (dacpData && dacpData.pages) {
      tfIdfEngine = new TfIdfEngine(dacpData.pages);
    }
  });

  /**
   * Initialize UI references
   */
  function initUI() {
    $modalOverlay = $('#wp-admin-nav-palette');
    $modalInput = $('#wp-admin-nav-modal-search-input');
    $modalResults = $('#wp-admin-nav-modal-results');
    
    $inlineInput = $('#wp-admin-nav-inline-search-input');
    $inlineResults = $('#wp-admin-nav-inline-results');
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    // 1. Keyboard shortcut (Ctrl + K or Cmd + K)
    $(document).on('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleModal();
      }
    });

    // 2. Close modal on ESC key
    $(document).on('keydown', function(e) {
      if (e.key === 'Escape' && $modalOverlay.is(':visible')) {
        closeModal();
      }
    });

    // 3. Close modal when clicking backdrop
    $modalOverlay.on('click', function(e) {
      if (e.target === this) {
        closeModal();
      }
    });

    // 4. Modal search input typing
    $modalInput.on('input', function() {
      const query = $(this).val();
      handleSearch(query, $modalResults, true);
    });

    // 5. Inline search input typing
    $inlineInput.on('input', function() {
      const query = $(this).val();
      handleSearch(query, $inlineResults, false);
    });

    // 6. Keyboard navigation for modal results
    $modalInput.on('keydown', function(e) {
      const $cards = $modalResults.find('.wp-admin-nav-card');
      if ($cards.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        changeActiveIndex(1, $cards);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        changeActiveIndex(-1, $cards);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < $cards.length) {
          const url = $cards.eq(activeIndex).data('url');
          if (url) {
            window.location.href = url;
          }
        }
      }
    });
  }

  /**
   * Toggle Modal Command Palette
   */
  function toggleModal() {
    if ($modalOverlay.is(':visible')) {
      closeModal();
    } else {
      openModal();
    }
  }

  function openModal() {
    $modalOverlay.fadeIn(200);
    $modalInput.focus();
    $('body').css('overflow', 'hidden'); // Prevent scrolling body
    activeIndex = -1;
  }

  function closeModal() {
    $modalOverlay.fadeOut(150);
    $modalInput.val('');
    resetResults($modalResults, true);
    $('body').css('overflow', '');
    activeIndex = -1;
  }

  function resetResults($target, isModal) {
    if (isModal) {
      $target.html(`
        <div class="wp-admin-nav-initial-state">
          <span class="wp-admin-nav-state-icon">⚡</span>
          <p>${dacpData.i18n.searchPlaceholder}</p>
          <span class="wp-admin-nav-shortcut-badge">${dacpData.i18n.keyboardShortcutTip}</span>
        </div>
      `);
    } else {
      $target.html(`
        <div class="wp-admin-nav-initial-state">
          <span class="wp-admin-nav-state-icon">💡</span>
          <p>Start typing your request above to get suggestions...</p>
          <div class="wp-admin-nav-suggestions-hint">
            <strong>Try searching for:</strong>
            <ul>
              <li><code>set flat rate shipping on woo</code></li>
              <li><code>change permalink settings</code></li>
              <li><code>edit my profile information</code></li>
              <li><code>install a membership plugin</code></li>
            </ul>
          </div>
        </div>
      `);
    }
  }

  /**
   * Keyboard arrow key navigation helper
   */
  function changeActiveIndex(direction, $cards) {
    $cards.removeClass('active');
    
    activeIndex += direction;
    if (activeIndex >= $cards.length) {
      activeIndex = 0;
    } else if (activeIndex < 0) {
      activeIndex = $cards.length - 1;
    }

    const $activeCard = $cards.eq(activeIndex);
    $activeCard.addClass('active');
    
    // Scroll active card into view if needed
    const container = $activeCard.parent()[0];
    const cardEl = $activeCard[0];
    
    if (container && cardEl) {
      const containerTop = container.scrollTop;
      const containerBottom = containerTop + container.clientHeight;
      const elemTop = cardEl.offsetTop;
      const elemBottom = elemTop + cardEl.clientHeight;

      if (elemTop < containerTop) {
        container.scrollTop = elemTop - 10;
      } else if (elemBottom > containerBottom) {
        container.scrollTop = elemBottom - container.clientHeight + 10;
      }
    }
  }

  /**
   * Main Search Processor
   */
  function handleSearch(query, $resultsContainer, isModal) {
    clearTimeout(wporgDebounceTimer);
    
    // Abort any pending WordPress.org search requests to avoid race conditions
    if (activeWpOrgRequest) {
      activeWpOrgRequest.abort();
      activeWpOrgRequest = null;
    }
    
    activeIndex = -1;

    if (!query || query.trim().length < 2) {
      resetResults($resultsContainer, isModal);
      return;
    }

    // 1. Process local search
    const localResults = performLocalSearch(query);
    currentResults = localResults;

    // 2. Render local results and show WP.org loading state if a WP.org lookup is required
    const showWpOrg = localResults.length === 0 || isWpOrgTriggerQuery(query);
    if (showWpOrg) {
      // Immediately render local results with a spinner in the WP.org section to show active loading
      renderResults(localResults, $resultsContainer, query, [], true);
      
      wporgDebounceTimer = setTimeout(function() {
        searchWpOrg(query, $resultsContainer, localResults);
      }, 400);
    } else {
      // Show local results only (no WP.org search needed)
      renderResults(localResults, $resultsContainer, query, [], false);
    }
  }

  /**
   * Perform client-side intent matching with scoring
   */
  function performLocalSearch(query) {
    if (!tfIdfEngine) return [];
    return tfIdfEngine.search(query);
  }

  /**
   * Check if query indicates installing a new plugin
   */
  function isWpOrgTriggerQuery(query) {
    const q = query.toLowerCase();
    const triggers = ['install', 'plugin', 'download', 'plugin for', 'setup a new', 'add custom', 'wordpress.org', 'wporg'];
    return triggers.some(t => q.includes(t)) || q.length > 15;
  }

  /**
   * Render results inside the container
   */
  function renderResults(localPages, $container, query, wpOrgPlugins = [], isLoadingWpOrg = false) {
    $container.empty();

    if (localPages.length === 0 && wpOrgPlugins.length === 0 && !isLoadingWpOrg) {
      $container.html(`
        <div class="wp-admin-nav-no-results">
          <span class="wp-admin-nav-state-icon">⚠️</span>
          <p>${dacpData.i18n.noResults}</p>
          <span class="wp-admin-nav-shortcut-badge">Try typing different keywords or a general plugin search.</span>
        </div>
      `);
      return;
    }

    // Render local pages section
    if (localPages.length > 0) {
      $container.append(`<div class="wp-admin-nav-section-header">Admin Screens (${localPages.length})</div>`);
      
      const $localList = $('<div class="wp-admin-nav-results-sublist"></div>');
      localPages.forEach(function(page, idx) {
        const isCore = page.plugin === 'WordPress Core';
        const badgeClass = isCore ? 'wp-core' : '';
        const cardMarkup = `
          <div class="wp-admin-nav-card wp-admin-nav-fade-in" data-url="${page.url}" style="animation-delay: ${idx * 0.05}s">
            <div class="wp-admin-nav-card-left">
              <div class="wp-admin-nav-card-header">
                <h3 class="wp-admin-nav-card-title">${escapeHtml(page.title)}</h3>
                <span class="wp-admin-nav-badge ${badgeClass}">${escapeHtml(page.plugin)}</span>
              </div>
              <div class="wp-admin-nav-card-breadcrumbs">${escapeHtml(page.path)}</div>
              <p class="wp-admin-nav-card-desc">${escapeHtml(page.description)}</p>
            </div>
            <div class="wp-admin-nav-card-right">
              <a href="${page.url}" class="wp-admin-nav-btn wp-admin-nav-btn-primary">${dacpData.i18n.visitPage}</a>
            </div>
          </div>
        `;
        $localList.append(cardMarkup);
      });
      $container.append($localList);
    }

    // Render WP.org plugins section
    if (isLoadingWpOrg) {
      $container.append(`
        <div class="wp-admin-nav-section-header">${dacpData.i18n.wpOrgTitle}</div>
        <div class="wp-admin-nav-initial-state" style="padding: 20px;">
          <div class="wp-admin-nav-spinner"></div>
          <p style="font-size: 13px; color: var(--wp-nav-text-secondary);">${dacpData.i18n.searchingWpOrg}</p>
        </div>
      `);
    } else if (wpOrgPlugins.length > 0) {
      $container.append(`<div class="wp-admin-nav-section-header">${dacpData.i18n.wpOrgTitle}</div>`);
      
      const $pluginList = $('<div class="wp-admin-nav-results-sublist"></div>');
      wpOrgPlugins.forEach(function(plugin, idx) {
        // Strip HTML and decode entities
        const decodedName = decodeHtmlEntities(plugin.name);
        const decodedAuthor = stripTags(plugin.author);
        const decodedDesc = plugin.short_description ? stripTags(plugin.short_description) : '';
        
        const rating = plugin.rating ? (plugin.rating / 20).toFixed(1) : '0';
        const installs = plugin.active_installs ? formatNumber(plugin.active_installs) : '0';
        const installUrl = dacpData.adminUrl + 'plugin-install.php?tab=plugin-information&plugin=' + plugin.slug + '&TB_iframe=true&width=600&height=550';
        
        // Active and installed status detection
        const installedPlugins = dacpData.installedPlugins || [];
        const activePlugins = dacpData.activePlugins || [];
        const isInstalled = installedPlugins.includes(plugin.slug);
        const isActive = activePlugins.includes(plugin.slug);

        let btnMarkup = '';
        let targetUrl = installUrl;

        if (isActive) {
          btnMarkup = `<button class="wp-admin-nav-btn wp-admin-nav-btn-outline" disabled style="cursor: not-allowed; opacity: 0.6;">Active</button>`;
          targetUrl = '#';
        } else if (isInstalled) {
          const activateUrl = dacpData.adminUrl + 'plugins.php?s=' + encodeURIComponent(plugin.slug);
          btnMarkup = `<a href="${activateUrl}" class="wp-admin-nav-btn wp-admin-nav-btn-outline">Activate</a>`;
          targetUrl = activateUrl;
        } else {
          btnMarkup = `<a href="${installUrl}" class="wp-admin-nav-btn wp-admin-nav-btn-outline thickbox open-plugin-details">${dacpData.i18n.installPlugin}</a>`;
        }

        const cardMarkup = `
          <div class="wp-admin-nav-card wp-admin-nav-fade-in" data-url="${targetUrl}" style="animation-delay: ${idx * 0.05}s">
            <div class="wp-admin-nav-card-left">
              <div class="wp-admin-nav-card-header">
                <h3 class="wp-admin-nav-card-title">${escapeHtml(decodedName)}</h3>
                <span class="wp-admin-nav-badge wporg-plugin">WP.org</span>
              </div>
              <div class="wp-admin-nav-card-breadcrumbs">${dacpData.i18n.author} ${escapeHtml(decodedAuthor)}</div>
              <p class="wp-admin-nav-card-desc">${escapeHtml(decodedDesc)}</p>
              <div class="wp-admin-nav-wporg-stats">
                <div class="wp-admin-nav-wporg-stat">
                  <span class="star">★</span> ${rating} / 5
                </div>
                <div class="wp-admin-nav-wporg-stat">
                  👤 ${installs}+ ${dacpData.i18n.activeInstalls}
                </div>
              </div>
            </div>
            <div class="wp-admin-nav-card-right">
              ${btnMarkup}
            </div>
          </div>
        `;
        $pluginList.append(cardMarkup);
      });
      $container.append($pluginList);

      // Support WordPress Thickbox popup for plugin info
      if (typeof window.tb_init === 'function') {
        window.tb_init('.open-plugin-details');
      }
    }

    // Set card click behavior (clicking card navigates to url)
    $container.find('.wp-admin-nav-card').on('click', function(e) {
      if ($(e.target).closest('.wp-admin-nav-btn').length > 0) {
        return; // Let standard button href action handle it
      }
      const url = $(this).data('url');
      if (url) {
        window.location.href = url;
      }
    });
  }

  /**
   * Search WordPress.org Plugins API via AJAX (or proxy)
   */
  function searchWpOrg(query, $resultsContainer, localResults) {
    renderResults(localResults, $resultsContainer, query, [], true);

    // Prepare search term: strip stop words and join
    const cleanSearch = query.toLowerCase().split(/[\s,.\-!?]+/).filter(t => !stopWords.has(t)).join(' ');

    // Call AJAX action in WordPress
    if (typeof ajaxurl !== 'undefined') {
      activeWpOrgRequest = $.ajax({
        url: ajaxurl,
        type: 'GET',
        dataType: 'json',
        data: {
          action: 'dacp_search_wporg',
          search: cleanSearch,
          nonce: dacpData.nonce
        },
        success: function(response) {
          activeWpOrgRequest = null;
          if (response.success && response.data && response.data.plugins) {
            renderResults(localResults, $resultsContainer, query, response.data.plugins.slice(0, 3));
          } else {
            renderResults(localResults, $resultsContainer, query);
          }
        },
        error: function(xhr, status, error) {
          if (status === 'abort') return; // Do nothing if aborted
          activeWpOrgRequest = null;
          // Silent fallback to local results only
          renderResults(localResults, $resultsContainer, query);
        }
      });
    } else {
      // In the mock standalone demo, fetch directly (using a JSONP/CORS proxy or mock database fallback)
      mockWpOrgSearch(cleanSearch, function(mockPlugins) {
        renderResults(localResults, $resultsContainer, query, mockPlugins);
      });
    }
  }

  /**
   * Mock search database for standalone browser testing
   */
  function mockWpOrgSearch(search, callback) {
    // Basic mock data
    const allMocks = [
      {
        name: 'Paid Memberships Pro - Member Subscriptions',
        slug: 'paid-memberships-pro',
        author: 'Stranger Studios',
        short_description: 'Add membership levels, restrict content, and process recurring subscriptions. Built for subscription and membership businesses.',
        rating: 96,
        active_installs: 90000
      },
      {
        name: 'WooCommerce Subscriptions Manager',
        slug: 'woocommerce-subscriptions',
        author: 'WooCommerce',
        short_description: 'Allows you to introduce recurring payments and subscriptions to your WooCommerce store.',
        rating: 92,
        active_installs: 100000
      },
      {
        name: 'UpdraftPlus WordPress Backup Plugin',
        slug: 'updraftplus',
        author: 'UpdraftPlus.Com',
        short_description: 'Simplifies backups and restoration. Backup your files and database into the cloud and restore with a single click.',
        rating: 98,
        active_installs: 3000000
      },
      {
        name: 'Wordfence Security - Firewall & Malware Scan',
        slug: 'wordfence',
        author: 'Wordfence',
        short_description: 'Provides a website firewall, malware scanner, live traffic feeds, and robust login security features to keep your site safe.',
        rating: 94,
        active_installs: 4000000
      },
      {
        name: 'Contact Form 7',
        slug: 'contact-form-7',
        author: 'Takayuki Miyoshi',
        short_description: 'Just another contact form plugin. Simple, flexible, and manages multiple contact forms easily.',
        rating: 82,
        active_installs: 5000000
      }
    ];

    const matched = allMocks.filter(function(plugin) {
      const s = search.toLowerCase();
      return plugin.name.toLowerCase().includes(s) || 
             plugin.short_description.toLowerCase().includes(s) ||
             s.includes('member') && plugin.slug.includes('member') ||
             s.includes('subscri') && plugin.slug.includes('subscri') ||
             s.includes('backup') && plugin.slug.includes('updraft') ||
             s.includes('secur') && plugin.slug.includes('wordfence') ||
             s.includes('form') && plugin.slug.includes('contact');
    });

    setTimeout(function() {
      callback(matched.slice(0, 3));
    }, 400);
  }

  // Utilities
  function decodeHtmlEntities(str) {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Strictly sanitizes tags out of raw HTML
  function stripTags(html) {
    if (!html) return '';
    const decoded = decodeHtmlEntities(html);
    return decoded.replace(/<[^>]*>?/gm, '');
  }

  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'k';
    }
    return num.toString();
  }

})(jQuery);
