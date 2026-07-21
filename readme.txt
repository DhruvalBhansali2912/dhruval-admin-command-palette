=== Dhruval Admin Command Palette ===
Contributors: dhruvalbhansali1608
Donate link: https://inventkid.com/
Tags: admin search, spotlight, command palette, navigation, woocommerce, admin menu, search plugins
Requires at least: 5.0
Tested up to: 7.0
Stable tag: 2.5.0
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

A textbox-based Spotlight/Raycast-like navigation command palette for the WordPress Admin Dashboard. Instantly find pages or search plugins on WordPress.org.

== Description ==

Dhruval Admin Command Palette adds a powerful Spotlight/Raycast-like floating command palette (`Ctrl + K` or `Cmd + K`) and a dedicated dashboard search page to your WordPress Admin.

Instead of clicking through hundreds of configuration screens, simply type natural language requests (e.g., "I want to set shipping rates" or "modify role for user id 5") and get instantly navigated to the exact settings screen.

= Features =

* **Natural Language Matching**: Client-side TF-IDF and word stemmer engine understands variations in phrasing.
* **Global Command Palette**: Open instantly from any screen with `Ctrl + K` / `Cmd + K`.
* **Dynamic Parameter Extraction**: Auto-detects user/post IDs, emails, or specific names inside queries and creates dynamic deep-links.
* **WordPress.org Search Integration**: Type queries for new plugins to search WordPress.org directly from your dashboard.
* **Super-Lightweight**: Fits in under 3ms, adds less than 6KB of script, and contains no bloated external library dependencies.

== Installation ==

1. Upload the plugin folder to the `/wp-content/plugins/` directory, or upload the ZIP file directly via the WordPress Plugins menu.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Click "Command Palette" in your sidebar or press `Ctrl + K` to start searching!

== Frequently Asked Questions ==

= How do I open the global command palette? =
Press `Ctrl + K` (Windows/Linux) or `Cmd + K` (macOS) anywhere in the admin dashboard.

= Which plugins are supported by default? =
It dynamically indexes all active admin menu screens. Popular pages under WooCommerce (Shipping, Taxes, Payments, Status, Logs, Coupons) are deep-mapped out-of-the-box.

== Changelog ==

= 2.5.0 =
* Semantic Topic Goal Boost Matrix & Strict Result Deduplication: Implemented a +500 point Intent Topic Goal Boost for primary subjects (`comments`, `categories`, `taxonomies`, `shipping`, `users`, `themes`, `menus`). Synthetic intent cards for comment management & discussion settings now take top spots for queries like "How can I add comments to post". Enforced strict URL-level result deduplication.

= 2.4.0 =
* Critical JS Syntax & ReferenceError Fix: Resolved an unclosed JSDoc block comment before `isWpOrgTriggerQuery()` in `admin.js` that caused an `Uncaught ReferenceError: isWpOrgTriggerQuery is not defined` console exception and blocked search result rendering.

= 2.3.0 =
* Explicit Entity Name Matching & Automatic WordPress.org Plugin Recommendations: Prioritized explicit entity name patterns (`with name 'Hello'`, `named 'Hello'`) over isolated quoted attribute words. Enabled automatic parallel WordPress.org plugin recommendation fetching for all multi-word natural language intent queries (3+ words or feature terms), appending recommendations seamlessly beneath local admin screens.

= 2.2.0 =
* Quoted Priority Parameter Extraction & Preposition Noise Filtering: Added explicit quote detection (`'hello'` / `"hello"`) to accurately capture intended search terms while stripping sentence prepositions (`that`, `which`, `starts with`, `named`). Added dedicated delete & trash intent handling for product and post removal commands.

= 2.1.0 =
* Critical AJAX Menu Population Fix: Resolved an architectural issue where `$GLOBALS['menu']` was empty during `admin-ajax.php` re-indexing requests. Forced WordPress admin menu file loading (`wp-admin/menu.php`) during AJAX/cron re-indexing and added full predefined mappings for all core pages (`user-new.php`, `users.php`, `profile.php`, `post-new.php`, `plugins.php`).

= 2.0.0 =
* Major Subject Noun Discrimination Engine: Introduced mandatory target subject noun validation (`subjectNouns`). Commands specifying a target entity (such as "user" in "I want to add new user") now automatically eliminate unrelated creation screens (such as "Add New Post", "Add New Page", "Add New Font"). Disambiguated generic WordPress submenu labels ("Add New" -> "Add New User") directly during indexing.

= 1.9.0 =
* Pure Dynamic Token Coverage & Title Hierarchy Scoring Engine: Removed all hardcoded action verb sets and keyword exclusions. Introduced a mathematical token coverage ratio penalty combined with an exact N-gram title substring boost (+300). Guarantees core commands like "I want to add new user" resolve directly to `user-new.php` without false description matches.

= 1.8.0 =
* Zero-Network Dependency Inline SVG Vectors: Replaced all raw Unicode emojis with local inline SVG vector graphics (`.dacp-icon`). Eliminates external Twemoji HTTP requests to `s.w.org`, completely preventing broken image icons (`🖼️ 🚫`) behind corporate proxies, firewalls, and offline environments (`net::ERR_TUNNEL_CONNECTION_FAILED`).

= 1.7.0 =
* SureRank SEO Integration & Recommendation Filter Polish: Added explicit predefined mappings for SureRank SEO (`admin.php?page=surerank` & `admin.php?page=surerank-settings`). Fixed `isWpOrgTriggerQuery` logic so external WordPress.org plugin recommendations are suppressed when installed plugin screens (like SureRank) are found locally.

= 1.6.0 =
* Dynamic Plugin Metadata & Subpage Origin Graph Engine: Built deep active plugin metadata inspection (`scan_active_plugins_metadata`) to extract plugin descriptions, concepts, and capabilities directly from installed WordPress plugins (such as SureRank). Introduced Plugin Origin Graph Elevation to automatically boost all registered admin subpages of a matching plugin to the top of search results.

= 1.5.0 =
* Major Algorithm Upgrade (Subject Keyword Priority Filter): Disambiguated generic structural modifiers (`settings`, `options`, `page`, `config`) from primary domain subject keywords (`SEO`, `shipping`, `product`, `user`). Queries with specific subjects now automatically exclude unrelated settings pages (e.g., "SEO settings" excludes CartFlows and Elementor settings).

= 1.4.0 =
* Starter Templates Support & Action Verbs Update: Added full indexing and synthetic intent matching for Astra Starter Templates (`themes.php?page=starter-templates`). Removed action verbs (`change`, `set`, `modify`, `configure`) from search stop words so commands like "I want to change starter template" directly resolve to the Starter Templates Library.

= 1.3.1 =
* Button Styling & Visibility Polish: Scoped high-contrast `#dacp-reindex-btn` styling to guarantee high visibility across all WordPress dashboard light themes. Added a dedicated `🔄 Re-index Site` button directly into the global Ctrl+K modal palette footer.

= 1.3.0 =
* Universal Origin Detection & Domain Concept Terminology Engine: Added automatic origin classification (`originType`, `originName`, `originSlug`) for plugins, themes, and WordPress core. Built comprehensive domain concept dictionaries (funnels, store, page builders, seo, forms, memberships, security) to dynamically associate vocabulary across all admin screens.

= 1.2.0 =
* Major Intent Engine Update: Removed action verbs (`create`, `add`, `install`, `build`) from search stop words so creation queries are accurately parsed.
* CartFlows & Funnel Support: Added synthetic intent matching and automatic keyword expansion for `funnel`, `funnels`, `sales funnel`, `checkout flow`, `upsell`, `downsell`, and CartFlows custom post types.

= 1.1.6 =
* Dequeued WordPress Core `wp-commands` package script in PHP and dispatched `wp.data.dispatch('core/commands').close()` React state mutations in JS to permanently eliminate Core command palette backdrop conflicts.

= 1.1.5 =
* Resolved residual CSS backdrop filter bug: Added .is-hidden rule with !important visibility/pointer-events overrides and explicit inline attribute wiping to guarantee 100% overlay removal on ESC.

= 1.1.4 =
* Nuclear overlay cleanup: Forced immediate CSS hiding and body scroll restoration on ESC keypress to prevent residual backdrop filters from remaining on screen.

= 1.1.3 =
* Resolved command palette keyboard conflict: Intercepted Ctrl+K and ESC event propagation to dismiss WordPress Core/Gutenberg's built-in command palette dialog alongside the plugin palette.

= 1.1.2 =
* Enhanced ESC behavior: Pressing Escape (or clicking the ESC hint badge) now immediately clears search inputs, cancels active timers, and completely hides the modal command palette.

= 1.1.1 =
* Moved daily WP Cron scheduling and database cache initialization check to the `admin_init` hook for foolproof automatic activation across all WordPress updates.

= 1.1.0 =
* Major Upgrade: Added background Site Indexer (DACP_Site_Indexer) and WP Cron database caching. Deep scans all custom post types, taxonomies, active themes, plugins, and admin menus. Features automatic re-indexing on plugin/theme events and a manual "Re-index Site Now" dashboard control.

= 1.0.2 =
* Fixed preposition matching bug in user entity extraction (e.g. "user with name Michael" now correctly extracts "Michael").

= 1.0.1 =
* Enhanced natural language intent parsing (possessive name extraction, post-type plural list resolution) and added a 2.0s typing pause debounce for smooth execution.

= 1.0.0 =
* Initial release. Features TF-IDF vector search, word stemming, nonced AJAX recommendations, and parameter extraction.
