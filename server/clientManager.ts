import _ from "lodash";
import colors from "chalk";
import crypto from "crypto";
import fs from "fs";
import path from "path";

import Auth from "./plugins/auth";
import Client, {UserConfig} from "./client";
import Config from "./config";
import WebPush from "./plugins/webpush";
import log from "./log";
import {Server} from "./server";

class ClientManager {
	clients: Client[];
	sockets!: Server;
	identHandler: any;
	webPush!: WebPush;

	constructor() {
		this.clients = [];
	}

	init(identHandler, sockets: Server) {
		this.sockets = sockets;
		this.identHandler = identHandler;
		this.webPush = new WebPush();

		// ZUBR-WEB: Stateless mode - don't load users from disk
		// Users are created in-memory on login from zubr-server API data
		log.info("Running in stateless mode - users created on-demand from zubr-server");

		if (!Config.values.public) {
			// Note: loadUsers() and autoloadUsers() disabled for stateless operation
		}
	}

	findClient(name: string) {
		name = name.toLowerCase();
		return this.clients.find((u) => u.name.toLowerCase() === name);
	}

	loadUsers() {
		let users = this.getUsers();

		if (users.length === 0) {
			log.info(
				`There are currently no users. Create one with ${colors.bold(
					"thelounge add <name>"
				)}.`
			);

			return;
		}

		const alreadySeenUsers = new Set();
		users = users.filter((user) => {
			user = user.toLowerCase();

			if (alreadySeenUsers.has(user)) {
				log.error(
					`There is more than one user named "${colors.bold(
						user
					)}". Usernames are now case insensitive, duplicate users will not load.`
				);

				return false;
			}

			alreadySeenUsers.add(user);

			return true;
		});

		// This callback is used by Auth plugins to load users they deem acceptable
		const callbackLoadUser = (user) => {
			this.loadUser(user);
		};

		if (!Auth.loadUsers(users, callbackLoadUser)) {
			// Fallback to loading all users
			users.forEach((name) => this.loadUser(name));
		}

		log.info(`${colors.bold(String(users.length))} users loaded`);
	}

	autoloadUsers() {
		fs.watch(Config.getUsersPath(), (_eventType, file) => {
			if (!file.endsWith(".json")) {
				return;
			}

			const name = file.slice(0, -5);

			const userPath = Config.getUserConfigPath(name);

			if (fs.existsSync(userPath)) {
				this.loadUser(name);
				return;
			}

			const client = _.find(this.clients, {name});

			if (client) {
				client.quit(true);
				this.clients = _.without(this.clients, client);
				log.info(`User ${colors.bold(name)} disconnected and removed.`);
			}
		});
	}

	loadUser(name: string) {
		// ZUBR-WEB: In stateless mode, check if client already exists in-memory first
		let client = this.findClient(name);

		if (client) {
			// Client already exists (created by auth plugin in stateless mode)
			return client;
		}

		// Try to load from disk (for compatibility, but unused in stateless mode)
		const userConfig = this.readUserConfig(name);

		if (!userConfig) {
			return;
		}

		// Create new client from disk config
		client = new Client(this, name, userConfig);
		client.connect();
		this.clients.push(client);

		return client;
	}

	getUsers = function () {
		if (!fs.existsSync(Config.getUsersPath())) {
			return [];
		}

		return fs
			.readdirSync(Config.getUsersPath())
			.filter((file) => file.endsWith(".json"))
			.map((file) => file.slice(0, -5));
	};

	addUser(name: string, password: string | null, enableLog?: boolean) {
		// ZUBR-WEB: Stateless mode - no file creation
		// This method is a no-op for backward compatibility
		log.info(`User ${colors.green(name)} will be created in-memory on first login`);
		return true;

		/* ORIGINAL FILE CREATION CODE - DISABLED FOR STATELESS MODE
		if (path.basename(name) !== name) {
			throw new Error(`${name} is an invalid username.`);
		}

		const userPath = Config.getUserConfigPath(name);

		if (fs.existsSync(userPath)) {
			log.error(`User ${colors.green(name)} already exists.`);
			return false;
		}

		// ZUBR-WEB: Auto-create home network if enabled
		let networks;
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
					host: homeServer.host || "localhost",
					port: homeServer.port || 6667,
					tls: homeServer.tls || false,
					rejectUnauthorized: homeServer.rejectUnauthorized !== false,
					password: "",
					nick: name, // Use username as IRC nick
					username: name,
					realname: name,
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
		}

		const user = {
			password: password || "",
			log: enableLog,
			networks: networks || [], // ZUBR-WEB: Include home network
		};

		try {
			const tmpPath = userPath + ".tmp";
			fs.writeFileSync(tmpPath, JSON.stringify(user, null, "\t"), {
				mode: 0o600,
			});
			fs.renameSync(tmpPath, userPath);
		} catch (e: any) {
			log.error(`Failed to create user ${colors.green(name)} (${e})`);
			throw e;
		}

		try {
			const userFolderStat = fs.statSync(Config.getUsersPath());
			const userFileStat = fs.statSync(userPath);

			if (
				userFolderStat &&
				userFileStat &&
				(userFolderStat.uid !== userFileStat.uid || userFolderStat.gid !== userFileStat.gid)
			) {
				log.warn(
					`User ${colors.green(
						name
					)} has been created, but with a different uid (or gid) than expected.`
				);
				log.warn(
					"The file owner has been changed to the expected user. " +
						"To prevent any issues, please run thelounge commands " +
						"as the correct user that owns the config folder."
				);
				log.warn(
					"See https://thelounge.chat/docs/usage#using-the-correct-system-user for more information."
				);
				fs.chownSync(userPath, userFolderStat.uid, userFolderStat.gid);
			}
		} catch (e: any) {
			// We're simply verifying file owner as a safe guard for users
			// that run `thelounge add` as root, so we don't care if it fails
		}

		return true;
		*/
	}

	getDataToSave(client: Client) {
		const json = Object.assign({}, client.config, {
			networks: client.networks.map((n) => n.export()),
		});
		const newUser = JSON.stringify(json, null, "\t");
		const newHash = crypto.createHash("sha256").update(newUser).digest("hex");

		return {newUser, newHash};
	}

	async saveUser(client: Client, callback?: (err?: any) => void) {
		// ZUBR-WEB: Stateless mode - save to zubr-server API instead of files
		if (!client.config.zubrToken) {
			log.warn(`Cannot save user ${colors.bold(client.name)} - no zubr token available`);
			if (callback) {
				callback(new Error("No zubr token available"));
			}
			return false;
		}

		try {
			// Import zubrClient dynamically to avoid circular dependency
			const zubrClient = require("./api/zubr-client").default;

			// Prepare config for saving (exclude sensitive/session data)
			const configToSave = {
				log: client.config.log,
				clientSettings: client.config.clientSettings || {},
				networks: client.networks.map((n) => n.export()),
			};

			const result = await zubrClient.saveUserConfig(client.config.zubrToken, configToSave);

			if (result.success) {
				if (callback) {
					callback();
				}
				return true;
			} else {
				log.error(
					`Failed to save user ${colors.bold(client.name)} to zubr-server: ${result.error}`
				);
				if (callback) {
					callback(new Error(result.error));
				}
				return false;
			}
		} catch (error) {
			log.error(
				`Error saving user ${colors.bold(client.name)} to zubr-server: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			if (callback) {
				callback(error);
			}
			return false;
		}

		/* ORIGINAL FILE SAVING CODE - DISABLED FOR STATELESS MODE
		const {newUser, newHash} = this.getDataToSave(client);

		// Do not write to disk if the exported data hasn't actually changed
		if (client.fileHash === newHash) {
			return;
		}

		const pathReal = Config.getUserConfigPath(client.name);
		const pathTemp = pathReal + ".tmp";

		try {
			// Write to a temp file first, in case the write fails
			// we do not lose the original file (for example when disk is full)
			fs.writeFileSync(pathTemp, newUser, {
				mode: 0o600,
			});
			fs.renameSync(pathTemp, pathReal);

			return callback ? callback() : true;
		} catch (e: any) {
			log.error(`Failed to update user ${colors.green(client.name)} (${e})`);

			if (callback) {
				callback(e);
			}
		}
		*/
	}

	removeUser(name) {
		const userPath = Config.getUserConfigPath(name);

		if (!fs.existsSync(userPath)) {
			log.error(`Tried to remove non-existing user ${colors.green(name)}.`);
			return false;
		}

		fs.unlinkSync(userPath);

		return true;
	}

	readUserConfig(name: string) {
		const userPath = Config.getUserConfigPath(name);

		if (!fs.existsSync(userPath)) {
			log.error(`Tried to read non-existing user ${colors.green(name)}`);
			return false;
		}

		try {
			const data = fs.readFileSync(userPath, "utf-8");
			return JSON.parse(data) as UserConfig;
		} catch (e: any) {
			log.error(`Failed to read user ${colors.bold(name)}: ${e}`);
		}

		return false;
	}
}

export default ClientManager;
