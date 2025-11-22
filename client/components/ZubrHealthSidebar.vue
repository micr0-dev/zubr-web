<template>
	<aside id="zubr-health-sidebar">
		<div class="health-header">
			<h3>Server Health</h3>
			<button
				v-if="healthData"
				class="refresh-button"
				:disabled="isLoading"
				@click="refreshHealth"
			>
				<span :class="['refresh-icon', {spinning: isLoading}]">↻</span>
			</button>
		</div>

		<div v-if="error" class="health-error">
			<p>{{ error }}</p>
		</div>

		<div v-else-if="!healthData" class="health-loading">
			<p>Loading health data...</p>
		</div>

		<div v-else class="health-content">
			<div :class="['health-status', healthData.status]">
				<span class="status-indicator"></span>
				<span class="status-text">{{ getStatusText(healthData.status) }}</span>
			</div>

			<div class="health-timestamp">
				Last updated: {{ formatTimestamp(healthData.timestamp) }}
			</div>

			<div class="health-components">
				<h4>Components</h4>
				<div
					v-for="(component, key) in healthData.components"
					:key="key"
					:class="['component-item', component.status]"
				>
					<div class="component-header">
						<span class="component-status-dot"></span>
						<span class="component-name">{{ formatComponentName(key) }}</span>
						<span v-if="component.latency" class="component-latency">
							{{ formatLatency(component.latency) }}
						</span>
					</div>
					<div class="component-message">{{ component.message }}</div>
				</div>
			</div>
		</div>
	</aside>
</template>

<script lang="ts">
import {defineComponent, ref, onMounted, onUnmounted, PropType} from "vue";
import {ClientNetwork} from "../js/types";

type HealthComponent = {
	status: string;
	message: string;
	latency?: string;
};

type HealthData = {
	status: string;
	timestamp: string;
	components: {
		[key: string]: HealthComponent;
	};
};

export default defineComponent({
	name: "ZubrHealthSidebar",
	props: {
		network: {
			type: Object as PropType<ClientNetwork>,
			required: true,
		},
	},
	setup(props) {
		const healthData = ref<HealthData | null>(null);
		const error = ref<string | null>(null);
		const isLoading = ref(false);
		const currentTime = ref(new Date());
		let refreshInterval: number | null = null;
		let timeUpdateInterval: number | null = null;

		const fetchHealth = async () => {
			try {
				isLoading.value = true;
				error.value = null;

				// Fetch health from the network's API
				const response = await fetch(`/api/zubr-health/${props.network.uuid}`);

				if (!response.ok) {
					throw new Error(`Failed to fetch health: ${response.statusText}`);
				}

				const data = await response.json();
				healthData.value = data;
			} catch (e) {
				error.value = e instanceof Error ? e.message : "Failed to fetch health data";
			} finally {
				isLoading.value = false;
			}
		};

		const refreshHealth = () => {
			fetchHealth();
		};

		const getStatusText = (status: string): string => {
			const statusMap: {[key: string]: string} = {
				healthy: "Healthy",
				degraded: "Degraded",
				unhealthy: "Unhealthy",
			};
			return statusMap[status] || status.toUpperCase();
		};

		const formatComponentName = (key: string): string => {
			const nameMap: {[key: string]: string} = {
				api: "API Server",
				storage: "Storage",
				irc_database: "IRC Database",
				inspircd: "InspIRCd",
			};
			return nameMap[key] || key;
		};

		const formatTimestamp = (timestamp: string): string => {
			try {
				const date = new Date(timestamp);
				const now = currentTime.value;
				const diff = now.getTime() - date.getTime();
				const seconds = Math.floor(diff / 1000);

				if (seconds < 60) {
					return `${seconds}s ago`;
				} else if (seconds < 3600) {
					return `${Math.floor(seconds / 60)}m ago`;
				} else {
					return date.toLocaleTimeString();
				}
			} catch {
				return timestamp;
			}
		};

		const formatLatency = (latency: string): string => {
			// Extract number and unit from latency string (e.g., "13.144908ms" -> 13.144908, "ms")
			const match = latency.match(/^([\d.]+)(.*)$/);
			if (!match) return latency;

			const value = parseFloat(match[1]);
			const unit = match[2];

			// Format to 3 significant figures
			const formatted = value.toPrecision(3);
			return `${formatted}${unit}`;
		};

		onMounted(() => {
			fetchHealth();
			// Refresh health data every 30 seconds
			refreshInterval = window.setInterval(fetchHealth, 30000);
			// Update timestamp display every second
			timeUpdateInterval = window.setInterval(() => {
				currentTime.value = new Date();
			}, 1000);
		});

		onUnmounted(() => {
			if (refreshInterval) {
				clearInterval(refreshInterval);
			}
			if (timeUpdateInterval) {
				clearInterval(timeUpdateInterval);
			}
		});

		return {
			healthData,
			error,
			isLoading,
			refreshHealth,
			getStatusText,
			formatComponentName,
			formatTimestamp,
			formatLatency,
		};
	},
});
</script>

<style scoped>
#zubr-health-sidebar {
	width: 200px;
	border-left: 1px solid #e7e7e7;
	background: #f9f9f9;
	display: flex;
	flex-direction: column;
	overflow-y: auto;
	padding: 10px;
	font-size: 13px;
}

.health-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 15px;
	padding-bottom: 10px;
	border-bottom: 1px solid #e0e0e0;
}

.health-header h3 {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	color: #333;
}

.refresh-button {
	background: none;
	border: none;
	cursor: pointer;
	padding: 4px;
	color: #666;
	font-size: 18px;
	transition: color 0.2s;
}

.refresh-button:hover:not(:disabled) {
	color: #4a90e2;
}

.refresh-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.refresh-icon.spinning {
	display: inline-block;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.health-error,
.health-loading {
	padding: 10px;
	text-align: center;
	color: #666;
}

.health-status {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px;
	border-radius: 4px;
	margin-bottom: 10px;
	font-weight: 600;
}

.health-status.healthy {
	background: #d4edda;
	color: #155724;
}

.health-status.degraded {
	background: #fff3cd;
	color: #856404;
}

.health-status.unhealthy {
	background: #f8d7da;
	color: #721c24;
}

.status-indicator {
	width: 10px;
	height: 10px;
	border-radius: 50%;
}

.health-status.healthy .status-indicator {
	background: #28a745;
}

.health-status.degraded .status-indicator {
	background: #ffc107;
}

.health-status.unhealthy .status-indicator {
	background: #dc3545;
}

.health-timestamp {
	font-size: 11px;
	color: #999;
	margin-bottom: 15px;
	text-align: left;
}

.health-components h4 {
	margin: 0 0 10px 0;
	font-size: 13px;
	font-weight: 600;
	color: #333;
}

.component-item {
	margin-bottom: 12px;
	padding: 8px;
	border-radius: 4px;
	background: #fff;
	border: 1px solid #e0e0e0;
}

.component-header {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 4px;
}

.component-status-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.component-item.up .component-status-dot {
	background: #28a745;
}

.component-item.down .component-status-dot,
.component-item.error .component-status-dot {
	background: #dc3545;
}

.component-item.warning .component-status-dot {
	background: #ffc107;
}

.component-name {
	font-weight: 600;
	color: #333;
	flex: 1;
}

.component-latency {
	font-size: 11px;
	color: #666;
	background: #f0f0f0;
	padding: 2px 6px;
	border-radius: 3px;
}

.component-message {
	font-size: 11px;
	color: #666;
	line-height: 1.3;
	margin-left: 14px;
}
</style>
