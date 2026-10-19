import * as utils from '@iobroker/adapter-core';
import { DEFAULT_POLL_INTERVAL_SECONDS, validateConfig, type MgSaicConfig } from './config';
import { SaicApiClient, type SaicVehicle, type SaicVehicleStatus } from './saic-client';
import { resolveSaicRegion } from './regions';
import { getVehicleStatusGroup, getVehicleStatusMetadata, normalizeVehicleStatusValue } from './status-metadata';

class MgSaic extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'mg-saic',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	private pollTimer?: ioBroker.Interval;
	private pollInProgress = false;
	private stopping = false;
	private client?: SaicApiClient;
	private loginOptions?: {
		baseUrl: string;
		regionCode: string;
		tenantId: string;
		accountType: 'email' | 'phone';
		accountIdentifier: string;
		phoneCountryCode?: string;
		password: string;
	};
	private accessToken?: string;
	private vehicles: SaicVehicle[] = [];

	private async onReady(): Promise<void> {
		const config = this.config as unknown as MgSaicConfig;
		await this.setObjectNotExistsAsync('commands.refresh', {
			type: 'state',
			common: {
				name: 'Refresh vehicle status',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
			},
			native: {},
		});
		await this.setStateAsync('commands.refresh', { val: false, ack: true });
		this.subscribeStates('commands.refresh');
		await this.setState('info.connection', false, true);
		await this.setState('info.backend', config.region?.trim() || 'not configured', true);
		const errors = validateConfig(config);
		await this.setState('info.lastError', errors.join('; '), true);
		if (errors.length) {
			this.log.warn(`Configuration is incomplete: ${errors.join('; ')}`);
			return;
		}

		const region = resolveSaicRegion(config.region ?? '');
		if (!region) {
			return;
		}

		try {
			this.client = new SaicApiClient();
			this.loginOptions = {
				...region,
				accountType: config.accountType as 'email' | 'phone',
				accountIdentifier: config.accountIdentifier ?? '',
				phoneCountryCode: config.phoneCountryCode,
				password: config.password ?? '',
			};
			const login = await this.client.login(this.loginOptions);
			this.accessToken = login.accessToken;
			this.vehicles = await this.client.listVehicles(this.loginOptions, login.accessToken);
			for (const vehicle of this.vehicles) {
				await this.createVehicleObjects(vehicle);
			}
			await this.setState('info.connection', true, true);
			this.log.info(`SAIC account authenticated; discovered ${this.vehicles.length} vehicle(s).`);

			await this.refreshVehicleStatuses();
			const intervalSeconds = config.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
			this.pollTimer = this.setInterval(() => void this.refreshVehicleStatuses(), intervalSeconds * 1000);
		} catch {
			const error = 'SAIC login failed; check the selected region, account credentials, or connectivity';
			await this.setState('info.connection', false, true);
			await this.setState('info.lastError', error, true);
			this.log.warn(error);
		}
	}

	private async refreshVehicleStatuses(): Promise<void> {
		if (this.stopping || this.pollInProgress || !this.client || !this.loginOptions || !this.accessToken) {
			return;
		}
		this.pollInProgress = true;
		const statusErrors: string[] = [];
		try {
			for (const vehicle of this.vehicles) {
				if (this.stopping) {
					break;
				}
				try {
					const status = await this.client.getVehicleStatus(this.loginOptions, this.accessToken, vehicle.vin);
					await this.createVehicleStatusObjects(vehicle.vin, status);
				} catch (error) {
					const details = error instanceof Error ? error.message : 'Unknown error';
					statusErrors.push(`Vehicle status request failed for ${vehicle.vin}: ${details}`);
					this.log.warn(`Could not retrieve current status for vehicle ${vehicle.vin}: ${details}`);
				}
				try {
					const status = await this.client.getCachedVehicleStatus(
						this.loginOptions,
						this.accessToken,
						vehicle.vin,
					);
					await this.createVehicleStatusObjects(vehicle.vin, status, 'cachedStatus', 'SAIC cached status');
				} catch (error) {
					const details = error instanceof Error ? error.message : 'Unknown error';
					statusErrors.push(`Cached vehicle status request failed for ${vehicle.vin}: ${details}`);
					this.log.warn(`Could not retrieve cached status for vehicle ${vehicle.vin}: ${details}`);
				}
			}
			if (!this.stopping) {
				await this.setState('info.lastError', statusErrors.join('; '), true);
			}
		} finally {
			this.pollInProgress = false;
		}
	}

	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (id !== 'commands.refresh' || !state || state.ack || state.val !== true || this.stopping) {
			return;
		}
		void this.setStateAsync('commands.refresh', { val: false, ack: true });
		void this.refreshVehicleStatuses();
	}

	private async createVehicleStatusObjects(
		vin: string,
		status: SaicVehicleStatus,
		channel = 'status',
		channelName = 'Current status',
	): Promise<void> {
		const statusId = `vehicles.${vin}.${channel}`;
		await this.setObjectNotExistsAsync(statusId, {
			type: 'channel',
			common: { name: channelName },
			native: {},
		});

		const values: Record<string, number> = { ...status.basicVehicleStatus };
		if (status.statusTime !== undefined) {
			values.statusTime = status.statusTime;
		}
		if (status.onlineStatus !== undefined) {
			values.onlineStatus = status.onlineStatus;
		}
		for (const [key, value] of Object.entries(values)) {
			const group = getVehicleStatusGroup(key);
			const groupId = `${statusId}.${group}`;
			await this.setObjectNotExistsAsync(groupId, {
				type: 'channel',
				common: { name: group },
				native: {},
			});
			const metadata = getVehicleStatusMetadata(key);
			const stateId = `${groupId}.${key}`;
			await this.extendObjectAsync(stateId, {
				common: {
					name: metadata.name,
					type: metadata.type,
					role: metadata.role,
					...(metadata.unit ? { unit: metadata.unit } : {}),
				},
			});
			await this.setStateAsync(stateId, { val: normalizeVehicleStatusValue(key, value), ack: true });
			await this.delObjectAsync(`${statusId}.${key}`);
		}
	}

	private async createVehicleObjects(vehicle: SaicVehicle): Promise<void> {
		const deviceId = `vehicles.${vehicle.vin}`;
		const values: Record<string, string | boolean | undefined> = {
			vin: vehicle.vin,
			name: vehicle.name,
			brandName: vehicle.brandName,
			modelName: vehicle.modelName,
			series: vehicle.series,
			modelYear: vehicle.modelYear,
			colorName: vehicle.colorName,
			isCurrentVehicle: vehicle.isCurrentVehicle,
			isSubaccount: vehicle.isSubaccount,
		};

		await this.setObjectNotExistsAsync(deviceId, {
			type: 'device',
			common: { name: vehicle.name || vehicle.modelName || vehicle.vin },
			native: {},
		});
		for (const [key, value] of Object.entries(values)) {
			if (value === undefined) {
				continue;
			}
			const isBoolean = typeof value === 'boolean';
			await this.setObjectNotExistsAsync(`${deviceId}.${key}`, {
				type: 'state',
				common: {
					name: key,
					type: isBoolean ? 'boolean' : 'string',
					role: isBoolean ? 'indicator' : key === 'vin' ? 'text' : 'info.name',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setStateAsync(`${deviceId}.${key}`, { val: value, ack: true });
		}
	}

	private onUnload(callback: () => void): void {
		this.stopping = true;
		if (this.pollTimer) {
			this.clearInterval(this.pollTimer);
		}
		callback();
	}
}
if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MgSaic(options);
} else {
	// otherwise start the instance directly
	(() => new MgSaic())();
}
