<?php
/*
Plugin Name: Dhruval Admin Command Palette
Plugin URI: https://inventkid.com/
Description: Spotlight/Raycast-like command palette for WordPress Admin. Instantly search screens, settings, and find plugins on WordPress.org with Ctrl+K.
Version: 1.0.7
Author: Dhruval Bhansali
Author URI: https://profiles.wordpress.org/dhruvalbhansali1608/
License: GPLv2 or later
Text Domain: dhruval-admin-command-palette
*/

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// Define plugin constants
define( 'DACP_PATH', plugin_dir_path( __FILE__ ) );
define( 'DACP_URL', plugin_dir_url( __FILE__ ) );

// Include helper classes
require_once DACP_PATH . 'includes/class-menu-indexer.php';
require_once DACP_PATH . 'includes/class-site-indexer.php';

// Deactivation hook
register_deactivation_hook( __FILE__, 'dacp_on_deactivate' );

function dacp_on_deactivate() {
	$timestamp = wp_next_scheduled( 'dacp_daily_reindex_event' );
	if ( $timestamp ) {
		wp_unschedule_event( $timestamp, 'dacp_daily_reindex_event' );
	}
}

/**
 * Class DACP_Main
 * Main class to initialize the plugin.
 */
class DACP_Main {

	public function __construct() {
		// Ensure cron event is scheduled & cache initialized on admin_init
		add_action( 'admin_init', array( $this, 'ensure_cron_and_cache' ) );

		// Enqueue scripts and styles in the admin dashboard
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		// Inject the search overlay markup in the footer of all admin pages
		add_action( 'admin_footer', array( $this, 'render_global_palette' ) );

		// Add a dedicated admin menu page
		add_action( 'admin_menu', array( $this, 'register_admin_page' ) );

		// Add AJAX handler for wordpress.org searches
		add_action( 'wp_ajax_dacp_search_wporg', array( $this, 'ajax_search_wporg' ) );

		// Add AJAX handler for manual database re-indexing
		add_action( 'wp_ajax_dacp_reindex_now', array( $this, 'ajax_reindex_now' ) );

		// Scheduled cron & event-driven auto-reindexing
		add_action( 'dacp_daily_reindex_event', array( 'DACP_Site_Indexer', 'reindex_all' ) );
		add_action( 'activated_plugin', array( 'DACP_Site_Indexer', 'mark_dirty' ) );
		add_action( 'deactivated_plugin', array( 'DACP_Site_Indexer', 'mark_dirty' ) );
		add_action( 'after_switch_theme', array( 'DACP_Site_Indexer', 'mark_dirty' ) );
	}

	/**
	 * Ensure daily cron event is scheduled and initial database index exists.
	 */
	public function ensure_cron_and_cache() {
		if ( ! wp_next_scheduled( 'dacp_daily_reindex_event' ) ) {
			wp_schedule_event( time(), 'daily', 'dacp_daily_reindex_event' );
		}

		$cached = get_option( 'dacp_cached_site_index' );
		if ( empty( $cached ) && class_exists( 'DACP_Site_Indexer' ) ) {
			DACP_Site_Indexer::reindex_all();
		}
	}

	/**
	 * Register the dedicated top-level admin menu page
	 */
	public function register_admin_page() {
		add_menu_page(
			esc_html__( 'Admin Command Palette', 'dhruval-admin-command-palette' ),
			esc_html__( 'Command Palette', 'dhruval-admin-command-palette' ),
			'manage_options',
			'dhruval-admin-command-palette',
			array( $this, 'render_dashboard_page' ),
			'dashicons-search', // Modern search magnifying glass dashicon
			99                 // Low priority position at the bottom of the sidebar to avoid cluttering core items
		);

		// Add Go Pro submenu if Pro is not active
		if ( ! class_exists( 'Dhruval_Admin_Command_Palette_Pro' ) ) {
			add_submenu_page(
				'dhruval-admin-command-palette',
				esc_html__( 'Upgrade to Pro', 'dhruval-admin-command-palette' ),
				'<span style="color: #ffb900; font-weight: bold;">' . esc_html__( 'Go Pro', 'dhruval-admin-command-palette' ) . '</span>',
				'manage_options',
				'https://inventkid.com/'
			);
		}
	}

	/**
	 * Render the dedicated dashboard search page
	 */
	public function render_dashboard_page() {
		// Verify capability
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'dhruval-admin-command-palette' ) );
		}
		?>
		<div class="wrap wp-admin-nav-dashboard-wrap">
			<div class="wp-admin-nav-dashboard-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
				<div>
					<h1><?php esc_html_e( 'Dhruval Admin Command Palette Search Console', 'dhruval-admin-command-palette' ); ?></h1>
					<p class="description">
						<?php esc_html_e( 'Type any task in natural language below to jump to the right settings page, or find plugins on WordPress.org if you need new functionality.', 'dhruval-admin-command-palette' ); ?>
					</p>
				</div>
				<button id="dacp-reindex-btn" class="wp-admin-nav-btn wp-admin-nav-btn-outline" style="white-space: nowrap; margin-top: 8px;">
					<svg class="dacp-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> <?php esc_html_e( 'Re-index Site Now', 'dhruval-admin-command-palette' ); ?>
				</button>
			</div>

			<?php
			// Render premium upgrade banner if Pro add-on is not active
			if ( ! class_exists( 'Dhruval_Admin_Command_Palette_Pro' ) ) {
				?>
				<div class="dacp-pro-upgrade-banner" style="max-width: 800px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; box-sizing: border-box;">
					<div style="flex: 1; min-width: 280px;">
						<h3 style="margin: 0 0 4px 0; color: #4f46e5; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 6px; line-height: 1.2;">
							<span style="background: #4f46e5; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Pro Feature</span>
							<?php esc_html_e( 'Direct Database Updates & Logs Rollback', 'dhruval-admin-command-palette' ); ?>
						</h3>
						<p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.4;">
							<?php esc_html_e( 'Upgrade to execute direct database writes using natural language, preview changes before saving, keep activity logs, and revert updates with one-click rollback.', 'dhruval-admin-command-palette' ); ?>
						</p>
					</div>
					<a href="https://inventkid.com/" target="_blank" class="button button-primary" style="background: #4f46e5; border-color: #4f46e5; font-weight: 600; padding: 8px 18px; height: auto; line-height: 1.5; border-radius: 6px; text-shadow: none; box-shadow: none; white-space: nowrap;">
						<?php esc_html_e( 'Upgrade to Pro', 'dhruval-admin-command-palette' ); ?>
					</a>
				</div>
				<?php
			}
			?>
			
			<div class="wp-admin-nav-inline-search-container">
				<div class="wp-admin-nav-search-box-wrapper">
					<span class="wp-admin-nav-search-icon">
						<svg class="dacp-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
					</span>
					<input type="text" id="wp-admin-nav-inline-search-input" placeholder="<?php esc_attr_e( 'What would you like to configure? (e.g., "I want to set shipping rates")', 'dhruval-admin-command-palette' ); ?>" autocomplete="off" />
				</div>
				
				<div id="wp-admin-nav-inline-results" class="wp-admin-nav-results-list">
					<div class="wp-admin-nav-initial-state">
						<span class="wp-admin-nav-state-icon">
							<svg class="dacp-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.55.64 2.94 1.7 3.9.76.76 1.23 1.52 1.41 2.5"></path></svg>
						</span>
						<p><?php esc_html_e( 'Start typing your request above to get suggestions...', 'dhruval-admin-command-palette' ); ?></p>
						<div class="wp-admin-nav-suggestions-hint">
							<strong><?php esc_html_e( 'Try searching for:', 'dhruval-admin-command-palette' ); ?></strong>
							<ul>
								<li><code><?php esc_html_e( 'set flat rate shipping on woo', 'dhruval-admin-command-palette' ); ?></code></li>
								<li><code><?php esc_html_e( 'change permalink settings', 'dhruval-admin-command-palette' ); ?></code></li>
								<li><code><?php esc_html_e( 'edit my profile information', 'dhruval-admin-command-palette' ); ?></code></li>
								<li><code><?php esc_html_e( 'install a membership plugin', 'dhruval-admin-command-palette' ); ?></code></li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Enqueue stylesheet and JavaScript
	 */
	public function enqueue_assets( $hook ) {
		// Enqueue modern CSS file
		wp_enqueue_style(
			'dhruval-admin-command-palette-css',
			DACP_URL . 'assets/css/admin.css',
			array(),
			'1.2.0'
		);

		// Enqueue JS
		wp_enqueue_script(
			'dhruval-admin-command-palette-js',
			DACP_URL . 'assets/js/admin.js',
			array( 'jquery' ),
			'1.2.0',
			true
		);

		// Get all searchable settings pages from database index cache
		$search_data = DACP_Site_Indexer::get_site_index();

		// Get active and installed plugins to pass to JS
		$installed_plugins = array();
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		$all_plugins = get_plugins();
		foreach ( array_keys( $all_plugins ) as $plugin_file ) {
			$slug = dirname( $plugin_file );
			if ( '.' !== $slug && ! empty( $slug ) ) {
				$installed_plugins[] = $slug;
			} else {
				$installed_plugins[] = basename( $plugin_file, '.php' );
			}
		}

		$active_plugins = array();
		$active_plugin_files = (array) get_option( 'active_plugins', array() );
		foreach ( $active_plugin_files as $plugin_file ) {
			$slug = dirname( $plugin_file );
			if ( '.' !== $slug && ! empty( $slug ) ) {
				$active_plugins[] = $slug;
			} else {
				$active_plugins[] = basename( $plugin_file, '.php' );
			}
		}

		// Localize script to pass menu data and nonces to JS
		wp_localize_script(
			'dhruval-admin-command-palette-js',
			'dacpData',
			array(
				'pages'            => $search_data,
				'adminUrl'         => admin_url(),
				'currentHook'      => $hook,
				'installedPlugins' => $installed_plugins,
				'activePlugins'    => $active_plugins,
				'nonce'            => wp_create_nonce( 'dacp_search_wporg_nonce' ),
				'reindexNonce'     => wp_create_nonce( 'dacp_reindex_nonce' ),
				'i18n'             => array(
					'noResults'           => __( 'No local pages matched your request.', 'dhruval-admin-command-palette' ),
					'searchingWpOrg'      => __( 'Searching WordPress.org Plugin Directory...', 'dhruval-admin-command-palette' ),
					'wpOrgTitle'          => __( 'WordPress.org Recommendations', 'dhruval-admin-command-palette' ),
					'wpOrgSubtitle'       => __( 'Install these plugins to add the requested functionality', 'dhruval-admin-command-palette' ),
					'visitPage'           => __( 'Go to page', 'dhruval-admin-command-palette' ),
					'installPlugin'       => __( 'Install Plugin', 'dhruval-admin-command-palette' ),
					'activeInstalls'      => __( 'active installations', 'dhruval-admin-command-palette' ),
					'rating'              => __( 'Rating', 'dhruval-admin-command-palette' ),
					'author'              => __( 'by', 'dhruval-admin-command-palette' ),
					'searchPlaceholder'   => __( 'Search admin pages or type a task...', 'dhruval-admin-command-palette' ),
					'keyboardShortcutTip' => __( 'Press Ctrl+K or Cmd+K from anywhere to search', 'dhruval-admin-command-palette' ),
					'reindexing'          => __( 'Re-indexing site...', 'dhruval-admin-command-palette' ),
					'reindexSuccess'      => __( 'Site re-indexed successfully!', 'dhruval-admin-command-palette' ),
				)
			)
		);
	}

	/**
	 * AJAX handler for manual database re-indexing
	 */
	public function ajax_reindex_now() {
		check_ajax_referer( 'dacp_reindex_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Forbidden' );
		}

		$index = DACP_Site_Indexer::reindex_all();

		// Trigger action hook to allow Pro or other extensions to rebuild custom indexes
		do_action( 'dacp_reindex_now' );

		wp_send_json_success( array(
			'count' => count( $index ),
			'pages' => $index,
		) );
	}

	/**
	 * AJAX handler for WordPress.org API searches
	 */
	public function ajax_search_wporg() {
		// Verify nonce for security (CSRF protection)
		check_ajax_referer( 'dacp_search_wporg_nonce', 'nonce' );

		// Check capability
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Forbidden' );
		}

		$search = isset( $_GET['search'] ) ? sanitize_text_field( wp_unslash( $_GET['search'] ) ) : '';
		
		if ( empty( $search ) ) {
			wp_send_json_error( 'Empty search query' );
		}

		$url = 'https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&request[search]=' . urlencode( $search ) . '&request[per_page]=3&request[fields][active_installs]=true&request[fields][short_description]=true&request[fields][rating]=true&request[fields][ratings]=true&request[fields][author]=true';
		
		$response = wp_remote_get( $url );
		
		if ( is_wp_error( $response ) ) {
			wp_send_json_error( $response->get_error_message() );
		}
		
		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body );
		
		if ( ! $data ) {
			wp_send_json_error( 'Failed to decode API response' );
		}
		
		wp_send_json_success( $data );
	}

	/**
	 * Render the global spotlight search modal in the footer
	 */
	public function render_global_palette() {
		// Do not show on non-logged in or login screens
		if ( ! is_user_logged_in() || ! is_admin() ) {
			return;
		}
		?>
		<div id="wp-admin-nav-palette" class="wp-admin-nav-modal-overlay is-hidden" style="display: none !important;">
			<div class="wp-admin-nav-modal-container">
				<div class="wp-admin-nav-modal-header">
					<span class="wp-admin-nav-modal-search-icon">
						<svg class="dacp-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
					</span>
					<input type="text" id="wp-admin-nav-modal-search-input" placeholder="<?php esc_attr_e( 'Type what you want to do... (e.g. "I want to set shipping")', 'dhruval-admin-command-palette' ); ?>" autocomplete="off" />
					<span class="wp-admin-nav-modal-close-hint">ESC</span>
				</div>
				<div class="wp-admin-nav-modal-body">
					<div id="wp-admin-nav-modal-results" class="wp-admin-nav-results-list">
						<div class="wp-admin-nav-initial-state">
							<span class="wp-admin-nav-state-icon">
								<svg class="dacp-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
							</span>
							<p><?php esc_html_e( 'Type a natural language command to jump to any setting screen.', 'dhruval-admin-command-palette' ); ?></p>
							<span class="wp-admin-nav-shortcut-badge"><?php esc_html_e( 'Tip: Use Ctrl + K to toggle this palette anywhere.', 'dhruval-admin-command-palette' ); ?></span>
						</div>
					</div>
				</div>
				<div class="wp-admin-nav-modal-footer">
					<span class="wp-admin-nav-footer-hint"><svg class="dacp-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="6" y1="8" x2="6" y2="8.01"></line><line x1="10" y1="8" x2="10" y2="8.01"></line><line x1="14" y1="8" x2="14" y2="8.01"></line><line x1="18" y1="8" x2="18" y2="8.01"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg> <span>↑↓</span> <?php esc_html_e( 'to navigate', 'dhruval-admin-command-palette' ); ?></span>
					<span class="wp-admin-nav-footer-hint"><svg class="dacp-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg> <span>Enter</span> <?php esc_html_e( 'to select', 'dhruval-admin-command-palette' ); ?></span>
					<span class="wp-admin-nav-footer-hint"><span>ESC</span> <?php esc_html_e( 'to close', 'dhruval-admin-command-palette' ); ?></span>
					<button id="dacp-reindex-btn-modal" class="wp-admin-nav-reindex-modal-btn">
						<svg class="dacp-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> <?php esc_html_e( 'Re-index Site', 'dhruval-admin-command-palette' ); ?>
					</button>
				</div>
			</div>
		</div>
		<?php
	}
}

// Instantiate the plugin
new DACP_Main();
