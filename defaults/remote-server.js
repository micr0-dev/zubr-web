"use strict";

/**
 * ZUBR-WEB: Default configuration for remote server connections
 *
 * These defaults are used when users connect to remote IRC servers
 * via the federation feature. All remote connections use secure defaults.
 */

module.exports = {
	// Connection settings - always secure
	port: 6697,
	tls: true,
	rejectUnauthorized: true,
	password: "",

	// User identity (will be set dynamically using home instance domain)
	nick: "",  // Format: username_domain with periods as hyphens
	username: "", // Format: username_domain with underscore separator
	realname: "", // Format: username@domain with at symbol separator

	// SASL - disabled by default
	sasl: "",
	saslAccount: "",
	saslPassword: "",

	// Channels - none by default
	join: "",

	// Messages
	leaveMessage: "",

	// Proxy - disabled
	proxyEnabled: false,
	proxyHost: "",
	proxyPort: 1080,
	proxyUsername: "",
	proxyPassword: "",

	// Other
	commands: [],
	ignoreList: [],
};
