=== Dhruval Admin Command Palette ===
Contributors: dhruvalbhansali1608
Donate link: https://inventkid.com/
Tags: admin search, spotlight, command palette, navigation, woocommerce, admin menu, search plugins
Requires at least: 5.0
Tested up to: 7.0
Stable tag: 1.0.4
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
