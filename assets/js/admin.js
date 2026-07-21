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
    'our', 'your', 'their', 'his', 'her', 'its',
    'setup', 'please', 'need', 'know', 'show', 'view', 'go', 'last', 'days', 'for', 'about', 'some', 'see'
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

  // Helper function to singularize words (e.g., properties -> property)
  function singularize(word) {
    word = word.toLowerCase().trim();
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es') && !word.endsWith('tes') && !word.endsWith('ses')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is')) return word.slice(0, -1);
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
        const cleanQuery = query.replace(/['’]s\b/gi, ''); // Clean possessives e.g., michael's -> michael
        const adminUrl = dacpData.adminUrl || '';
        const homeUrl = adminUrl.replace('wp-admin/', '');

        // Filler words list to prevent prepositions or noise words from being extracted as names
        const fillerWords = [
          'with', 'name', 'title', 'username', 'called', 'named', 'user', 'role', 'profile', 
          'account', 'id', 'email', 'a', 'an', 'the', 'my', 'all', 'new', 'is', 'for', 'whose',
          'that', 'this', 'these', 'those', 'which', 'starts', 'starting', 'begins', 'beginning',
          'ends', 'ending', 'contains', 'containing', 'having', 'like', 'delete', 'remove',
          'trash', 'edit', 'modify', 'view', 'show', 'search', 'find', 'product', 'post', 'page'
        ];

        // 1. User Name Extraction (e.g. "I want to edit user with name Michael", "user Michael", "edit michael's user")
        let userName = null;
        
        // Priority 1: Quoted string inside user query
        const userQuoteMatch = query.match(/(?:user|profile|account|member|role)\s+.*["']([^"']+)["']/i);
        if (userQuoteMatch) {
          const candidate = userQuoteMatch[1].trim();
          if (!fillerWords.includes(candidate.toLowerCase())) {
            userName = candidate;
          }
        }

        // Pattern A: "user with name Michael", "user named Michael", "user with username Michael", "user Michael"
        if (!userName) {
          const matchUserWith = query.match(/user\s+(?:(?:with\s+name|with\s+username|whose\s+name\s+is|named|called|is)\s+)?["']?([a-zA-Z0-9_-]+)["']?/i);
          if (matchUserWith) {
            const candidate = matchUserWith[1].trim();
            if (!fillerWords.includes(candidate.toLowerCase())) {
              userName = candidate;
            }
          }
        }
        
        // Pattern B: "name Michael", "with name Michael", "named Michael" anywhere if user keyword is present
        if (!userName && /user|profile|account|member|role/i.test(query)) {
          const nameExplicitMatch = query.match(/(?:with\s+name|name\s+is|named|called)\s+["']?([a-zA-Z0-9_-]+)["']?/i);
          if (nameExplicitMatch) {
            const candidate = nameExplicitMatch[1].trim();
            if (!fillerWords.includes(candidate.toLowerCase())) {
              userName = candidate;
            }
          }
        }
        
        // Pattern C: "edit Michael's user" or "modify Michael's profile"
        if (!userName) {
          const matchPossessive = query.match(/(?:edit|modify|change|find|view|show|see)\s+([a-zA-Z0-9_-]+)(?:'s|’s)?\s+(?:user|profile|account|role)/i);
          if (matchPossessive) {
            const candidate = matchPossessive[1].trim();
            if (!fillerWords.includes(candidate.toLowerCase())) {
              userName = candidate;
            }
          }
        }

        if (userName) {
          syntheticPages.push({
            title: `Search Users for "${userName}"`,
            path: "Users › All Users › Search",
            url: adminUrl + `users.php?s=` + encodeURIComponent(userName),
            plugin: "WordPress Core",
            description: `Search the WordPress user database for profiles matching "${userName}".`,
            keywords: ["user", "search", userName]
          });
        }

        // 2. ID Parameter extraction (e.g. "user id 5", "post id 10", "order 20", "id 5")
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

        // 3. Email Parameter extraction (e.g. "orders from email xyz@test.com")
        const emailMatch = query.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
        if (emailMatch) {
          const email = emailMatch[1];
          if (/order|purchase|billing|sale/i.test(query)) {
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
            syntheticPages.push({
              title: `Search Users for "${email}"`,
              path: "Users › All Users › Search",
              url: adminUrl + `users.php?s=` + encodeURIComponent(email),
              plugin: "WordPress Core",
              description: `Search the WordPress user database for profiles matching email "${email}".`,
              keywords: ["user", "search", email]
            });
          }
        }

        // 4. Plural & Post Type Listing extraction (e.g. "I want to see all available properties")
        const listMatch = query.match(/(?:see|view|show|list|all|manage)\s+(?:all\s+)?(?:available\s+)?([a-zA-Z0-9_-]+)/i);
        if (listMatch && !idMatch && !emailMatch && !userName) {
          const rawNoun = listMatch[1];
          const singularNoun = singularize(rawNoun);
          const pluralNoun = singularNoun.endsWith('y') ? singularNoun.slice(0, -1) + 'ies' : (singularNoun.endsWith('s') ? singularNoun : singularNoun + 's');
          
          const capitalLabel = singularNoun.charAt(0).toUpperCase() + singularNoun.slice(1);
          const capitalPlural = pluralNoun.charAt(0).toUpperCase() + pluralNoun.slice(1);
          
          if (!fillerWords.includes(singularNoun.toLowerCase())) {
            let postType = singularNoun.toLowerCase();
            let pluginName = "Custom Post Type";
            let url = adminUrl + `edit.php?post_type=${postType}`;
            
            if (postType === 'order') {
              url = adminUrl + `edit.php?post_type=shop_order`;
              pluginName = "WooCommerce";
            } else if (postType === 'product') {
              url = adminUrl + `edit.php?post_type=product`;
              pluginName = "WooCommerce";
            }
            
            syntheticPages.push({
              title: `All ${capitalPlural} List`,
              path: `${capitalPlural} › All ${capitalPlural}`,
              url: url,
              plugin: pluginName,
              description: `View and manage all registered ${pluralNoun.toLowerCase()} in the dashboard list.`,
              keywords: [postType, pluralNoun, "list", "all"]
            });
            
            syntheticPages.push({
              title: `View ${capitalPlural} on Frontend`,
              path: `Site Front › ${capitalPlural}`,
              url: homeUrl + `?post_type=${postType}`,
              plugin: "Frontend Link",
              description: `Visit the public frontend archive for ${pluralNoun.toLowerCase()}.`,
              keywords: [postType, pluralNoun, "frontend"]
            });
          }
        }

        // 5. Specific Name Parameter extraction (e.g. "I want to edit 'price' for product with name 'Hello'")
        let extractedName = null;

        // A. Priority 1: Check for explicit entity name patterns like `with name 'Hello'`, `named 'Hello'`, `called 'Hello'`, `starts with 'Hello'`
        const explicitNameMatch = query.match(/(?:with\s+name|name\s+is|named|called|title\s+is|starts\s+with|starting\s+with|contains|containing)\s+["']?([^"'\s]+)["']?/i);
        if (explicitNameMatch) {
          const candidate = explicitNameMatch[1].trim();
          if (candidate.length > 0 && !fillerWords.includes(candidate.toLowerCase())) {
            extractedName = candidate;
          }
        }

        // B. Priority 2: Check for last quoted string if explicit pattern was not matched
        if (!extractedName) {
          const allQuotes = [...query.matchAll(/["']([^"']+)["']/g)];
          if (allQuotes.length > 0) {
            const candidate = allQuotes[allQuotes.length - 1][1].trim();
            if (candidate.length > 0 && !fillerWords.includes(candidate.toLowerCase())) {
              extractedName = candidate;
            }
          }
        }
                            
        if (extractedName && !idMatch && !emailMatch && !userName) {
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
          
          const isDeleteQuery = /delete|remove|trash|erase/i.test(query);
          const actionTitle = isDeleteQuery ? `Search ${postTypePlural} to Delete ("${extractedName}")` : `Search & Edit ${postTypePlural} matching "${extractedName}"`;
          const actionDesc = isDeleteQuery ? `Open ${postTypePlural.toLowerCase()} list and search for items named "${extractedName}" to delete or move to trash.` : `Open the WordPress admin list for ${postTypePlural.toLowerCase()} and search for items named "${extractedName}".`;

          syntheticPages.push({
            title: actionTitle,
            path: `${postTypePlural} › All ${postTypePlural} › Search`,
            url: adminUrl + `edit.php?post_type=${postType}&s=` + encodeURIComponent(extractedName),
            plugin: pluginName,
            description: actionDesc,
            keywords: [postType, "search", "edit", "delete", extractedName]
          });
          
          if (isDeleteQuery) {
            syntheticPages.push({
              title: `Manage ${postTypePlural} Trash Bin`,
              path: `${postTypePlural} › Trash`,
              url: adminUrl + `edit.php?post_type=${postType}&post_status=trash`,
              plugin: pluginName,
              description: `View deleted ${postTypePlural.toLowerCase()} in the trash bin to permanently erase or restore them.`,
              keywords: [postType, "trash", "delete", "remove", extractedName]
            });
          } else {
            syntheticPages.push({
              title: `View "${extractedName}" ${postTypeLabel} on Frontend`,
              path: `Site Front › Search Results`,
              url: homeUrl + `?s=` + encodeURIComponent(extractedName) + `&post_type=${postType}`,
              plugin: "Frontend Link",
              description: `Visit the public frontend search results for ${postTypePlural.toLowerCase()} matching "${extractedName}".`,
              keywords: [postType, "frontend", "view", extractedName]
            });
          }
        }

        // 6. Universal Domain & Plugin Intent Extraction Matrix
        if (/funnel|flow|cartflow/i.test(query)) {
          syntheticPages.push({
            title: 'CartFlows Sales Funnels List',
            path: 'CartFlows › Funnels',
            url: adminUrl + 'admin.php?page=cartflows',
            plugin: 'CartFlows',
            description: 'View, manage, and optimize all high-converting sales funnels and checkout flows.',
            keywords: ['funnel', 'funnels', 'flow', 'flows', 'cartflows', 'sales funnel', 'checkout']
          });
          
          syntheticPages.push({
            title: 'Create New Funnel / Flow',
            path: 'CartFlows › Add New Funnel',
            url: adminUrl + 'admin.php?page=cartflows&action=add-new',
            plugin: 'CartFlows',
            description: 'Build a new sales funnel, checkout flow, or upsell step in CartFlows.',
            keywords: ['create funnel', 'create funnels', 'add funnel', 'new funnel', 'cartflows', 'build funnel']
          });
        }

        if (/store|shop|ecommerce|coupon|shipping|tax|payment|checkout/i.test(query) && !/funnel/i.test(query)) {
          syntheticPages.push({
            title: 'WooCommerce Store Settings',
            path: 'WooCommerce › Settings',
            url: adminUrl + 'admin.php?page=wc-settings',
            plugin: 'WooCommerce',
            description: 'Manage store address, currencies, payments, shipping zones, and tax options.',
            keywords: ['store', 'shop', 'ecommerce', 'settings', 'woocommerce']
          });
        }

        if (/seo|sitemap|schema|meta|search engine|rank/i.test(query)) {
          const matchingSeoPages = (dacpData.pages || []).filter(p => /seo|surerank|yoast|rankmath/i.test((p.plugin || '') + ' ' + (p.title || '') + ' ' + (p.path || '') + ' ' + (p.url || '')));
          
          if (matchingSeoPages.length > 0) {
            matchingSeoPages.slice(0, 3).forEach(sp => {
              syntheticPages.push({
                title: sp.title,
                path: sp.path,
                url: sp.url,
                plugin: sp.plugin || 'SureRank',
                description: sp.description || 'Configure Search Engine Optimization, XML Sitemaps, Meta Tags, and Schema settings.',
                keywords: ['seo', 'sitemap', 'schema', 'meta', 'rank', 'surerank']
              });
            });
          } else {
            syntheticPages.push({
              title: 'SureRank SEO Dashboard & Settings',
              path: 'SureRank › Dashboard',
              url: adminUrl + 'admin.php?page=surerank',
              plugin: 'SureRank',
              description: 'Configure SureRank SEO, search engine optimization, meta tags, sitemaps, and rankings.',
              keywords: ['seo', 'surerank', 'seo settings', 'change seo settings', 'meta', 'sitemap']
            });
          }
        }

        if (/form|contact|lead|submission/i.test(query)) {
          const formPage = (dacpData.pages || []).find(p => /form|contact/i.test(p.plugin || p.title || p.path));
          if (formPage) {
            syntheticPages.push({
              title: formPage.title,
              path: formPage.path,
              url: formPage.url,
              plugin: formPage.plugin,
              description: 'Create and manage contact forms, user submissions, and lead entries.',
              keywords: ['form', 'forms', 'contact', 'lead']
            });
          }
        }

        if (/starter|starter\s*template|starter\s*site|demo\s*import|astra\s*template|prebuilt/i.test(query)) {
          const starterPage = (dacpData.pages || []).find(p => /starter|astra-site/i.test(p.url || p.path || p.plugin)) || {
            title: 'Starter Templates Library',
            path: 'Appearance › Starter Templates',
            url: adminUrl + 'themes.php?page=starter-templates',
            plugin: 'Starter Templates'
          };

          syntheticPages.push({
            title: starterPage.title || 'Starter Templates Library',
            path: starterPage.path || 'Appearance › Starter Templates',
            url: starterPage.url || (adminUrl + 'themes.php?page=starter-templates'),
            plugin: starterPage.plugin || 'Starter Templates',
            description: 'Browse, import, and change prebuilt Starter Templates and full site designs.',
            keywords: ['starter template', 'starter templates', 'change starter template', 'starter sites', 'demo import', 'templates']
          });
        }

        if (/user|users|profile|account|member|role/i.test(query)) {
          if (/add|new|create|register/i.test(query)) {
            syntheticPages.push({
              title: 'Add New User',
              path: 'Users › Add New User',
              url: adminUrl + 'user-new.php',
              plugin: 'WordPress Core',
              description: 'Create a new user account, assign user roles (Administrator, Editor, Author, Subscriber), and set credentials.',
              keywords: ['add user', 'new user', 'create user', 'add new user', 'register user', 'user']
            });
          }
        }

        if (/comment|comments|discussion|reply|replies|moderation/i.test(query)) {
          syntheticPages.push({
            title: 'Manage & Moderate Comments',
            path: 'Comments › All Comments',
            url: adminUrl + 'edit-comments.php',
            plugin: 'WordPress Core',
            description: 'View, approve, reply to, edit, trash, or mark user comments as spam.',
            keywords: ['comment', 'comments', 'discussion', 'moderate comments', 'reply']
          });

          syntheticPages.push({
            title: 'Discussion & Comment Settings',
            path: 'Settings › Discussion',
            url: adminUrl + 'options-discussion.php',
            plugin: 'WordPress Core',
            description: 'Configure comment submission rules, moderation queues, spam filters, and avatar displays.',
            keywords: ['discussion', 'comment settings', 'allow comments', 'enable comments', 'avatars']
          });
        }

        // --- Subject Noun Discrimination & Dynamic Title Hierarchy Engine ---
        const actionModifierSet = new Set([
          'i', 'want', 'to', 'how', 'do', 'can', 'should', 'the', 'a', 'an', 'on', 'in',
          'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
          'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 'my',
          'our', 'your', 'their', 'his', 'her', 'its', 'setup', 'please', 'need', 'know',
          'show', 'view', 'go', 'last', 'days', 'some', 'see',
          'add', 'new', 'create', 'make', 'build', 'edit', 'change', 'modify', 'update',
          'set', 'configure', 'open', 'find', 'search', 'list', 'all', 'manage'
        ]);

        const queryLower = cleanQuery.toLowerCase().trim();
        const rawTokens = cleanQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        const unstemmedTokens = rawTokens.filter(w => !stopWords.has(w));
        const totalQueryTokens = unstemmedTokens.length;

        // Extract specific subject nouns from query (e.g. "user" from "add new user", "post" from "add new post")
        const subjectNouns = rawTokens.filter(w => !actionModifierSet.has(w));
        const hasSubjectNouns = subjectNouns.length > 0;

        if (totalQueryTokens === 0) {
          return syntheticPages.slice(0, 5);
        }

        const topicGoalBoosts = [
          { pattern: /comment|comments|discussion|reply|replies|moderation/i, targetPattern: /comment|discussion/i },
          { pattern: /category|categories|tag|tags|taxonomy/i, targetPattern: /category|categories|tag|tags|taxonomy/i },
          { pattern: /shipping|delivery|carrier|postage/i, targetPattern: /shipping/i },
          { pattern: /tax|taxes|vat|gst/i, targetPattern: /tax|vat/i },
          { pattern: /theme|appearance|customizer|customize/i, targetPattern: /theme|customize|appearance/i },
          { pattern: /menu|menus|navigation|header\s+menu/i, targetPattern: /menu|navigation/i },
          { pattern: /user|users|profile|role|members/i, targetPattern: /user|profile|role/i }
        ];

        const results = this.pages.map((page, idx) => {
          const docVector = this.docVectors[idx];
          if (!docVector) return { page: page, score: 0 };
          
          const titleLower = (page.title || '').toLowerCase();
          const pluginLower = (page.plugin || '').toLowerCase();
          const pathLower = (page.path || '').toLowerCase();
          const descLower = (page.description || '').toLowerCase();
          const kwsLower = Array.isArray(page.keywords) ? page.keywords.join(' ').toLowerCase() : (page.keywords && typeof page.keywords === 'object' ? Object.values(page.keywords).join(' ').toLowerCase() : '');
          const searchableText = `${titleLower} ${pluginLower} ${pathLower} ${kwsLower}`;

          // MANDATORY SUBJECT NOUN DISCRIMINATION:
          // If query specifies a Subject Noun (e.g. "user" in "add new user"),
          // candidate page MUST match at least one subject noun in title, path, plugin, or keywords!
          if (hasSubjectNouns) {
            const matchesSubjectNoun = subjectNouns.some(subject => {
              const stemmed = stem(subject);
              return searchableText.includes(subject) || searchableText.includes(stemmed);
            });

            if (!matchesSubjectNoun) {
              return { page: page, score: 0 };
            }
          }

          let score = 0;
          let matchedTokensCount = 0;

          // 1. Evaluate Token Matches across Title, Path, Keywords, and Description
          unstemmedTokens.forEach(token => {
            const stemmed = stem(token);
            let tokenMatched = false;

            // Title matches (Highest Priority: +100 points per token)
            if (titleLower.includes(token) || titleLower.includes(stemmed)) {
              score += 100;
              tokenMatched = true;
            }
            // Path matches (+50 points per token)
            else if (pathLower.includes(token) || pathLower.includes(stemmed)) {
              score += 50;
              tokenMatched = true;
            }
            // Origin Plugin / Keywords matches (+30 points per token)
            else if (pluginLower.includes(token) || kwsLower.includes(token) || pluginLower.includes(stemmed) || kwsLower.includes(stemmed)) {
              score += 30;
              tokenMatched = true;
            }
            // Description matches (+5 points per token - low weight to prevent description pollution)
            else if (descLower.includes(token) || descLower.includes(stemmed)) {
              score += 5;
              tokenMatched = true;
            }

            if (tokenMatched) {
              matchedTokensCount++;
            }
          });

          // 2. Exact Phrase / Multi-Word N-Gram Title Substring Boost (+300 points)
          if (totalQueryTokens >= 2) {
            const multiWordPhrase = unstemmedTokens.join(' ');
            if (titleLower.includes(multiWordPhrase)) {
              score += 300;
            } else if (pathLower.includes(multiWordPhrase)) {
              score += 150;
            }
          }

          // 3. Topic Goal Boost (+500 points for pages directly answering the primary semantic goal)
          topicGoalBoosts.forEach(rule => {
            if (rule.pattern.test(queryLower)) {
              if (rule.targetPattern.test(searchableText)) {
                score += 500;
              }
            }
          });

          // 4. Token Coverage Ratio Penalty:
          const coverageRatio = totalQueryTokens > 0 ? (matchedTokensCount / totalQueryTokens) : 0;
          
          if (totalQueryTokens >= 2 && coverageRatio < 0.6) {
            score = score * (coverageRatio * coverageRatio);
          }

          return {
            page: page,
            score: score
          };
        });
        
        const sortedResults = results
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(r => r.page);
        
        // Merge synthetic deep links & sorted results with strict URL deduplication
        const combined = syntheticPages.concat(sortedResults);
        const seenUrls = new Set();
        const deduplicated = [];

        combined.forEach(p => {
          const normUrl = (p.url || '').toLowerCase().trim();
          if (normUrl && !seenUrls.has(normUrl)) {
            seenUrls.add(normUrl);
            deduplicated.push(p);
          }
        });

        return deduplicated.slice(0, 5);
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

  // Helper function to dismiss WordPress Core / Gutenberg Command Palette if open
  function closeWpCoreCommandPalette() {
    try {
      // 1. Mutate Gutenberg / WP Core Command Palette React state
      if (window.wp && window.wp.data && typeof window.wp.data.dispatch === 'function') {
        const cmdStore = window.wp.data.dispatch('core/commands');
        if (cmdStore && typeof cmdStore.close === 'function') {
          cmdStore.close();
        }
      }
    } catch (e) {}

    try {
      // 2. Unregister core keyboard shortcut if present
      if (window.wp && window.wp.data && typeof window.wp.data.dispatch === 'function') {
        const kbStore = window.wp.data.dispatch('core/keyboard-shortcuts');
        if (kbStore && typeof kbStore.unregisterShortcut === 'function') {
          kbStore.unregisterShortcut('core/commands/open');
        }
      }
    } catch (e) {}

    try {
      // 3. Trigger close buttons on any active modals
      $('.components-modal__header button, [aria-label="Close dialog"], [aria-label="Close command palette"], .components-modal__frame .components-button').trigger('click');

      // 4. Remove residual modal backdrop DOM elements completely from the DOM
      $('.components-modal__screen-reader-title, .components-modal__frame, .components-modal__overlay, .components-modal__backdrop, div[role="dialog"]').remove();

      // 5. Clean up body overflow & open classes
      $('body, html').removeClass('has-modal-open modal-open wp-admin-nav-open').css({'overflow': '', 'height': ''});
    } catch (err) {}
  }

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
    $(window).add(document).on('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        
        closeWpCoreCommandPalette();
        toggleModal();
        return false;
      }
    });

    // 2. Universal Close on ESC key (keydown & keyup across window, document, and inputs)
    $(window).add(document).add($modalInput).on('keydown keyup', function(e) {
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        // Close our plugin modal and force backdrop removal
        closeModal();

        // Nuclear dismiss WP Core command palette / Gutenberg backdrop
        closeWpCoreCommandPalette();

        return false;
      }
    });

    // 3. Close modal when clicking backdrop or overlay anywhere
    $(document).on('click', '#wp-admin-nav-palette, .wp-admin-nav-modal-overlay', function(e) {
      if (e.target === this || $(e.target).hasClass('wp-admin-nav-modal-overlay')) {
        closeModal();
      }
    });

    // 3b. Close modal when clicking ESC hint badge or footer hint
    $(document).on('click', '.wp-admin-nav-modal-close-hint', function(e) {
      e.preventDefault();
      closeModal();
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

    // 7. Manual Re-index button handler (Dashboard & Modal)
    $(document).on('click', '#dacp-reindex-btn, #dacp-reindex-btn-modal', function(e) {
      e.preventDefault();
      const $btn = $(this);
      const originalText = $btn.html();
      
      $btn.prop('disabled', true).html('<svg class="dacp-icon dacp-spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> ' + (dacpData.i18n.reindexing || 'Re-indexing...'));
      
      $.ajax({
        url: typeof ajaxurl !== 'undefined' ? ajaxurl : dacpData.adminUrl + 'admin-ajax.php',
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'dacp_reindex_now',
          nonce: dacpData.reindexNonce
        },
        success: function(response) {
          if (response.success && response.data && response.data.pages) {
            dacpData.pages = response.data.pages;
            tfIdfEngine = new TfIdfEngine(dacpData.pages);
            $btn.html('<svg class="dacp-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ' + (dacpData.i18n.reindexSuccess || 'Site re-indexed!'));
          } else {
            $btn.html('<svg class="dacp-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Re-index failed');
          }
          setTimeout(function() {
            $btn.prop('disabled', false).html(originalText);
          }, 3000);
        },
        error: function() {
          $btn.html('⚠️ Error');
          setTimeout(function() {
            $btn.prop('disabled', false).html(originalText);
          }, 3000);
        }
      });
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
    closeWpCoreCommandPalette();
    $modalOverlay
      .removeClass('is-hidden')
      .stop(true, true)
      .attr('style', 'display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;')
      .show();
    $modalInput.focus();
    $('body, html').addClass('wp-admin-nav-open').css('overflow', 'hidden');
    activeIndex = -1;
  }

  function closeModal() {
    clearTimeout(wporgDebounceTimer);
    if (activeWpOrgRequest) {
      activeWpOrgRequest.abort();
      activeWpOrgRequest = null;
    }
    $modalInput.val('').blur();
    
    // Forcibly hide overlay with is-hidden class and explicit inline style override
    $modalOverlay
      .stop(true, true)
      .addClass('is-hidden')
      .attr('style', 'display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;')
      .hide();
    
    $('body, html').removeClass('wp-admin-nav-open modal-open has-modal-open').css({'overflow': '', 'height': ''});
    
    closeWpCoreCommandPalette();
    resetResults($modalResults, true);
    activeIndex = -1;
  }

  function resetResults($target, isModal) {
    if (isModal) {
      $target.html(`
        <div class="wp-admin-nav-initial-state">
          <span class="wp-admin-nav-state-icon">
            <svg class="dacp-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          </span>
          <p>${dacpData.i18n.searchPlaceholder}</p>
          <span class="wp-admin-nav-shortcut-badge">${dacpData.i18n.keyboardShortcutTip}</span>
        </div>
      `);
    } else {
      $target.html(`
        <div class="wp-admin-nav-initial-state">
          <span class="wp-admin-nav-state-icon">
            <svg class="dacp-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.55.64 2.94 1.7 3.9.76.76 1.23 1.52 1.41 2.5"></path></svg>
          </span>
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
   * Main Search Processor - Debounced by 2.0s (2000ms pause)
   */
  function handleSearch(query, $resultsContainer, isModal) {
    clearTimeout(wporgDebounceTimer);
    
    // Abort any in-flight WordPress.org search requests
    if (activeWpOrgRequest) {
      activeWpOrgRequest.abort();
      activeWpOrgRequest = null;
    }
    
    activeIndex = -1;

    if (!query || query.trim().length < 2) {
      resetResults($resultsContainer, isModal);
      return;
    }

    // Display smooth loading indicator while the user pauses typing (2000ms window)
    $resultsContainer.html(`
      <div class="wp-admin-nav-initial-state" style="padding: 24px 20px;">
        <div class="wp-admin-nav-spinner"></div>
        <p style="font-size: 13px; color: var(--wp-nav-text-secondary);">Analyzing intent and searching screens...</p>
      </div>
    `);

    // Trigger local search resolution and plugin search after 2 second pause
    wporgDebounceTimer = setTimeout(function() {
      // 1. Process local search
      const localResults = performLocalSearch(query);
      currentResults = localResults;

      // 2. Render local results and query WP.org recommendations if triggered
      const showWpOrg = localResults.length === 0 || isWpOrgTriggerQuery(query);
      if (showWpOrg) {
        searchWpOrg(query, $resultsContainer, localResults);
      } else {
        renderResults(localResults, $resultsContainer, query, [], false);
      }
    }, 2000); // 2 seconds pause requirement
  }

  /**
   * Perform client-side intent matching with scoring
   */
  function performLocalSearch(query) {
    if (!tfIdfEngine) return [];
    return tfIdfEngine.search(query);
  }

  /**
   * Check if query indicates searching for external WordPress.org plugins
   */
  function isWpOrgTriggerQuery(query) {
    const q = query.toLowerCase().trim();
    const wordCount = q.split(/\s+/).length;
    
    // Always trigger WordPress.org recommendations for natural language commands (3+ words)
    if (wordCount >= 3) return true;

    const featureTerms = [
      'install', 'download', 'plugin', 'addon', 'extension', 'setup', 'add', 
      'price', 'pricing', 'discount', 'edit', 'field', 'seo', 'shipping', 
      'builder', 'form', 'cartflow', 'template', 'theme', 'custom', 'tool', 'bulk'
    ];

    return featureTerms.some(t => q.includes(t));
  }

  /**
   * Render results inside the container
   */
  function renderResults(localPages, $container, query, wpOrgPlugins = [], isLoadingWpOrg = false) {
    $container.empty();

    if (localPages.length === 0 && wpOrgPlugins.length === 0 && !isLoadingWpOrg) {
      $container.html(`
        <div class="wp-admin-nav-no-results">
          <span class="wp-admin-nav-state-icon">
            <svg class="dacp-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </span>
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
