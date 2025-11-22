/**
 * ZUBR-WEB: Authentication plugin for zubr-server API
 *
 * This plugin handles authentication by forwarding credentials to the zubr-server
 * API and managing JWT tokens for authenticated sessions.
 */

import colors from "chalk";
import log from "../../log";
import zubrClient from "../../api/zubr-client";
import type {AuthHandler} from "../auth";
import Config from "../../config";

const zubrAuth: AuthHandler = async (manager, client, user, password, callback) => {
	// If no user is found or no password provided, fail immediately
	if (!user || !password) {
		log.warn("Zubr auth: missing username or password");
		return callback(false);
	}

	try {
		// Authenticate with zubr-server
		const response = await zubrClient.login(user, password);

		if (response.success && response.token) {
			// ZUBR-WEB: Stateless mode - create user in-memory if doesn't exist
			if (!client) {
				// Fetch user config from zubr-server
				const configResponse = await zubrClient.getUserConfig(response.token);

				let networks: any[] = [];
				let clientSettings = {};

				if (configResponse.success && configResponse.config && configResponse.config.networks.length > 0) {
					// User has saved config - use it
					networks = configResponse.config.networks;
					clientSettings = configResponse.config.clientSettings || {};

					log.info(
						`User ${colors.bold(user)} config loaded from zubr-server (${networks.length} networks)`
					);
				} else {
					// No saved config - create default home network if enabled
					if (Config.values.homeServer?.enabled) {
						const homeServer = Config.values.homeServer;
						const uuid = require("uuid");

						// Convert channel names to channel objects
						const channels = (homeServer.channels || []).map((channelName: string) => ({
							name: channelName,
						}));

						networks = [
							{
								uuid: uuid.v4(),
								name: homeServer.name || "Home Server",
								host: homeServer.host || "127.0.0.1",
								port: homeServer.port || 6667,
								tls: homeServer.tls || false,
								rejectUnauthorized: homeServer.rejectUnauthorized !== false,
								password: "",
								nick: user, // Use username as IRC nick
								username: user,
								realname: user,
								sasl: "",
								saslAccount: "",
								saslPassword: "",
								channels: channels,
								ignoreList: [],
								proxyHost: "",
								proxyPort: 1080,
								proxyUsername: "",
								proxyPassword: "",
								proxyEnabled: false,
							},
						];

						log.info(
							`User ${colors.bold(user)} has no saved config, created default home network`
						);
					}
				}

				// Create new in-memory user with token and config
				const userConfig = {
					log: true,
					password: "", // No local password in stateless mode
					zubrToken: response.token,
					sessions: {},
					clientSettings: clientSettings,
					networks: networks,
				};

				// Create client in-memory
				const Client = require("../../client").default;
				client = new Client(manager, user, userConfig);
				client.connect();
				manager.clients.push(client);

				log.info(
					`User ${colors.bold(user)} authenticated and created in-memory via zubr-server`
				);
			} else {
				// Existing client, just update token
				client.config.zubrToken = response.token;

				log.info(
					`User ${colors.bold(user)} successfully authenticated via zubr-server`
				);
			}

			// Authentication successful
			callback(true);
		} else {
			log.warn(
				`Zubr auth failed for user ${colors.bold(user)}: ${
					response.error || "Unknown error"
				}`
			);
			callback(false);
		}
	} catch (error) {
		log.error(
			`Error during zubr authentication for user ${colors.bold(user)}: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
		callback(false);
	}
};

export default {
	moduleName: "zubr",
	auth: zubrAuth,
	isEnabled: () => {
		// Enable if zubr-server is configured
		const enabled = Config.values.zubrServer?.enabled !== false;
		if (enabled) {
			log.info("Zubr authentication plugin enabled");
		}
		return enabled;
	},
};
