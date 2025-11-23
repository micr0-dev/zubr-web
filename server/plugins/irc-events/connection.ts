import _ from "lodash";
import {IrcEventHandler} from "../../client";

import log from "../../log";
import Msg from "../../models/msg";
import Helper from "../../helper";
import Config from "../../config";
import {MessageType} from "../../../shared/types/msg";
import {ChanType, ChanState} from "../../../shared/types/chan";

export default <IrcEventHandler>function (irc, network) {
	const client = this;

	network.getLobby().pushMessage(
		client,
		new Msg({
			text: "Network created, connecting to " + network.host + ":" + network.port + "...",
		}),
		true
	);

	// ZUBR-WEB: Debug connection settings
	log.info(
		`Connecting to ${network.host}:${network.port} (TLS: ${network.tls}, nick: ${network.nick})`
	);

	irc.on("registered", function () {
		// ZUBR-WEB: Update network name from IRC server if available
		const ircOptions = irc.network.options as any;

		// Try to get network name from IRC server options
		let serverNetworkName = ircOptions.NETWORK as string;

		// If NETWORK option not available, try using the hostname
		if (!serverNetworkName && network.name === "Home Server") {
			serverNetworkName = network.host;
			log.info(
				`IRC server did not provide NETWORK option, using hostname: ${serverNetworkName}`
			);
		}

		if (serverNetworkName && serverNetworkName !== network.name) {
			network.name = serverNetworkName;
			network.getLobby().name = serverNetworkName;

			// Save updated network name to user config
			client.save();

			log.info(
				`Updated network name to "${serverNetworkName}" from IRC server for ${client.name}`
			);

			// ZUBR-WEB: Re-detect server type now that we have the actual domain
			detectServerType(network, client);
		}

		if (network.irc.network.cap.enabled.length > 0) {
			network.getLobby().pushMessage(
				client,
				new Msg({
					text: "Enabled capabilities: " + network.irc.network.cap.enabled.join(", "),
				}),
				true
			);
		}

		// Always restore away message for this network
		if (network.awayMessage) {
			irc.raw("AWAY", network.awayMessage);
			// Only set generic away message if there are no clients attached
		} else if (client.awayMessage && _.size(client.attachedClients) === 0) {
			irc.raw("AWAY", client.awayMessage);
		}

		let delay = 1000;

		if (Array.isArray(network.commands)) {
			network.commands.forEach((cmd) => {
				setTimeout(function () {
					client.input({
						target: network.getLobby().id,
						text: cmd,
					});
				}, delay);
				delay += 1000;
			});
		}

		network.channels.forEach((chan) => {
			if (chan.type !== ChanType.CHANNEL) {
				return;
			}

			setTimeout(function () {
				network.irc.join(chan.name, chan.key);
			}, delay);
			delay += 1000;
		});
	});

	irc.on("socket connected", function () {
		if (irc.network.options.PREFIX) {
			network.serverOptions.PREFIX.update(irc.network.options.PREFIX);
		}

		network.getLobby().pushMessage(
			client,
			new Msg({
				text: "Connected to the network.",
			}),
			true
		);

		// ZUBR-WEB: Detect server type (Zubr vs IRC)
		detectServerType(network, client);

		sendStatus();
	});

	irc.on("close", function () {
		network.getLobby().pushMessage(
			client,
			new Msg({
				text: "Disconnected from the network, and will not reconnect. Use /connect to reconnect again.",
			}),
			true
		);
	});

	let identSocketId;

	irc.on("raw socket connected", function (socket) {
		let ident = client.name || network.username;

		if (Config.values.useHexIp) {
			ident = Helper.ip2hex(client.config.browser!.ip!);
		}

		identSocketId = client.manager.identHandler.addSocket(socket, ident);
	});

	irc.on("socket close", function (error) {
		if (identSocketId > 0) {
			client.manager.identHandler.removeSocket(identSocketId);
			identSocketId = 0;
		}

		network.channels.forEach((chan) => {
			chan.users = new Map();
			chan.state = ChanState.PARTED;
		});

		if (error) {
			network.getLobby().pushMessage(
				client,
				new Msg({
					type: MessageType.ERROR,
					text: `Connection closed unexpectedly: ${String(error)}`,
				}),
				true
			);
		}

		if (network.keepNick) {
			// We disconnected without getting our original nick back yet, just set it back locally
			irc.options.nick = irc.user.nick = network.keepNick;

			network.setNick(network.keepNick);
			network.keepNick = null;

			client.emit("nick", {
				network: network.uuid,
				nick: network.nick,
			});
		}

		sendStatus();
	});

	if (Config.values.debug.ircFramework) {
		irc.on("debug", function (message) {
			log.debug(
				`[${client.name} (${client.id}) on ${network.name} (${network.uuid}]`,
				message
			);
		});
	}

	if (Config.values.debug.raw) {
		irc.on("raw", function (message) {
			network.getLobby().pushMessage(
				client,
				new Msg({
					self: !message.from_server,
					type: MessageType.RAW,
					text: message.line,
				}),
				true
			);
		});
	}

	irc.on("socket error", function (err) {
		log.error(`Socket error on ${network.host}:${network.port}: ${err}`);
		network.getLobby().pushMessage(
			client,
			new Msg({
				type: MessageType.ERROR,
				text: "Socket error: " + err,
			}),
			true
		);
	});

	// ZUBR-WEB: Debug connection timeout
	irc.on("connecting", function () {
		log.info(`Connection attempt to ${network.host}:${network.port} starting...`);
	});

	irc.on("reconnecting", function (data) {
		network.getLobby().pushMessage(
			client,
			new Msg({
				text: `Disconnected from the network. Reconnecting in ${Math.round(
					data.wait / 1000
				)} seconds… (Attempt ${Number(data.attempt)})`,
			}),
			true
		);
	});

	irc.on("ping timeout", function () {
		network.getLobby().pushMessage(
			client,
			new Msg({
				text: "Ping timeout, disconnecting…",
			}),
			true
		);
	});

	irc.on("server options", function (data) {
		network.serverOptions.PREFIX.update(data.options.PREFIX);

		if (data.options.CHANTYPES) {
			network.serverOptions.CHANTYPES = data.options.CHANTYPES;
		}

		network.serverOptions.NETWORK = data.options.NETWORK;

		client.emit("network:options", {
			network: network.uuid,
			serverOptions: network.serverOptions,
		});
	});

	// ZUBR-WEB: Detect if server is Zubr or IRC
	async function fetchUserRole(network: any, client: any) {
		try {
			const jwtToken = client.config.zubrToken;
			if (!jwtToken) {
				log.debug("No JWT token available to fetch user role");
				return;
			}

			// ZUBR-WEB: Determine correct API URL
			const isHomeServer = network.host === "127.0.0.1" || network.host === "localhost";
			let zubrServerUrl: string;

			if (isHomeServer) {
				// For home server, use the zubr-server URL from config
				zubrServerUrl = Config.values.zubrServer?.url || "http://localhost:3000";
			} else {
				// For remote servers, try HTTPS:443 then HTTP:80
				zubrServerUrl = `https://${network.host}:443`;
			}

			log.debug(`[ZUBR] Fetching user role from: ${zubrServerUrl}/api/user/me`);

			const response = await fetch(`${zubrServerUrl}/api/user/me`, {
				headers: {
					Authorization: `Bearer ${jwtToken}`,
				},
			});

			if (!response.ok) {
				log.debug(`Failed to fetch user role: ${response.statusText}`);
				return;
			}

			const data = (await response.json()) as any;
			if (data.role) {
				network.zubrRole = data.role;
				log.info(
					`Fetched user role for ${network.name || network.host}: ${data.role}`
				);
			}
		} catch (error) {
			log.debug(`Error fetching user role: ${error}`);
		}
	}

	async function detectServerType(network: any, client: any) {
		const isHomeServer = network.host === "127.0.0.1" || network.host === "localhost";

		try {
			const http = require("http");
			const https = require("https");
			const {URL} = require("url");

			let urlsToCheck: string[] = [];

			if (isHomeServer) {
				// For home server, check the zubr-server API URL
				const zubrServerUrl = Config.values.zubrServer?.url || "http://localhost:3000";
				urlsToCheck = [`${zubrServerUrl}/api/info`];
			} else {
				// For remote servers, try HTTPS:443 then HTTP:80
				urlsToCheck = [
					`https://${network.host}:443/api/info`,
					`http://${network.host}:80/api/info`,
				];
			}

			for (const urlString of urlsToCheck) {
				try {
					const url = new URL(urlString);
					const module = url.protocol === "https:" ? https : http;

					const response = await new Promise<any>((resolve, reject) => {
						const req = module.get(
							urlString,
							{
								timeout: 5000,
								rejectUnauthorized: false, // Allow self-signed certs
							},
							(res: any) => {
								let data = "";
								res.on("data", (chunk: any) => (data += chunk));
								res.on("end", () => {
									try {
										resolve(JSON.parse(data));
									} catch (e) {
										reject(e);
									}
								});
							}
						);

						req.on("error", reject);
						req.on("timeout", () => {
							req.destroy();
							reject(new Error("Timeout"));
						});
					});

					// If we got a response with "Zubr" in the name, it's Zubr
					if (response && response.name && response.name.includes("Zubr")) {
						network.serverType = "zubr";
						log.info(
							`Detected ${network.name || network.host} as Zubr server (${response.version})`
						);

						// ZUBR-WEB: Fetch user's role
						await fetchUserRole(network, client);

						sendStatus(); // Update client with new server type
						return;
					}
				} catch (e) {
					// Try next URL
					continue;
				}
			}

			// If no Zubr API responded, it's IRC
			network.serverType = "irc";
			log.info(`Detected ${network.name || network.host} as IRC server (no Zubr API response)`);
			sendStatus(); // Update client with new server type
		} catch (error) {
			// On any error, assume IRC
			network.serverType = "irc";
			log.debug(
				`Server type detection failed for ${network.name || network.host}, assuming IRC:`,
				String(error)
			);
		}
	}

	function sendStatus() {
		const status = network.getNetworkStatus();
		const toSend = {
			...status,
			network: network.uuid,
		};

		client.emit("network:status", toSend);
	}
};
