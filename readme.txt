=== Dhruval Admin Command Palette ===
Contributors: dhruvalbhansali1608
Donate link: https://inventkid.com/
Tags: admin search, spotlight, command palette, navigation, woocommerce
Requires at least: 5.0
Tested up to: 7.0
Stable tag: 1.0.7
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Spotlight/Raycast-like command palette for WordPress Admin. Instantly search screens, settings, and find plugins on WordPress.org with Ctrl+K.

== Description ==

Dhruval Admin Command Palette adds a powerful Spotlight/Raycast-like floating command palette (`Ctrl + K` or `Cmd + K`) and a dedicated dashboard search page to your WordPress Admin.

Instead of clicking through hundreds of configuration screens, simply type natural language requests (e.g., "I want to set shipping rates" or "modify role for user id 5") and get instantly navigated to the exact settings screen.

== Upgrade to Pro for Direct Database Writes & Rollbacks ==

Dhruval Admin Command Palette Pro extends the command palette to allow executing live database changes using natural language commands!

= Pro Features: =
* **Natural Language DB Updates**: Change settings, update user profiles, modify post/page metadata directly from the command palette.
* **Before/After Live Diffs**: Renders a clean visual diff card before committing any changes.
* **Database Rollbacks & Logs**: Keeps a complete log of all command palette updates with one-click restoration.
* **Master Schema Matrix**: Compiles registered taxonomies, core settings, WooCommerce columns, and user profile fields dynamically.
* **Meta key fallback lookup**: Searches metadata database if no confident match exists.

[Get Dhruval Admin Command Palette Pro Now](https://inventkid.com/command-palette/)

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

= 1.0.7 =
* Fix Gutenberg Block Editor White Screen: Removed php-level script deregistration of wp-commands, allowing dependencies of the block editor to load correctly without conflict. Keyboard shortcut interception is handled gracefully inside Javascript.

= 1.0.6 =
* Go Pro Sidebar Redirection: Injects a custom sidebar submenu link to the product website if Pro is not active.
* In-Dashboard Upgrade Promo: Displays a modern linear-gradient promotional card on the Search Console dashboard page for free users.
* Pro-Aware Menu Visibility: Automatically hides all upgrade promotions when the Pro plugin is active.
* Context-Aware Modes: Supported Search, Update, and Logs modes inline on the search console page.

= 1.0.5 =
* Manual Reindexing Action Hook: Hooked `dacp_reindex_now` inside ajax_reindex_now, enabling Pro to rebuild settings indexes immediately on manual reindex requests.
* Advanced Query Parsing: Replaced regex checks with a smart keyword and preposition heuristic to detect Pro database updates anywhere inside natural language query sentences.
* Activation/Deactivation safety: Changed activation/deactivation hooks to set cache dirty status rather than executing index rebuilds immediately, preventing fatal errors with third-party plugins.
* WordPress.org Semantic Recommendation Resolver: Intercepts natural language synonym searches (cart abandonment, slow sites, rankings) and resolves them to high-precision terms before calling the WordPress.org Plugin API.
* Synonym & Intent Expansion Dictionary: Implemented query token synonym expansion for key topics (leaving the cart, abandoned checkout, speed optimization, search engine rankings).
* Synonym-Aware Subject Noun Discrimination: Allows synonym matches to successfully satisfy the mandatory subject noun validation.
* Cart Abandonment Synthetic Redirects: Automatically suggests optimized checkout flows and plugins to recover abandoned carts on WordPress.org.

= 1.0.4 =
* Semantic Topic Goal Boost Matrix: Added +500 points Intent Boost for primary subjects (comments, categories, taxonomies, shipping, users, themes, menus) to guarantee comments and settings screens take top priorities.
* Subject Noun Discrimination Engine: Intercepts queries targeting specific entities to eliminate unrelated pages (e.g. "add new user" excludes "Add New Post").
* Quoted Priority Parameter Extraction & Preposition Noise Filtering: Extracts explicit quotes first and filters sentence prepositions (that, starts with, named) from parameter extraction.
* Zero-Network Dependency Inline SVG Vectors: Replaced Unicode emojis with local inline vector graphics (.dacp-icon) to prevent broken icons on offline/firewalled sites.
* Dynamic Active Plugin Metadata Scanner & Subpage Origin Graph: Dynamically detects concepts and raises related pages of matching plugins.
* Critical AJAX Menu Population Fix: Forces WordPress admin menu file loading during AJAX/cron reindexing.
* Strict URL-level Result Deduplication: Prevents identical URLs from rendering duplicate search cards.
* Prevent conflicts with Core Command Palette: Dequeues core commands and handles keyboard overlay cleanup on escape.

= 1.0.0 =
* Initial release. Features TF-IDF vector search, word stemming, nonced AJAX recommendations, and parameter extraction.
