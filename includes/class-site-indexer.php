<?php
/**
 * Class DACP_Site_Indexer
 * Universal Background Scanning, Origin Detection, Dynamic Plugin Metadata & Domain Graph Engine.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DACP_Site_Indexer {

	/**
	 * Database option key for cached index.
	 */
	const OPTION_KEY = 'dacp_cached_site_index';

	/**
	 * Get the site index. Retrieves from DB cache option, or builds on the fly if missing.
	 *
	 * @return array
	 */
	public static function get_site_index() {
		$cached = get_option( self::OPTION_KEY );

		if ( empty( $cached ) || ! is_array( $cached ) ) {
			return self::reindex_all();
		}

		return $cached;
	}

	/**
	 * Run complete site re-index, save to database option, and return index.
	 *
	 * @return array
	 */
	public static function reindex_all() {
		$index = array();

		// 1. Scan registered Custom Post Types & Core Post Types
		$post_type_items = self::scan_post_types();
		foreach ( $post_type_items as $item ) {
			$index[ md5( $item['url'] ) ] = $item;
		}

		// 2. Scan registered Taxonomies (categories, tags, custom taxonomies)
		$taxonomy_items = self::scan_taxonomies();
		foreach ( $taxonomy_items as $item ) {
			$index[ md5( $item['url'] ) ] = $item;
		}

		// 3. Scan Active Theme & Site Editor options
		$theme_items = self::scan_active_theme();
		foreach ( $theme_items as $item ) {
			$index[ md5( $item['url'] ) ] = $item;
		}

		// 4. Scan Admin Menu & Submenu Items (dynamic + predefined fallback)
		if ( class_exists( 'DACP_Menu_Indexer' ) ) {
			$menu_items = DACP_Menu_Indexer::get_searchable_menu_data();
			foreach ( $menu_items as $item ) {
				$index[ md5( $item['url'] ) ] = $item;
			}
		}

		$final_index = array_values( $index );

		// Cache in database option
		update_option( self::OPTION_KEY, $final_index, false );

		return $final_index;
	}

	/**
	 * Dynamically scan active plugins metadata (Name, Description, URI) from WordPress core.
	 *
	 * @return array
	 */
	public static function scan_active_plugins_metadata() {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$all_plugins    = get_plugins();
		$active_plugins = (array) get_option( 'active_plugins', array() );
		$plugin_meta    = array();

		foreach ( $active_plugins as $plugin_file ) {
			if ( isset( $all_plugins[ $plugin_file ] ) ) {
				$data  = $all_plugins[ $plugin_file ];
				$name  = ! empty( $data['Name'] ) ? $data['Name'] : $plugin_file;
				$desc  = ! empty( $data['Description'] ) ? wp_strip_all_tags( $data['Description'] ) : '';
				$slug  = dirname( $plugin_file );
				if ( '.' === $slug || empty( $slug ) ) {
					$slug = sanitize_title( $name );
				}

				// Extract clean description tokens
				$clean_desc = strtolower( preg_replace( '/[^A-Za-z0-9\s]/', '', $desc ) );
				$words      = array_filter( explode( ' ', $clean_desc ), function( $w ) {
					return strlen( $w ) > 3;
				} );

				$plugin_meta[ $slug ] = array(
					'name'        => $name,
					'description' => $desc,
					'slug'        => $slug,
					'keywords'    => array_values( array_unique( $words ) ),
				);
			}
		}

		return $plugin_meta;
	}

	/**
	 * Detect origin plugin or theme details for any given item.
	 *
	 * @param string $slug  Slug identifier.
	 * @param string $title Item title.
	 * @param string $url   Target URL.
	 * @return array
	 */
	public static function detect_origin( $slug, $title = '', $url = '' ) {
		$combined = strtolower( $slug . ' ' . $title . ' ' . $url );

		// Check Active Theme
		$theme = wp_get_theme();
		if ( $theme->exists() ) {
			$theme_slug = strtolower( $theme->get_stylesheet() );
			$theme_name = $theme->get( 'Name' );
			if ( false !== strpos( $combined, $theme_slug ) || false !== strpos( $combined, strtolower( $theme_name ) ) ) {
				return array(
					'type' => 'theme',
					'name' => $theme_name,
					'slug' => $theme_slug,
				);
			}
		}

		// Dynamically check Active Plugins Metadata first
		$active_meta = self::scan_active_plugins_metadata();
		foreach ( $active_meta as $pslug => $pmeta ) {
			if ( false !== strpos( $combined, $pslug ) || false !== strpos( $combined, strtolower( $pmeta['name'] ) ) ) {
				return array(
					'type' => 'plugin',
					'name' => $pmeta['name'],
					'slug' => $pslug,
				);
			}
		}

		// Fallback Plugins Matrix
		$plugins_matrix = array(
			'surerank'          => 'SureRank',
			'surecart'          => 'SureCart',
			'suremembers'       => 'SureMembers',
			'suretriggers'      => 'SureTriggers',
			'cartflow'          => 'CartFlows',
			'woocommerce'       => 'WooCommerce',
			'wc-'               => 'WooCommerce',
			'elementor'         => 'Elementor',
			'starter-templates' => 'Starter Templates',
			'starter-sites'     => 'Starter Templates',
			'astra-sites'       => 'Starter Templates',
			'yoast'             => 'Yoast SEO',
			'rank-math'         => 'Rank Math SEO',
			'wpforms'           => 'WPForms',
			'contact-form'      => 'Contact Form 7',
			'wordfence'         => 'Wordfence Security',
			'updraft'           => 'UpdraftPlus',
			'jetpack'           => 'Jetpack',
			'cartflows'         => 'CartFlows',
			'astro'             => 'Astra',
		);

		foreach ( $plugins_matrix as $key => $plugin_name ) {
			if ( false !== strpos( $combined, $key ) ) {
				return array(
					'type' => 'plugin',
					'name' => $plugin_name,
					'slug' => $key,
				);
			}
		}

		// Check WordPress Core Indicators
		$core_indicators = array( 'options-general.php', 'options-reading.php', 'options-writing.php', 'options-discussion.php', 'options-media.php', 'options-permalink.php', 'themes.php', 'plugins.php', 'users.php', 'tools.php', 'upload.php', 'edit-comments.php' );
		foreach ( $core_indicators as $indicator ) {
			if ( false !== strpos( $url, $indicator ) ) {
				return array(
					'type' => 'core',
					'name' => 'WordPress Core',
					'slug' => 'wp-core',
				);
			}
		}

		return array(
			'type' => 'plugin',
			'name' => ! empty( $title ) ? $title : 'Plugin Page',
			'slug' => sanitize_title( $slug ),
		);
	}

	/**
	 * Get universal domain concept terms for expanding keyword coverage.
	 *
	 * @return array
	 */
	public static function get_domain_concepts( $plugin_or_slug ) {
		$s          = strtolower( $plugin_or_slug );
		$concepts   = array();
		$dictionary = array(
			'surerank'    => array( 'seo', 'search engine', 'sitemap', 'schema', 'meta', 'analytics', 'ranking', 'google', 'seo settings', 'meta title', 'meta description' ),
			'seo'         => array( 'seo', 'search engine', 'meta', 'sitemap', 'schema', 'robots', 'indexing', 'rank', 'keywords', 'google', 'seo settings', 'search console' ),
			'starter'     => array( 'starter template', 'starter templates', 'change starter template', 'import template', 'starter site', 'starter sites', 'demo import', 'prebuilt sites', 'astra templates', 'template library' ),
			'cartflow'    => array( 'funnel', 'funnels', 'sales funnel', 'checkout flow', 'flow', 'flows', 'upsell', 'downsell', 'order bump', 'step', 'steps', 'conversion', 'checkout' ),
			'funnel'      => array( 'funnel', 'funnels', 'sales funnel', 'checkout flow', 'flow', 'flows', 'upsell', 'downsell', 'step', 'steps' ),
			'woo'         => array( 'store', 'shop', 'ecommerce', 'product', 'products', 'order', 'orders', 'sale', 'sales', 'coupon', 'coupons', 'shipping', 'tax', 'checkout', 'payment', 'gateways', 'inventory', 'stock' ),
			'product'     => array( 'item', 'merchandise', 'store product', 'catalog', 'pricing', 'inventory' ),
			'order'       => array( 'purchase', 'transaction', 'customer order', 'billing', 'invoice' ),
			'elementor'   => array( 'page builder', 'builder', 'landing page', 'design', 'layout', 'widget', 'widgets', 'template', 'templates', 'canvas', 'header footer' ),
			'form'        => array( 'form', 'forms', 'contact', 'contact form', 'submission', 'submissions', 'lead', 'leads', 'entries', 'fields' ),
			'member'      => array( 'member', 'members', 'membership', 'memberships', 'subscription', 'subscriptions', 'restrict', 'access', 'level', 'levels' ),
			'security'    => array( 'firewall', 'malware', 'scan', 'protection', 'login security', 'login lock' ),
			'wordfence'   => array( 'security', 'firewall', 'malware', 'scan', 'blocking', '2fa' ),
		);

		foreach ( $dictionary as $key => $terms ) {
			if ( false !== strpos( $s, $key ) ) {
				$concepts = array_merge( $concepts, $terms );
			}
		}

		// Inspect Active Plugins Description for dynamic terms
		$active_meta = self::scan_active_plugins_metadata();
		foreach ( $active_meta as $pslug => $pmeta ) {
			if ( false !== strpos( $s, $pslug ) || false !== strpos( $s, strtolower( $pmeta['name'] ) ) ) {
				$concepts = array_merge( $concepts, $pmeta['keywords'] );
				$concepts[] = strtolower( $pmeta['name'] );
			}
		}

		return array_values( array_unique( $concepts ) );
	}

	/**
	 * Scan registered post types and generate administration links.
	 *
	 * @return array
	 */
	private static function scan_post_types() {
		$items = array();

		// Get all registered post types
		$post_types = get_post_types( array(), 'objects' );

		// Skip internal post types
		$exclude = array( 'revision', 'nav_menu_item', 'custom_css', 'customize_changeset', 'oembed_cache', 'user_request', 'wp_block', 'wp_template', 'wp_template_part', 'wp_global_styles', 'wp_navigation' );

		foreach ( $post_types as $pt ) {
			if ( in_array( $pt->name, $exclude, true ) ) {
				continue;
			}

			$label        = ! empty( $pt->labels->singular_name ) ? $pt->labels->singular_name : $pt->label;
			$plural_label = ! empty( $pt->labels->name ) ? $pt->labels->name : $label;
			$origin       = self::detect_origin( $pt->name, $plural_label );

			// View All List URL
			if ( 'post' === $pt->name ) {
				$list_url = admin_url( 'edit.php' );
			} elseif ( 'attachment' === $pt->name ) {
				$list_url = admin_url( 'upload.php' );
			} else {
				$list_url = admin_url( 'edit.php?post_type=' . $pt->name );
			}

			// Domain concept terms
			$domain_terms = self::get_domain_concepts( $pt->name . ' ' . $label );

			$items[] = array(
				'title'       => sprintf( __( 'All %s List', 'dhruval-admin-command-palette' ), $plural_label ),
				'path'        => sprintf( '%s › All %s', $plural_label, $plural_label ),
				'url'         => $list_url,
				'plugin'      => $origin['name'],
				'originType'  => $origin['type'],
				'originName'  => $origin['name'],
				'originSlug'  => $origin['slug'],
				'description' => sprintf( __( 'View, manage, and filter all %s items in the WordPress admin list.', 'dhruval-admin-command-palette' ), strtolower( $plural_label ) ),
				'keywords'    => array_values( array_unique( array_merge( array( strtolower( $label ), strtolower( $plural_label ), 'list', 'all', 'manage', $pt->name, strtolower( $origin['name'] ) ), $domain_terms ) ) ),
			);

			// Add New Item URL
			if ( 'attachment' !== $pt->name ) {
				if ( 'post' === $pt->name ) {
					$add_url = admin_url( 'post-new.php' );
				} else {
					$add_url = admin_url( 'post-new.php?post_type=' . $pt->name );
				}

				$items[] = array(
					'title'       => sprintf( __( 'Add New %s', 'dhruval-admin-command-palette' ), $label ),
					'path'        => sprintf( '%s › Add New', $plural_label ),
					'url'         => $add_url,
					'plugin'      => $origin['name'],
					'originType'  => $origin['type'],
					'originName'  => $origin['name'],
					'originSlug'  => $origin['slug'],
					'description' => sprintf( __( 'Create and publish a new %s entry.', 'dhruval-admin-command-palette' ), strtolower( $label ) ),
					'keywords'    => array_values( array_unique( array_merge( array( 'add', 'create', 'new', 'make', 'build', strtolower( $label ), strtolower( $plural_label ), $pt->name, strtolower( $origin['name'] ) ), $domain_terms ) ) ),
				);
			}
		}

		return $items;
	}

	/**
	 * Scan registered taxonomies and generate edit links.
	 *
	 * @return array
	 */
	private static function scan_taxonomies() {
		$items = array();

		$taxonomies = get_taxonomies( array(), 'objects' );
		$exclude    = array( 'nav_menu', 'link_category', 'post_format', 'wp_theme' );

		foreach ( $taxonomies as $tax ) {
			if ( in_array( $tax->name, $exclude, true ) ) {
				continue;
			}

			$label        = ! empty( $tax->labels->singular_name ) ? $tax->labels->singular_name : $tax->label;
			$plural_label = ! empty( $tax->labels->name ) ? $tax->labels->name : $label;
			$associated   = ! empty( $tax->object_type ) ? implode( ', ', $tax->object_type ) : 'posts';
			$origin       = self::detect_origin( $tax->name, $plural_label );

			// Determine URL
			$post_type_param = ! empty( $tax->object_type[0] ) ? $tax->object_type[0] : 'post';
			$tax_url         = admin_url( 'edit-tags.php?taxonomy=' . $tax->name . '&post_type=' . $post_type_param );
			$domain_terms    = self::get_domain_concepts( $tax->name . ' ' . $label );

			$items[] = array(
				'title'       => sprintf( __( 'Manage %s (%s)', 'dhruval-admin-command-palette' ), $plural_label, $label ),
				'path'        => sprintf( 'Taxonomies › %s', $plural_label ),
				'url'         => $tax_url,
				'plugin'      => $origin['name'],
				'originType'  => $origin['type'],
				'originName'  => $origin['name'],
				'originSlug'  => $origin['slug'],
				'description' => sprintf( __( 'Add, edit, or delete %s assigned to %s.', 'dhruval-admin-command-palette' ), strtolower( $plural_label ), $associated ),
				'keywords'    => array_values( array_unique( array_merge( array( 'taxonomy', strtolower( $label ), strtolower( $plural_label ), 'category', 'tag', 'terms', $tax->name, strtolower( $origin['name'] ) ), $domain_terms ) ) ),
			);
		}

		return $items;
	}

	/**
	 * Scan active theme details.
	 *
	 * @return array
	 */
	private static function scan_active_theme() {
		$items = array();
		$theme = wp_get_theme();

		if ( ! $theme->exists() ) {
			return $items;
		}

		$theme_name   = $theme->get( 'Name' );
		$domain_terms = self::get_domain_concepts( $theme_name );

		// Customizer
		$items[] = array(
			'title'       => sprintf( __( 'Customize %s Theme', 'dhruval-admin-command-palette' ), $theme_name ),
			'path'        => 'Appearance › Customize',
			'url'         => admin_url( 'customize.php' ),
			'plugin'      => 'Active Theme (' . $theme_name . ')',
			'originType'  => 'theme',
			'originName'  => $theme_name,
			'originSlug'  => strtolower( $theme->get_stylesheet() ),
			'description' => sprintf( __( 'Open live visual Customizer options for the active %s theme.', 'dhruval-admin-command-palette' ), $theme_name ),
			'keywords'    => array_values( array_unique( array_merge( array( 'theme', 'customize', 'customizer', strtolower( $theme_name ), 'appearance', 'design' ), $domain_terms ) ) ),
		);

		// Site Editor (Block themes)
		if ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() ) {
			$items[] = array(
				'title'       => sprintf( __( '%s Block Site Editor', 'dhruval-admin-command-palette' ), $theme_name ),
				'path'        => 'Appearance › Editor',
				'url'         => admin_url( 'site-editor.php' ),
				'plugin'      => 'Active Theme (' . $theme_name . ')',
				'originType'  => 'theme',
				'originName'  => $theme_name,
				'originSlug'  => strtolower( $theme->get_stylesheet() ),
				'description' => sprintf( __( 'Full Site Editing (FSE) block editor for templates and patterns in %s.', 'dhruval-admin-command-palette' ), $theme_name ),
				'keywords'    => array_values( array_unique( array_merge( array( 'site editor', 'block theme', 'fse', 'templates', 'patterns', strtolower( $theme_name ) ), $domain_terms ) ) ),
			);
		}

		return $items;
	}
}
