<?php
/**
 * Class DACP_Menu_Indexer
 * Parses WordPress admin menus and returns searchable structures.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DACP_Menu_Indexer {

	/**
	 * Get list of searchable pages with pre-defined keyword mappings and dynamic menu extraction.
	 * 
	 * @return array
	 */
	public static function get_searchable_menu_data() {
		global $menu, $submenu;

		$searchable_pages = array();
		
		// 1. Get predefined configurations for core WP and common plugins (WooCommerce, Yoast, Elementor, etc.)
		$predefined = self::get_predefined_mappings();

		// Ensure menu and submenu are loaded
		if ( empty( $menu ) ) {
			return $predefined;
		}

		// 2. Parse active WP Admin menus dynamically
		foreach ( $menu as $menu_item ) {
			// Skip separators or empty items
			if ( empty( $menu_item[0] ) || false !== strpos( $menu_item[4], 'wp-menu-separator' ) ) {
				continue;
			}

			$parent_title = self::clean_title( $menu_item[0] );
			$parent_slug  = $menu_item[2];
			$parent_cap   = $menu_item[1];

			// Skip if current user cannot access this menu
			if ( ! current_user_can( $parent_cap ) ) {
				continue;
			}

			// Determine parent URL
			$parent_url = self::resolve_menu_url( $parent_slug );

			// Check if this parent has submenus
			if ( ! empty( $submenu[ $parent_slug ] ) ) {
				foreach ( $submenu[ $parent_slug ] as $sub_item ) {
					$sub_title = self::clean_title( $sub_item[0] );
					$sub_slug  = $sub_item[2];
					$sub_cap   = $sub_item[1];

					if ( ! current_user_can( $sub_cap ) ) {
						continue;
					}

					$sub_url = self::resolve_menu_url( $sub_slug, $parent_slug );
					
					// Avoid duplicates by tracking URLs
					$unique_key = md5( $sub_url );

					// Combine paths
					$path = $parent_title . ' › ' . $sub_title;

					// Check if this sub_url matches a predefined item
					$matched_predefined = self::find_matching_predefined( $sub_url, $sub_slug, $predefined );

					if ( $matched_predefined ) {
						$searchable_pages[ $unique_key ] = array(
							'title'       => $matched_predefined['title'],
							'path'        => $path,
							'url'         => $sub_url,
							'plugin'      => $matched_predefined['plugin'],
							'description' => $matched_predefined['description'],
							'keywords'    => array_values( array_unique( array_merge( $matched_predefined['keywords'], self::generate_keywords( $sub_title, $parent_title ) ) ) ),
						);
					} else {
						// Create dynamic entry
						$searchable_pages[ $unique_key ] = array(
							'title'       => $sub_title,
							'path'        => $path,
							'url'         => $sub_url,
							'plugin'      => self::guess_plugin_name( $parent_title, $parent_slug ),
							'description' => sprintf( __( 'Go to the %s page under %s settings.', 'dhruval-admin-command-palette' ), $sub_title, $parent_title ),
							'keywords'    => self::generate_keywords( $sub_title, $parent_title ),
						);
					}
				}
			} else {
				// Standalone parent menu item
				$unique_key = md5( $parent_url );
				$matched_predefined = self::find_matching_predefined( $parent_url, $parent_slug, $predefined );

				if ( $matched_predefined ) {
					$searchable_pages[ $unique_key ] = array(
						'title'       => $matched_predefined['title'],
						'path'        => $parent_title,
						'url'         => $parent_url,
						'plugin'      => $matched_predefined['plugin'],
						'description' => $matched_predefined['description'],
						'keywords'    => array_values( array_unique( array_merge( $matched_predefined['keywords'], self::generate_keywords( $parent_title ) ) ) ),
					);
				} else {
					$searchable_pages[ $unique_key ] = array(
						'title'       => $parent_title,
						'path'        => $parent_title,
						'url'         => $parent_url,
						'plugin'      => self::guess_plugin_name( $parent_title, $parent_slug ),
						'description' => sprintf( __( 'Manage your %s settings and features.', 'dhruval-admin-command-palette' ), $parent_title ),
						'keywords'    => self::generate_keywords( $parent_title ),
					);
				}
			}
		}

		// Merge in any predefined configurations that weren't captured dynamically
		foreach ( $predefined as $url_key => $pre_item ) {
			$found = false;
			foreach ( $searchable_pages as $page ) {
				if ( strpos( $page['url'], $pre_item['url'] ) !== false || $page['url'] === $pre_item['url'] ) {
					$found = true;
					break;
				}
			}
			if ( ! $found ) {
				$unique_key = md5( $pre_item['url'] );
				$searchable_pages[ $unique_key ] = array(
					'title'       => $pre_item['title'],
					'path'        => $pre_item['path'],
					'url'         => admin_url( $pre_item['url'] ),
					'plugin'      => $pre_item['plugin'],
					'description' => $pre_item['description'],
					'keywords'    => $pre_item['keywords'],
				);
			}
		}

		return array_values( $searchable_pages );
	}

	/**
	 * Clean WordPress menu titles (e.g., strips updates/bubble counts span)
	 */
	private static function clean_title( $title ) {
		if ( null === $title || '' === $title ) {
			return '';
		}
		$title = (string) $title;
		// Remove nested span tags completely (common in WordPress update bubbles)
		$title = preg_replace( '/<span\b[^>]*>(?:[^<]+|<span\b[^>]*>.*?<\/span>)*<\/span>/i', '', $title );
		// Fallback to strip any residual span tags and their contents
		$title = preg_replace( '/<span\b[^>]*>.*?<\/span>/i', '', $title );
		// Strip all other HTML tags
		$title = strip_tags( $title );
		// Decode HTML entities
		$title = html_entity_decode( $title );
		return trim( $title );
	}

	/**
	 * Resolves admin menu slug to absolute or relative admin URLs
	 */
	private static function resolve_menu_url( $slug, $parent_slug = '' ) {
		if ( empty( $slug ) ) {
			return admin_url();
		}

		// If it's an external link or already a full URL, return it
		if ( 0 === strpos( $slug, 'http://' ) || 0 === strpos( $slug, 'https://' ) ) {
			return $slug;
		}

		// If it's a php file in WP-Admin root
		if ( false !== strpos( $slug, '.php' ) ) {
			return admin_url( $slug );
		}

		// If there is a parent slug
		if ( ! empty( $parent_slug ) ) {
			// If parent is a PHP file and child is not
			if ( false !== strpos( $parent_slug, '.php' ) ) {
				// Special check: custom submenus of php pages are option pages
				if ( 'options-general.php' === $parent_slug ) {
					return admin_url( 'options-general.php?page=' . $slug );
				}
				return admin_url( $parent_slug . '?page=' . $slug );
			}
		}

		// Fallback for custom plugin pages
		return admin_url( 'admin.php?page=' . $slug );
	}

	/**
	 * Try to match a menu page to predefined settings
	 */
	private static function find_matching_predefined( $url, $slug, $predefined ) {
		foreach ( $predefined as $pre ) {
			// Try slug match
			if ( ! empty( $slug ) && false !== strpos( $pre['url'], $slug ) ) {
				return $pre;
			}
			// Try URL path match
			if ( false !== strpos( $url, $pre['url'] ) ) {
				return $pre;
			}
		}
		return null;
	}

	/**
	 * Guess plugin name based on parent menu title/slug
	 */
	private static function guess_plugin_name( $parent_title, $parent_slug ) {
		$core_menus = array(
			'Dashboard', 'Posts', 'Media', 'Pages', 'Comments', 'Appearance',
			'Plugins', 'Users', 'Tools', 'Settings', 'Profile'
		);

		if ( in_array( $parent_title, $core_menus, true ) || false !== strpos( $parent_slug, 'options-general.php' ) ) {
			return 'WordPress Core';
		}

		return $parent_title;
	}

	/**
	 * Auto-generate keywords from title string
	 */
	private static function generate_keywords( $title, $parent = '' ) {
		$keywords = array();
		
		// Clean and split title
		$clean_title = strtolower( preg_replace( '/[^A-Za-z0-9\s]/', '', $title ) );
		$words = explode( ' ', $clean_title );
		
		foreach ( $words as $word ) {
			if ( strlen( $word ) > 3 ) {
				$keywords[] = $word;
			}
		}

		if ( ! empty( $parent ) ) {
			$clean_parent = strtolower( preg_replace( '/[^A-Za-z0-9\s]/', '', $parent ) );
			$parent_words = explode( ' ', $clean_parent );
			foreach ( $parent_words as $pword ) {
				if ( strlen( $pword ) > 3 && ! in_array( $pword, $keywords, true ) ) {
					$keywords[] = $pword;
				}
			}
		}

		return array_values( array_unique( $keywords ) );
	}

	/**
	 * Predefined detailed mappings for popular actions, tabs, and settings.
	 */
	private static function get_predefined_mappings() {
		return array(
			// WooCommerce Settings Tabs (Deep links)
			'wc_shipping' => array(
				'title'       => __( 'Shipping Settings', 'dhruval-admin-command-palette' ),
				'path'        => 'WooCommerce › Settings › Shipping',
				'url'         => 'admin.php?page=wc-settings&tab=shipping',
				'plugin'      => 'WooCommerce',
				'description' => __( 'Set up shipping zones, delivery regions, shipping rates (flat rate, free shipping, local pickup), and shipping classes.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'shipping', 'delivery', 'flat rate', 'free shipping', 'local pickup', 'postage', 'zones', 'shipping classes', 'calculator', 'rates', 'methods', 'dimensions', 'weight' ),
			),
			'wc_tax' => array(
				'title'       => __( 'Tax & VAT Settings', 'dhruval-admin-command-palette' ),
				'path'        => 'WooCommerce › Settings › Tax',
				'url'         => 'admin.php?page=wc-settings&tab=tax',
				'plugin'      => 'WooCommerce',
				'description' => __( 'Configure tax options, sales tax, standard tax rates, reduced rates, zero rates, and tax displays.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'tax', 'vat', 'gst', 'rates', 'sales tax', 'tax class', 'tax values', 'inclusive tax', 'exclusive tax', 'compound', 'tax settings' ),
			),
			'wc_general' => array(
				'title'       => __( 'Store General Settings', 'dhruval-admin-command-palette' ),
				'path'        => 'WooCommerce › Settings › General',
				'url'         => 'admin.php?page=wc-settings&tab=general',
				'plugin'      => 'WooCommerce',
				'description' => __( 'Set store location address, selling countries, currency options, enable coupons, and toggle tax calculation.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'currency', 'store address', 'selling locations', 'customer location', 'enable taxes', 'coupons', 'weight unit', 'dimension unit', 'country', 'city', 'postcode', 'zip' ),
			),
			'wc_payments' => array(
				'title'       => __( 'Payment Methods', 'dhruval-admin-command-palette' ),
				'path'        => 'WooCommerce › Settings › Payments',
				'url'         => 'admin.php?page=wc-settings&tab=checkout',
				'plugin'      => 'WooCommerce',
				'description' => __( 'Enable and configure payment processors (WooPayments, Stripe, PayPal, Cash on Delivery, Direct Bank Transfer).', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'payment', 'paypal', 'stripe', 'credit card', 'cod', 'cash on delivery', 'bank transfer', 'checkout', 'pay', 'gateway', 'bacs' ),
			),
			'wc_emails' => array(
				'title'       => __( 'Customer Email Templates', 'dhruval-admin-command-palette' ),
				'path'        => 'WooCommerce › Settings › Emails',
				'url'         => 'admin.php?page=wc-settings&tab=email',
				'plugin'      => 'WooCommerce',
				'description' => __( 'Customize emails sent to customers (new order, order cancelled, completed order, invoice, customer note).', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'emails', 'notifications', 'order email', 'email sender', 'email template', 'color scheme', 'mail', 'sender name', 'sender email', 'footer text' ),
			),
			'wc_products_tab' => array(
				'title'       => __( 'Product Settings', 'dhruval-admin-command-palette' ),
				'path'        => 'WooCommerce › Settings › Products',
				'url'         => 'admin.php?page=wc-settings&tab=products',
				'plugin'      => 'WooCommerce',
				'description' => __( 'Set up your base shop page, add-to-cart behavior, inventory settings, download limits, review options, and product ratings.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'shop page', 'add to cart', 'placeholder image', 'weight', 'dimensions', 'reviews', 'ratings', 'measurements', 'inventory', 'stock', 'backorders', 'downloadable' ),
			),
			'wc_coupons' => array(
				'title'       => __( 'Coupons List', 'dhruval-admin-command-palette' ),
				'path'        => 'Marketing › Coupons',
				'url'         => 'edit.php?post_type=shop_coupon',
				'plugin'      => 'WooCommerce',
				'description' => __( 'Create and manage promotional coupon codes, discounts, percentage discounts, and usage limits.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'coupon', 'discount', 'promotion', 'voucher', 'promo code', 'percentage discount', 'sale', 'free shipping coupon' ),
			),
			'wc_status' => array(
				'title'       => __( 'WooCommerce System Status', 'dhruval-admin-command-palette' ),
				'path'        => 'WooCommerce › Status',
				'url'         => 'admin.php?page=wc-status',
				'plugin'      => 'WooCommerce',
				'description' => __( 'View WooCommerce environmental setup details, active database tables, and connection diagnostics.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'status', 'system status', 'environment status', 'database status', 'system report', 'tools', 'woocommerce status' ),
			),
			'wc_logs' => array(
				'title'       => __( 'WooCommerce Status Logs', 'dhruval-admin-command-palette' ),
				'path'        => 'WooCommerce › Status › Logs',
				'url'         => 'admin.php?page=wc-status&tab=logs',
				'plugin'      => 'WooCommerce',
				'description' => __( 'View logs generated by WooCommerce, including payment gateways, error reports, and general notifications.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'logs', 'system status logs', 'woocommerce logs', 'wc logs', 'error logs', 'debug logs', 'logs screen', 'fatal error logs' ),
			),
			
			// Core WordPress Settings
			'wp_permalinks' => array(
				'title'       => __( 'Permalink Structures', 'dhruval-admin-command-palette' ),
				'path'        => 'Settings › Permalinks',
				'url'         => 'options-permalink.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Choose default url structure for posts and pages. Custom structures improve search engine optimization (SEO).', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'permalinks', 'slugs', 'pretty links', 'custom structure', 'category base', 'tag base', 'url structure', 'seo urls', 'htaccess' ),
			),
			'wp_general_settings' => array(
				'title'       => __( 'General Site Settings', 'dhruval-admin-command-palette' ),
				'path'        => 'Settings › General',
				'url'         => 'options-general.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Configure site title, description tagline, WordPress address, administration email, timezone, and language.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'site title', 'tagline', 'site address', 'admin email', 'membership', 'new user default role', 'site language', 'timezone', 'date format', 'time format', 'start of week' ),
			),
			'wp_reading' => array(
				'title'       => __( 'Reading & Homepage Settings', 'dhruval-admin-command-palette' ),
				'path'        => 'Settings › Reading',
				'url'         => 'options-reading.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Set your front homepage, blog listing counts, search engine indexing preferences, and RSS feed summary options.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'homepage', 'static page', 'latest posts', 'blog pages show at most', 'syndication feeds', 'rss', 'search engine visibility', 'noindex', 'discourage search engines', 'front page' ),
			),
			'wp_discussion' => array(
				'title'       => __( 'Discussion & Comments', 'dhruval-admin-command-palette' ),
				'path'        => 'Settings › Discussion',
				'url'         => 'options-discussion.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Manage site comments options, moderation queues, spam word blacklists, avatar options, and email notifications.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'comments', 'avatars', 'moderation', 'comment blacklist', 'disallowed comment keys', 'email me whenever', 'comment author must fill out', 'pingbacks', 'trackbacks' ),
			),
			'wp_media' => array(
				'title'       => __( 'Media Upload Dimensions', 'dhruval-admin-command-palette' ),
				'path'        => 'Settings › Media',
				'url'         => 'options-media.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Define dimensions for image sizes (thumbnails, medium, large) and organize uploads into year/month directories.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'thumbnail size', 'medium size', 'large size', 'upload folder', 'organize uploads into month and year', 'images', 'sizes' ),
			),
			'wp_writing' => array(
				'title'       => __( 'Writing Settings', 'dhruval-admin-command-palette' ),
				'path'        => 'Settings › Writing',
				'url'         => 'options-writing.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Define default post category, default formatting, setting up post-via-email servers, and update ping services.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'default post category', 'default post format', 'post via email', 'update services', 'ping services' ),
			),

			// Themes & Customization
			'wp_themes' => array(
				'title'       => __( 'Themes Management', 'dhruval-admin-command-palette' ),
				'path'        => 'Appearance › Themes',
				'url'         => 'themes.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Install, activate, customize, delete, or update visual designs for your website.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'themes', 'design', 'layout', 'appearance', 'install theme', 'activate theme', 'parent theme', 'child theme' ),
			),
			'wp_customizer' => array(
				'title'       => __( 'Theme Customizer', 'dhruval-admin-command-palette' ),
				'path'        => 'Appearance › Customize',
				'url'         => 'customize.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Interactively edit theme layouts, logo uploads, typography headers, color widgets, menus, and CSS styling.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'customize', 'logo', 'site icon', 'favicon', 'widgets', 'header image', 'background color', 'custom css', 'typography' ),
			),
			'wp_menus' => array(
				'title'       => __( 'Navigation Menus', 'dhruval-admin-command-palette' ),
				'path'        => 'Appearance › Menus',
				'url'         => 'nav-menus.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Create navigation menus, drag and drop custom links, page hierarchies, category folders, and location bindings.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'menus', 'navigation', 'header menu', 'footer menu', 'links', 'custom links', 'dropdown' ),
			),

			// Elementor
			'elementor_settings' => array(
				'title'       => __( 'Elementor Page Builder Settings', 'dhruval-admin-command-palette' ),
				'path'        => 'Elementor › Settings',
				'url'         => 'admin.php?page=elementor',
				'plugin'      => 'Elementor',
				'description' => __( 'Configure layout dimensions, custom page types, fonts, page templates, and active integrations.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'elementor', 'page builder', 'fonts', 'templates', 'post types', 'responsive', 'style settings' ),
			),

			// Updates Pages
			'wp_plugin_updates' => array(
				'title'       => __( 'Plugin Updates', 'dhruval-admin-command-palette' ),
				'path'        => 'Plugins › Installed Plugins › Updates Available',
				'url'         => 'plugins.php?plugin_status=upgrade',
				'plugin'      => 'WordPress Core',
				'description' => __( 'View and update installed plugins that have a newer version available.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'update plugins', 'plugin updates', 'upgrade plugins', 'outdated plugins', 'update available', 'plugins upgrade' ),
			),
			'wp_updates' => array(
				'title'       => __( 'WordPress Updates', 'dhruval-admin-command-palette' ),
				'path'        => 'Dashboard › Updates',
				'url'         => 'update-core.php',
				'plugin'      => 'WordPress Core',
				'description' => __( 'Update WordPress Core, installed plugins, themes, and translations.', 'dhruval-admin-command-palette' ),
				'keywords'    => array( 'update wordpress', 'core updates', 'system update', 'plugin updates', 'theme updates', 'translations update', 'upgrade' ),
			)
		);
	}
}
