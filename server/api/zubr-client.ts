/**
 * ZUBR-WEB: HTTP client for communicating with zubr-server API
 *
 * This module handles all authentication-related API calls to the zubr-server,
 * including user signup, login, and JWT token management.
 */

import log from "../log";
import colors from "chalk";
import Config from "../config";

interface ZubrLoginResponse {
	success: boolean;
	token?: string;
	username?: string;
	error?: string;
}

interface ZubrSignupResponse {
	success: boolean;
	username?: string;
	error?: string;
}

interface ZubrUserConfig {
	log: boolean;
	clientSettings: {
		[key: string]: any;
	};
	networks: any[];
}

interface ZubrConfigResponse {
	success: boolean;
	config?: ZubrUserConfig;
	error?: string;
}

class ZubrClient {
	private baseUrl: string;

	constructor() {
		// Get zubr-server URL from config, default to localhost:3000
		this.baseUrl = Config.values.zubrServer?.url || "http://localhost:3000";
	}

	/**
	 * Authenticate a user with zubr-server
	 * @param username - The username
	 * @param password - The password
	 * @returns Promise with login response containing JWT token
	 */
	async login(username: string, password: string): Promise<ZubrLoginResponse> {
		try {
			const response = await fetch(`${this.baseUrl}/api/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					username,
					password,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				log.warn(
					`Zubr-server login failed for user ${colors.bold(username)}: ${
						response.status
					} ${response.statusText}`
				);
				return {
					success: false,
					error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			const data = await response.json();

			if (data.token) {
				log.info(`User ${colors.bold(username)} authenticated via zubr-server`);
				return {
					success: true,
					token: data.token,
					username: data.username || username,
				};
			} else {
				log.warn(`Zubr-server login response missing token for user ${colors.bold(username)}`);
				return {
					success: false,
					error: data.error || "Invalid response from server",
				};
			}
		} catch (error) {
			log.error(
				`Error connecting to zubr-server at ${this.baseUrl}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return {
				success: false,
				error: `Cannot connect to zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`,
			};
		}
	}

	/**
	 * Register a new user with zubr-server
	 * @param username - The desired username
	 * @param password - The password
	 * @param email - Optional email address
	 * @returns Promise with signup response
	 */
	async signup(
		username: string,
		password: string,
		email?: string
	): Promise<ZubrSignupResponse> {
		try {
			const response = await fetch(`${this.baseUrl}/api/signup`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					username,
					password,
					email,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				log.warn(
					`Zubr-server signup failed for user ${colors.bold(username)}: ${
						response.status
					} ${response.statusText}`
				);
				return {
					success: false,
					error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			const data = await response.json();

			if (data.success || data.username) {
				log.info(`User ${colors.bold(username)} registered via zubr-server`);
				return {
					success: true,
					username: data.username || username,
				};
			} else {
				log.warn(`Zubr-server signup failed for user ${colors.bold(username)}`);
				return {
					success: false,
					error: data.error || "Registration failed",
				};
			}
		} catch (error) {
			log.error(
				`Error connecting to zubr-server at ${this.baseUrl}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return {
				success: false,
				error: `Cannot connect to zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`,
			};
		}
	}

	/**
	 * Verify a JWT token with zubr-server
	 * @param token - The JWT token to verify
	 * @returns Promise with verification result
	 */
	async verifyToken(token: string): Promise<{success: boolean; username?: string; error?: string}> {
		try {
			const response = await fetch(`${this.baseUrl}/api/verify`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				return {
					success: false,
					error: "Token verification failed",
				};
			}

			const data = await response.json();
			return {
				success: true,
				username: data.username,
			};
		} catch (error) {
			log.error(
				`Error verifying token with zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return {
				success: false,
				error: `Cannot connect to zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`,
			};
		}
	}

	/**
	 * Fetch user configuration from zubr-server
	 * @param token - The JWT token for authentication
	 * @returns Promise with user config
	 */
	async getUserConfig(token: string): Promise<ZubrConfigResponse> {
		try {
			const response = await fetch(`${this.baseUrl}/api/user/config`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				log.warn(
					`Failed to fetch user config from zubr-server: ${response.status} ${response.statusText}`
				);
				return {
					success: false,
					error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			const data = await response.json();

			log.info("User configuration fetched from zubr-server");
			return {
				success: true,
				config: data.config || data, // Support both {config: {...}} and direct config
			};
		} catch (error) {
			log.error(
				`Error fetching user config from zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return {
				success: false,
				error: `Cannot connect to zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`,
			};
		}
	}

	/**
	 * Save user configuration to zubr-server
	 * @param token - The JWT token for authentication
	 * @param config - The user configuration to save
	 * @returns Promise with save result
	 */
	async saveUserConfig(token: string, config: ZubrUserConfig): Promise<{success: boolean; error?: string}> {
		try {
			const response = await fetch(`${this.baseUrl}/api/user/config`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${token}`,
				},
				body: JSON.stringify(config),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				log.warn(
					`Failed to save user config to zubr-server: ${response.status} ${response.statusText}`
				);
				return {
					success: false,
					error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			log.info("User configuration saved to zubr-server");
			return {
				success: true,
			};
		} catch (error) {
			log.error(
				`Error saving user config to zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return {
				success: false,
				error: `Cannot connect to zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`,
			};
		}
	}
}

// Export singleton instance
export default new ZubrClient();
