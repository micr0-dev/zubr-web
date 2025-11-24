import socket from "../socket";
import storage from "../localStorage";
import {router, navigate} from "../router";
import {store} from "../store";
import location from "../location";
let lastServerHash: number | null = null;

declare global {
	interface Window {
		g_TheLoungeRemoveLoading?: () => void;
	}
}

socket.on("auth:success", function () {
	console.log("[AUTH] auth:success received");
	store.commit("currentUserVisibleError", "Loading messages…");
	updateLoadingMessage();
});

socket.on("auth:failed", async function () {
	const isPublicInstance = store.state.instanceInfo?.signup_mode === "public";
	const user = storage.get("user");
	const wasGuestUser = user && user.startsWith("web-user-");

	console.log("[AUTH] auth:failed received", {
		appLoaded: store.state.appLoaded,
		hasToken: !!storage.get("token"),
		isPublicInstance,
		user,
		wasGuestUser,
	});

	storage.remove("token");

	// Also clear the stored username if it's invalid
	if (user) {
		storage.remove("user");
	}

	if (store.state.appLoaded) {
		console.log("[AUTH] Auth failed after app loaded -> reloading");
		return reloadPage("Authentication failed, reloading…");
	}

	// If this is a public instance and the user was a guest, try guest auth again
	// But if it was a real user, show the sign-in page
	if (isPublicInstance && wasGuestUser) {
		console.log("[AUTH] Guest auth failed on public instance -> attempting new guest auth");

		store.commit("currentUserVisibleError", "Connecting as guest…");
		updateLoadingMessage();

		socket.emit("auth:perform", {
			isGuest: true,
		});
		return;
	}

	// For real users (not guests), always show sign-in on auth failure
	console.log("[AUTH] Auth failed before app loaded -> showing sign-in");
	await showSignIn();
});

socket.on("auth:start", async function (data) {
	console.log("[AUTH] auth:start event received", {
		serverHash: data.serverHash,
		selfRegister: data.selfRegister,
	});

	// If we reconnected and serverHash differs, that means the server restarted
	// And we will reload the page to grab the latest version
	if (lastServerHash && data.serverHash !== lastServerHash) {
		console.log("[AUTH] Server hash changed, reloading page");
		return reloadPage("Server restarted, reloading…");
	}

	lastServerHash = data.serverHash;

	// Store selfRegister for use on sign-in page before full config is loaded
	store.commit("selfRegister", data.selfRegister);

	const user = storage.get("user");
	const token = storage.get("token");

	console.log("[AUTH] Current state:", {
		user,
		hasToken: !!token,
		appLoaded: store.state.appLoaded,
		instanceInfo: store.state.instanceInfo,
		networks: store.state.networks.length,
		currentRoute: router.currentRoute.value.name,
	});

	// Check if this is a public instance (no authentication required)
	// If instanceInfo is not set yet (still loading), assume it might be public to avoid premature redirects
	const isPublicInstance =
		store.state.instanceInfo?.signup_mode === "public" || !store.state.instanceInfo;

	console.log("[AUTH] Instance check:", {
		isPublicInstance,
		signup_mode: store.state.instanceInfo?.signup_mode,
		hasInstanceInfo: !!store.state.instanceInfo,
	});

	const doFastAuth = user && token;

	// Check if we have a guest username (generated usernames start with "web-user-")
	// If we have a real username on a public instance, that's a legitimate signed-in user
	const isGuestUsername = user && user.startsWith("web-user-");

	// If we reconnect and no longer have a stored token, reload the page
	// (unless it's a public instance)
	if (store.state.appLoaded && !doFastAuth && !isPublicInstance) {
		console.log("[AUTH] App loaded, no auth, not public -> reloading");
		return reloadPage("Authentication failed, reloading…");
	}

	// If we don't have auth credentials and it looks like a public instance, try guest auth
	if (!doFastAuth && (store.state.instanceInfo?.signup_mode === "public" || !store.state.instanceInfo)) {
		console.log("[AUTH] No auth, public instance -> attempting guest auth");

		// Clear any stored guest username to avoid confusion with guest tokens
		// Only clear if it's a guest username, not a real user
		if (isGuestUsername) {
			storage.remove("user");
		}

		store.commit("currentUserVisibleError", "Connecting as guest…");
		updateLoadingMessage();

		socket.emit("auth:perform", {
			isGuest: true,
		});
		return;
	}

	// If we have user and token stored, perform auth without showing sign-in first
	if (doFastAuth) {
		// On public instances, if we have a non-guest username but we're reconnecting,
		// the user might have signed out and the guest took over. Check if we should use guest auth instead.
		if (
			store.state.instanceInfo?.signup_mode === "public" &&
			!isGuestUsername &&
			store.state.networks.length === 0 &&
			!store.state.appLoaded
		) {
			console.log(
				"[AUTH] Public instance with regular username but no networks - checking if token is valid"
			);
			// Try the fast auth, but if it fails, we'll fall back to guest auth
		}

		console.log("[AUTH] Has auth credentials -> performing fast auth");
		store.commit("currentUserVisibleError", "Authorizing…");
		updateLoadingMessage();

		let lastMessage = -1;

		for (const network of store.state.networks) {
			for (const chan of network.channels) {
				if (chan.messages.length > 0) {
					const id = chan.messages[chan.messages.length - 1].id;

					if (lastMessage < id) {
						lastMessage = id;
					}
				}
			}
		}

		const openChannel =
			(store.state.activeChannel && store.state.activeChannel.channel.id) || null;

		socket.emit("auth:perform", {
			user,
			token,
			lastMessage,
			openChannel,
			hasConfig: store.state.serverConfiguration !== null,
		});
	} else {
		console.log("[AUTH] No auth credentials and not public -> showing sign-in");
		await showSignIn();
	}
});

async function showSignIn() {
	console.log("[AUTH] showSignIn called", {
		currentRoute: router.currentRoute.value.name,
	});
	// TODO: this flashes grey background because it takes a little time for vue to mount signin
	if (window.g_TheLoungeRemoveLoading) {
		window.g_TheLoungeRemoveLoading();
	}

	if (router.currentRoute.value.name !== "SignIn") {
		console.log("[AUTH] Navigating to SignIn page");
		await navigate("SignIn");
	} else {
		console.log("[AUTH] Already on SignIn page");
	}
}

function reloadPage(message: string) {
	socket.disconnect();
	store.commit("currentUserVisibleError", message);
	location.reload();
}

function updateLoadingMessage() {
	const loading = document.getElementById("loading-page-message");

	if (loading) {
		loading.textContent = store.state.currentUserVisibleError;
	}
}
