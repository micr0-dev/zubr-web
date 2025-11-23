<template>
	<aside
		ref="userlist"
		class="userlist"
		:aria-label="'User list for ' + channel.name"
		@mouseleave="removeHoverUser"
	>
		<div v-if="isZubrServer && !zubrUsersLoaded" class="count">
			<input
				ref="input"
				:value="'Loading users...'"
				type="search"
				class="search"
				aria-label="Loading users"
				tabindex="-1"
				disabled
			/>
		</div>
		<div v-else class="count">
			<input
				ref="input"
				:value="userSearchInput"
				:placeholder="
					displayUsers.length + ' user' + (displayUsers.length === 1 ? '' : 's')
				"
				type="search"
				class="search"
				aria-label="Search among the user list"
				tabindex="-1"
				@input="setUserSearchInput"
				@keydown.up="navigateUserList($event, -1)"
				@keydown.down="navigateUserList($event, 1)"
				@keydown.page-up="navigateUserList($event, -10)"
				@keydown.page-down="navigateUserList($event, 10)"
				@keydown.enter="selectUser"
			/>
		</div>
		<div class="names">
			<div
				v-for="(users, mode) in groupedUsers"
				:key="mode"
				:class="['user-mode', getModeClass(String(mode))]"
			>
				<template v-if="userSearchInput.length > 0">
					<!-- eslint-disable vue/no-v-text-v-html-on-component -->
					<Username
						v-for="user in users"
						:key="user.original.nick + '-search'"
						:on-hover="hoverUser"
						:active="user.original === activeUser"
						:user="user.original"
						v-html="user.string"
					/>
					<!-- eslint-enable -->
				</template>
				<template v-else>
					<Username
						v-for="user in users"
						:key="user.nick"
						:on-hover="hoverUser"
						:active="user === activeUser"
						:user="user"
					/>
				</template>
			</div>
		</div>
	</aside>
</template>

<script lang="ts">
import {filter as fuzzyFilter} from "fuzzy";
import {computed, defineComponent, nextTick, onMounted, onUnmounted, PropType, ref, watch} from "vue";
import type {UserInMessage} from "../../shared/types/msg";
import type {ClientChan, ClientNetwork, ClientUser} from "../js/types";
import Username from "./Username.vue";

const modes = {
	"~": "owner",
	"&": "admin",
	"!": "admin",
	"@": "op",
	"%": "half-op",
	"+": "voice",
	"": "normal",
};

// ZUBR-WEB: Role to mode mapping for Zubr users
const zubrRoleToMode = {
	owner: "~",
	admin: "&",
	user: "",
};

export default defineComponent({
	name: "ChatUserList",
	components: {
		Username,
	},
	props: {
		channel: {type: Object as PropType<ClientChan>, required: true},
		network: {type: Object as PropType<ClientNetwork>, required: true},
	},
	setup(props) {
		const userSearchInput = ref("");
		const activeUser = ref<UserInMessage | null>();
		const userlist = ref<HTMLDivElement>();
		const zubrUsers = ref<ClientUser[]>([]);
		const zubrUsersLoaded = ref(false);
		const refreshInterval = ref<number | null>(null);

		// ZUBR-WEB: Check if this is a Zubr server
		const isZubrServer = computed(() => {
			return props.network?.status?.serverType === "zubr";
		});

		// ZUBR-WEB: Use Zubr users or IRC users depending on server type
		const displayUsers = computed(() => {
			if (isZubrServer.value && zubrUsersLoaded.value) {
				return zubrUsers.value;
			}
			return props.channel.users;
		});

		const filteredUsers = computed(() => {
			if (!userSearchInput.value) {
				return;
			}

			return fuzzyFilter(userSearchInput.value, displayUsers.value, {
				pre: "<b>",
				post: "</b>",
				extract: (u) => u.nick,
			});
		});

		// ZUBR-WEB: Fetch users from Zubr server
		const fetchZubrUsers = async () => {
			if (!isZubrServer.value) {
				return;
			}

			try {
				const response = await fetch(`/api/zubr-users/${props.network.uuid}`);

				if (!response.ok) {
					console.error("Failed to fetch Zubr users:", response.statusText);
					return;
				}

				const data = await response.json();

				// Transform Zubr users to match IRC user format
				const transformedUsers = data.users.map((user: any) => ({
					nick: user.username,
					modes: [zubrRoleToMode[user.role as keyof typeof zubrRoleToMode] || ""],
					lastMessage: 0,
					// ZUBR-WEB: Add role for display purposes
					zubrRole: user.role,
				}));

				zubrUsers.value = transformedUsers;

				// ZUBR-WEB: Update channel.users with Zubr users so context menu can access them
				props.channel.users = transformedUsers;

				zubrUsersLoaded.value = true;
			} catch (error) {
				console.error("Error fetching Zubr users:", error);
			}
		};

		// ZUBR-WEB: Listen for manual refresh events
		const handleRefreshUsers = () => {
			if (isZubrServer.value) {
				void fetchZubrUsers();
			}
		};

		// ZUBR-WEB: Fetch users on mount and refresh every 30 seconds
		onMounted(() => {
			if (isZubrServer.value) {
				void fetchZubrUsers();
				refreshInterval.value = window.setInterval(() => {
					void fetchZubrUsers();
				}, 30000);
			}

			// Listen for manual refresh requests
			window.addEventListener("zubr:refresh-users", handleRefreshUsers);
		});

		// ZUBR-WEB: Watch for server type changes
		watch(
			() => props.network?.status?.serverType,
			() => {
				if (isZubrServer.value) {
					void fetchZubrUsers();
					if (!refreshInterval.value) {
						refreshInterval.value = window.setInterval(() => {
							void fetchZubrUsers();
						}, 30000);
					}
				} else {
					if (refreshInterval.value) {
						clearInterval(refreshInterval.value);
						refreshInterval.value = null;
					}
					zubrUsersLoaded.value = false;
					zubrUsers.value = [];
				}
			}
		);

		// ZUBR-WEB: Clean up interval and event listener on unmount
		onUnmounted(() => {
			if (refreshInterval.value) {
				clearInterval(refreshInterval.value);
			}
			window.removeEventListener("zubr:refresh-users", handleRefreshUsers);
		});

		const groupedUsers = computed(() => {
			const groups = {};

			if (userSearchInput.value && filteredUsers.value) {
				const result = filteredUsers.value;

				for (const user of result) {
					const mode: string = user.original.modes[0] || "";

					if (!groups[mode]) {
						groups[mode] = [];
					}

					// Prepend user mode to search result
					user.string = mode + user.string;

					groups[mode].push(user);
				}
			} else {
				// ZUBR-WEB: Use displayUsers instead of props.channel.users
				for (const user of displayUsers.value) {
					const mode = user.modes[0] || "";

					if (!groups[mode]) {
						groups[mode] = [user];
					} else {
						groups[mode].push(user);
					}
				}
			}

			// ZUBR-WEB: Sort groups by mode hierarchy for proper display order
			// Order should be: ~ (owner), & (admin), @ (op), % (half-op), + (voice), "" (normal)
			const modeOrder = ["~", "&", "@", "%", "+", ""];
			const sortedGroups = {};

			for (const mode of modeOrder) {
				if (groups[mode]) {
					// Sort users alphabetically within each group
					sortedGroups[mode] = groups[mode].sort((a, b) => {
						const nickA = (a.nick || (a as any).original?.nick || "").toLowerCase();
						const nickB = (b.nick || (b as any).original?.nick || "").toLowerCase();
						return nickA.localeCompare(nickB);
					});
				}
			}

			// Add any remaining modes not in the standard order
			for (const mode in groups) {
				if (!sortedGroups[mode]) {
					sortedGroups[mode] = groups[mode].sort((a, b) => {
						const nickA = (a.nick || (a as any).original?.nick || "").toLowerCase();
						const nickB = (b.nick || (b as any).original?.nick || "").toLowerCase();
						return nickA.localeCompare(nickB);
					});
				}
			}

			return sortedGroups as {
				[mode: string]: (ClientUser & {
					original: UserInMessage;
					string: string;
				})[];
			};
		});

		const setUserSearchInput = (e: Event) => {
			userSearchInput.value = (e.target as HTMLInputElement).value;
		};

		const getModeClass = (mode: string) => {
			return modes[mode] as typeof modes;
		};

		const selectUser = () => {
			// Simulate a click on the active user to open the context menu.
			// Coordinates are provided to position the menu correctly.
			if (!activeUser.value || !userlist.value) {
				return;
			}

			const el = userlist.value.querySelector(".active");

			if (!el) {
				return;
			}

			const rect = el.getBoundingClientRect();
			const ev = new MouseEvent("click", {
				view: window,
				bubbles: true,
				cancelable: true,
				clientX: rect.left,
				clientY: rect.top + rect.height,
			});
			el.dispatchEvent(ev);
		};

		const hoverUser = (user: UserInMessage) => {
			activeUser.value = user;
		};

		const removeHoverUser = () => {
			activeUser.value = null;
		};

		const scrollToActiveUser = () => {
			// Scroll the list if needed after the active class is applied
			void nextTick(() => {
				const el = userlist.value?.querySelector(".active");
				el?.scrollIntoView({block: "nearest", inline: "nearest"});
			});
		};

		const navigateUserList = (event: Event, direction: number) => {
			// Prevent propagation to stop global keybind handler from capturing pagedown/pageup
			// and redirecting it to the message list container for scrolling
			event.stopImmediatePropagation();
			event.preventDefault();

			// ZUBR-WEB: Use displayUsers instead of props.channel.users
			let users = displayUsers.value;

			// Only using filteredUsers when we have to avoids filtering when it's not needed
			if (userSearchInput.value && filteredUsers.value) {
				users = filteredUsers.value.map((result) => result.original);
			}

			// Bail out if there's no users to select
			if (!users.length) {
				activeUser.value = null;
				return;
			}

			const abort = () => {
				activeUser.value = direction ? users[0] : users[users.length - 1];
				scrollToActiveUser();
			};

			// If there's no active user select the first or last one depending on direction
			if (!activeUser.value) {
				abort();
				return;
			}

			let currentIndex = users.indexOf(activeUser.value as ClientUser);

			if (currentIndex === -1) {
				abort();
				return;
			}

			currentIndex += direction;

			// Wrap around the list if necessary. Normaly each loop iterates once at most,
			// but might iterate more often if pgup or pgdown are used in a very short user list
			while (currentIndex < 0) {
				currentIndex += users.length;
			}

			while (currentIndex > users.length - 1) {
				currentIndex -= users.length;
			}

			activeUser.value = users[currentIndex];
			scrollToActiveUser();
		};

		return {
			filteredUsers,
			groupedUsers,
			userSearchInput,
			activeUser,
			userlist,
			// ZUBR-WEB: Add new computed properties
			isZubrServer,
			zubrUsersLoaded,
			displayUsers,

			setUserSearchInput,
			getModeClass,
			selectUser,
			hoverUser,
			removeHoverUser,
			navigateUserList,
		};
	},
});
</script>
