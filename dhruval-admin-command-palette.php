<?php
/*
Plugin Name: Dhruval Admin Command Palette
Plugin URI: https://inventkid.com/
Description: A textbox-based Spotlight/Raycast-like navigation command palette for the WordPress Admin Dashboard. Instantly find pages or search plugins on WordPress.org.
Version: 1.0.0
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

/**
 * Class DACP_Main
 * Main class to initialize the plugin.
 */
class DACP_Main {

	public function __construct() {
		// Enqueue scripts and styles in the admin dashboard
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		// Inject the search overlay markup in the footer of all admin pages
		add_action( 'admin_footer', array( $this, 'render_global_palette' ) );

		// Add a dedicated admin menu page
		add_action( 'admin_menu', array( $this, 'register_admin_page' ) );

		// Add AJAX handler for wordpress.org searches
		add_action( 'wp_ajax_dacp_search_wporg', array( $this, 'ajax_search_wporg' ) );
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
			<h1><?php esc_html_e( 'Dhruval Admin Command Palette Search Console', 'dhruval-admin-command-palette' ); ?></h1>
			<p class="description">
				<?php esc_html_e( 'Type any task in natural language below to jump to the right settings page, or find plugins on WordPress.org if you need new functionality.', 'dhruval-admin-command-palette' ); ?>
			</p>
			
			<div class="wp-admin-nav-inline-search-container">
				<div class="wp-admin-nav-search-box-wrapper">
					<span class="wp-admin-nav-search-icon">🔍</span>
					<input type="text" id="wp-admin-nav-inline-search-input" placeholder="<?php esc_attr_e( 'What would you like to configure? (e.g., "I want to set shipping rates")', 'dhruval-admin-command-palette' ); ?>" autocomplete="off" />
				</div>
				
				<div id="wp-admin-nav-inline-results" class="wp-admin-nav-results-list">
					<div class="wp-admin-nav-initial-state">
						<span class="wp-admin-nav-state-icon">💡</span>
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
			'1.0.0'
		);

		// Enqueue JS
		wp_enqueue_script(
			'dhruval-admin-command-palette-js',
			DACP_URL . 'assets/js/admin.js',
			array( 'jquery' ),
			'1.0.0',
			true
		);

		// Get all searchable settings pages
		$search_data = DACP_Menu_Indexer::get_searchable_menu_data();

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

		// Localize script to pass menu data and nonce to JS
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
				)
			)
		);
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
		<div id="wp-admin-nav-palette" class="wp-admin-nav-modal-overlay" style="display: none;">
			<div class="wp-admin-nav-modal-container">
				<div class="wp-admin-nav-modal-header">
					<span class="wp-admin-nav-modal-search-icon">🔍</span>
					<input type="text" id="wp-admin-nav-modal-search-input" placeholder="<?php esc_attr_e( 'Type what you want to do... (e.g. "I want to set shipping")', 'dhruval-admin-command-palette' ); ?>" autocomplete="off" />
					<span class="wp-admin-nav-modal-close-hint">ESC</span>
				</div>
				<div class="wp-admin-nav-modal-body">
					<div id="wp-admin-nav-modal-results" class="wp-admin-nav-results-list">
						<div class="wp-admin-nav-initial-state">
							<span class="wp-admin-nav-state-icon">⚡</span>
							<p><?php esc_html_e( 'Type a natural language command to jump to any setting screen.', 'dhruval-admin-command-palette' ); ?></p>
							<span class="wp-admin-nav-shortcut-badge"><?php esc_html_e( 'Tip: Use Ctrl + K to toggle this palette anywhere.', 'dhruval-admin-command-palette' ); ?></span>
						</div>
					</div>
				</div>
				<div class="wp-admin-nav-modal-footer">
					<span class="wp-admin-nav-footer-hint">⌨️ <span>↑↓</span> <?php esc_html_e( 'to navigate', 'dhruval-admin-command-palette' ); ?></span>
					<span class="wp-admin-nav-footer-hint">↩️ <span>Enter</span> <?php esc_html_e( 'to select', 'dhruval-admin-command-palette' ); ?></span>
					<span class="wp-admin-nav-footer-hint"><span>ESC</span> <?php esc_html_e( 'to close', 'dhruval-admin-command-palette' ); ?></span>
				</div>
			</div>
		</div>
		<?php
	}
}

// Instantiate the plugin
new DACP_Main();
