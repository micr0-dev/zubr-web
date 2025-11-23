<template>
	<div id="instance-settings" class="window" role="tabpanel" aria-label="Instance Settings">
		<div class="header">
			<SidebarToggle />
		</div>

		<div class="container">
			<h1 class="title">Instance Settings</h1>

			<form v-if="!loading" autocomplete="off" @submit.prevent="onSubmit">
				<div class="settings-group">
					<label for="signup-mode">Signup Mode</label>
					<select
						id="signup-mode"
						v-model="signupMode"
						class="input"
						name="signup_mode"
					>
						<option value="public">Public - Anyone can sign up</option>
						<option value="approval">Approval - Requires admin approval</option>
						<option value="invite">Invite Only - Requires invite code</option>
					</select>
				</div>

				<div class="settings-group">
					<label for="motd">Message of the Day</label>
					<textarea
						id="motd"
						v-model="motd"
						class="input motd-textarea"
						name="motd"
						rows="10"
						placeholder="Enter a message that will be shown to users when they connect..."
					/>
				</div>

				<div v-if="successMessage" class="success-message">
					{{ successMessage }}
				</div>

				<div v-if="errorMessage" class="error-message">
					{{ errorMessage }}
				</div>

				<button :disabled="saving" type="submit" class="btn">
					{{ saving ? "Saving..." : "Save Settings" }}
				</button>
			</form>

			<div v-else class="loading">
				<p>Loading settings...</p>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import {defineComponent, onMounted, ref} from "vue";
import {useRoute} from "vue-router";
import SidebarToggle from "../SidebarToggle.vue";

export default defineComponent({
	name: "InstanceSettings",
	components: {
		SidebarToggle,
	},
	setup() {
		const route = useRoute();
		const loading = ref(true);
		const saving = ref(false);
		const successMessage = ref("");
		const errorMessage = ref("");

		const signupMode = ref("public");
		const motd = ref("");

		const networkUuid = route.params.uuid as string;

		const loadSettings = async () => {
			loading.value = true;
			errorMessage.value = "";

			try {
				const response = await fetch(`/api/zubr-instance/${networkUuid}/settings`);

				if (!response.ok) {
					const data = await response.json();
					errorMessage.value = data.error || "Failed to load settings";
					return;
				}

				const data = await response.json();
				signupMode.value = data.signup_mode || "public";
				motd.value = data.motd || "";
			} catch (error) {
				errorMessage.value = "Failed to connect to server";
				console.error("Error loading instance settings:", error);
			} finally {
				loading.value = false;
			}
		};

		const onSubmit = async () => {
			saving.value = true;
			successMessage.value = "";
			errorMessage.value = "";

			try {
				const response = await fetch(`/api/zubr-instance/${networkUuid}/settings`, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						signup_mode: signupMode.value,
						motd: motd.value,
					}),
				});

				if (!response.ok) {
					const data = await response.json();
					errorMessage.value = data.error || "Failed to save settings";
					return;
				}

				successMessage.value = "Settings saved successfully!";

				// Clear success message after 3 seconds
				setTimeout(() => {
					successMessage.value = "";
				}, 3000);
			} catch (error) {
				errorMessage.value = "Failed to connect to server";
				console.error("Error saving instance settings:", error);
			} finally {
				saving.value = false;
			}
		};

		onMounted(() => {
			void loadSettings();
		});

		return {
			loading,
			saving,
			successMessage,
			errorMessage,
			signupMode,
			motd,
			onSubmit,
		};
	},
});
</script>

<style scoped>
#instance-settings .container {
	padding: 20px;
	max-width: 800px;
	margin: 0 auto;
}

#instance-settings .title {
	font-size: 24px;
	margin-bottom: 30px;
	color: var(--body-color);
}

.settings-group {
	margin-bottom: 25px;
}

.settings-group label {
	display: block;
	margin-bottom: 8px;
	font-weight: 600;
	color: var(--body-color);
}

.input {
	width: 100%;
	padding: 10px;
	border: 1px solid var(--body-color-muted);
	border-radius: 4px;
	background: var(--body-bg);
	color: var(--body-color);
	font-size: 14px;
}

.input:focus {
	outline: none;
	border-color: var(--link-color);
}

.motd-textarea {
	font-family: "Roboto Mono", "Consolas", "Monaco", monospace;
	resize: vertical;
	min-height: 150px;
}

.success-message {
	padding: 12px;
	margin-bottom: 20px;
	background: #d4edda;
	color: #155724;
	border: 1px solid #c3e6cb;
	border-radius: 4px;
}

.error-message {
	padding: 12px;
	margin-bottom: 20px;
	background: #f8d7da;
	color: #721c24;
	border: 1px solid #f5c6cb;
	border-radius: 4px;
}

.btn {
	padding: 10px 20px;
	background: var(--link-color);
	color: white;
	border: none;
	border-radius: 4px;
	font-size: 14px;
	cursor: pointer;
}

.btn:hover:not(:disabled) {
	opacity: 0.9;
}

.btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.loading {
	padding: 40px;
	text-align: center;
	color: var(--body-color-muted);
}
</style>
