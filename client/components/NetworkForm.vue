<template>
	<div id="connect" class="window" role="tabpanel" aria-label="Connect">
		<div class="header">
			<SidebarToggle />
		</div>
		<form class="container" method="post" action="" @submit.prevent="onSubmit">
			<h1 class="title">
				<template v-if="defaults.uuid">
					<input v-model="defaults.uuid" type="hidden" name="uuid" />
					Edit {{ defaults.name }}
				</template>
				<template v-else>
					Connect to a remote server
				</template>
			</h1>

			<!-- ZUBR-WEB: Simplified remote server connection -->
			<template v-if="!defaults.uuid">
				<p style="margin-bottom: 20px; color: #767676;">
					Enter the domain of the Zubr server you want to connect to. The connection will be secure and encrypted.
				</p>

				<div class="connect-row">
					<label for="connect:domain">Server Domain</label>
					<input
						id="connect:domain"
						v-model.trim="remoteDomain"
						class="input"
						placeholder="example.com"
						maxlength="255"
						required
						@input="onDomainChanged"
					/>
				</div>

				<div class="connect-row">
					<label for="connect:channels">Channels (optional)</label>
					<input
						id="connect:channels"
						v-model.trim="defaults.join"
						class="input"
						name="join"
						placeholder="#general, #random"
					/>
				</div>

				<!-- Hidden fields for remote server defaults -->
				<input type="hidden" name="host" :value="defaults.host || ''" />
				<input type="hidden" name="name" :value="defaults.name || ''" />
				<input type="hidden" name="port" :value="defaults.port || 6697" />
				<input type="hidden" name="tls" :value="defaults.tls ? 'true' : 'false'" />
				<input type="hidden" name="rejectUnauthorized" :value="defaults.rejectUnauthorized ? 'true' : 'false'" />
				<input type="hidden" name="nick" :value="defaults.nick || ''" />
				<input type="hidden" name="username" :value="defaults.username || ''" />
				<input type="hidden" name="realname" :value="defaults.realname || ''" />
				<input type="hidden" name="password" :value="defaults.password || ''" />
				<input type="hidden" name="sasl" :value="defaults.sasl || ''" />
				<input type="hidden" name="saslAccount" :value="defaults.saslAccount || ''" />
				<input type="hidden" name="saslPassword" :value="defaults.saslPassword || ''" />
				<input type="hidden" name="proxyEnabled" :value="defaults.proxyEnabled ? 'true' : 'false'" />
			</template>

			<!-- Editing existing network - show full form -->
			<template v-else>
				<h2>Network settings</h2>
				<div class="connect-row">
					<label for="connect:name">Name</label>
					<input
						id="connect:name"
						v-model.trim="defaults.name"
						class="input"
						name="name"
						maxlength="100"
					/>
				</div>
				<div class="connect-row">
					<label for="connect:host">Server</label>
					<div class="input-wrap">
						<input
							id="connect:host"
							v-model.trim="defaults.host"
							class="input"
							name="host"
							aria-label="Server address"
							maxlength="255"
							required
						/>
						<span id="connect:portseparator">:</span>
						<input
							id="connect:port"
							v-model="defaults.port"
							class="input"
							type="number"
							min="1"
							max="65535"
							name="port"
							aria-label="Server port"
						/>
					</div>
				</div>

				<h2>User preferences</h2>
				<div class="connect-row">
					<label for="connect:nick">Nick</label>
					<input
						id="connect:nick"
						v-model="defaults.nick"
						class="input nick"
						name="nick"
						pattern="[^\s:!@]+"
						maxlength="100"
						required
						@input="onNickChanged"
					/>
				</div>
				<template v-if="!config?.useHexIp">
					<div class="connect-row">
						<label for="connect:username">Username</label>
						<input
							id="connect:username"
							ref="usernameInput"
							v-model.trim="defaults.username"
							class="input username"
							name="username"
							maxlength="100"
						/>
					</div>
				</template>
				<div class="connect-row">
					<label for="connect:realname">Real name</label>
					<input
						id="connect:realname"
						v-model.trim="defaults.realname"
						class="input"
						name="realname"
						maxlength="300"
					/>
				</div>

				<template v-if="defaults.uuid && !store.state.serverConfiguration?.public">
					<div class="connect-row">
						<label for="connect:commands">
							Commands
							<span
								class="tooltipped tooltipped-ne tooltipped-no-delay"
								aria-label="One /command per line.
Each command will be executed in
the server tab on new connection"
							>
								<button class="extra-help" />
							</span>
						</label>
						<textarea
							id="connect:commands"
							ref="commandsInput"
							autocomplete="off"
							:value="defaults.commands ? defaults.commands.join('\n') : ''"
							class="input"
							name="commands"
							@input="resizeCommandsInput"
						/>
					</div>
				</template>
			</template>

			<div>
				<button type="submit" class="btn" :disabled="disabled ? true : false">
					<template v-if="defaults.uuid">Save network</template>
					<template v-else>Connect</template>
				</button>
			</div>
		</form>
	</div>
</template>

<style>
#connect .connect-auth {
	display: block;
	margin-bottom: 10px;
}

#connect .connect-auth .opt {
	display: block;
	width: 100%;
}

#connect .connect-auth input {
	margin: 3px 10px 0 0;
}

#connect .connect-sasl-external {
	padding: 10px;
	border-radius: 2px;
	background-color: #d9edf7;
	color: #31708f;
}

#connect .connect-sasl-external pre {
	margin: 0;
	user-select: text;
}
</style>

<script lang="ts">
import RevealPassword from "./RevealPassword.vue";
import SidebarToggle from "./SidebarToggle.vue";
import {defineComponent, nextTick, PropType, ref, watch} from "vue";
import {useStore} from "../js/store";
import {ClientNetwork} from "../js/types";

export type NetworkFormDefaults = Partial<ClientNetwork> & {
	join?: string;
};

export default defineComponent({
	name: "NetworkForm",
	components: {
		RevealPassword,
		SidebarToggle,
	},
	props: {
		handleSubmit: {
			type: Function as PropType<(network: ClientNetwork) => void>,
			required: true,
		},
		defaults: {
			type: Object as PropType<NetworkFormDefaults>,
			required: true,
		},
		disabled: Boolean,
	},
	setup(props) {
		const store = useStore();
		const config = ref(store.state.serverConfiguration);
		const previousUsername = ref(props.defaults?.username);
		const displayPasswordField = ref(false);

		// ZUBR-WEB: Remote domain handling
		const remoteDomain = ref("");

		// Get home network
		const getHomeNetwork = () => {
			return store.state.networks.find(
				(n) => n.host === "127.0.0.1" || n.host === "localhost"
			);
		};

		// Get current username from the home network
		const getCurrentUsername = () => {
			const homeNetwork = getHomeNetwork();
			return homeNetwork?.nick || "user";
		};

		// Get the home instance domain from the home network name
		const getHomeDomain = () => {
			const homeNetwork = getHomeNetwork();
			// Use the network name as the domain (set by IRC server)
			// Fallback to hostname if not available
			return homeNetwork?.name || window.location.hostname;
		};

		const onDomainChanged = () => {
			if (!remoteDomain.value) {
				return;
			}

			const domain = remoteDomain.value.trim();
			const currentUsername = getCurrentUsername();
			const homeDomain = getHomeDomain();

			console.log("ZUBR-WEB: Remote domain:", domain);
			console.log("ZUBR-WEB: Home domain:", homeDomain);
			console.log("ZUBR-WEB: Current username:", currentUsername);

			// Apply remote server defaults
			props.defaults.host = domain;
			props.defaults.name = domain;
			props.defaults.port = 6697; // Secure port
			props.defaults.tls = true;
			props.defaults.rejectUnauthorized = true;
			props.defaults.password = "";

			// ZUBR-WEB: Federation identity
			// Uses home instance domain to identify where the user is from
			// NICK: Periods replaced with hyphens (IRC restriction)
			// USER: Underscore separator, dots allowed
			// REAL: At symbol separator, all characters allowed
			const domainSafe = homeDomain.replace(/\./g, "-");
			const federatedNick = `${currentUsername}_${domainSafe}`;
			const federatedUser = `${currentUsername}_${homeDomain}`;
			const federatedReal = `${currentUsername}@${homeDomain}`;

			props.defaults.nick = federatedNick;
			props.defaults.username = federatedUser;
			props.defaults.realname = federatedReal;

			// SASL disabled
			props.defaults.sasl = "";
			props.defaults.saslAccount = "";
			props.defaults.saslPassword = "";

			// Proxy disabled
			props.defaults.proxyEnabled = false;
			props.defaults.proxyHost = "";
			props.defaults.proxyPort = 1080;
			props.defaults.proxyUsername = "";
			props.defaults.proxyPassword = "";

			// Other defaults
			props.defaults.commands = [];
			props.defaults.ignoreList = [];
			props.defaults.leaveMessage = "";

			console.log("ZUBR-WEB: Defaults set:", {
				host: props.defaults.host,
				name: props.defaults.name,
				port: props.defaults.port,
				nick: props.defaults.nick,
				tls: props.defaults.tls,
			});
		};

		const publicPassword = ref<HTMLInputElement | null>(null);

		watch(displayPasswordField, (newValue) => {
			if (newValue) {
				void nextTick(() => {
					publicPassword.value?.focus();
				});
			}
		});

		const commandsInput = ref<HTMLInputElement | null>(null);

		const resizeCommandsInput = () => {
			if (!commandsInput.value) {
				return;
			}

			// Reset height first so it can down size
			commandsInput.value.style.height = "";

			// 2 pixels to account for the border
			commandsInput.value.style.height = `${Math.ceil(
				commandsInput.value.scrollHeight + 2
			)}px`;
		};

		watch(
			// eslint-disable-next-line
			() => props.defaults?.commands,
			() => {
				void nextTick(() => {
					resizeCommandsInput();
				});
			}
		);

		watch(
			// eslint-disable-next-line
			() => props.defaults?.tls,
			(isSecureChecked) => {
				const ports = [6667, 6697];
				const newPort = isSecureChecked ? 0 : 1;

				// If you disable TLS and current port is 6697,
				// set it to 6667, and vice versa
				if (props.defaults?.port === ports[newPort]) {
					props.defaults.port = ports[1 - newPort];
				}
			}
		);

		const setSaslAuth = (type: string) => {
			if (props.defaults) {
				props.defaults.sasl = type;
			}
		};

		const usernameInput = ref<HTMLInputElement | null>(null);

		const onNickChanged = (event: Event) => {
			if (!usernameInput.value) {
				return;
			}

			const usernameRef = usernameInput.value;

			if (!usernameRef.value || usernameRef.value === previousUsername.value) {
				usernameRef.value = (event.target as HTMLInputElement)?.value;
			}

			previousUsername.value = (event.target as HTMLInputElement)?.value;
		};

		const onSubmit = (event: Event) => {
			const formData = new FormData(event.target as HTMLFormElement);
			const data: Partial<ClientNetwork> = {};

			formData.forEach((value, key) => {
				data[key] = value;
			});

			// ZUBR-WEB: Convert string values to proper types
			if (data.port) {
				data.port = parseInt(data.port as string, 10);
			}
			if (data.tls !== undefined) {
				data.tls = data.tls === "true";
			}
			if (data.rejectUnauthorized !== undefined) {
				data.rejectUnauthorized = data.rejectUnauthorized === "true";
			}
			if (data.proxyEnabled !== undefined) {
				data.proxyEnabled = data.proxyEnabled === "true";
			}
			if (data.proxyPort) {
				data.proxyPort = parseInt(data.proxyPort as string, 10);
			}

			console.log("ZUBR-WEB: Form submitted with data:", data);

			props.handleSubmit(data as ClientNetwork);
		};

		return {
			store,
			config,
			displayPasswordField,
			publicPassword,
			commandsInput,
			resizeCommandsInput,
			setSaslAuth,
			usernameInput,
			onNickChanged,
			onSubmit,
			remoteDomain, // ZUBR-WEB
			onDomainChanged, // ZUBR-WEB
		};
	},
});
</script>
