import * as utils from '@iobroker/adapter-core';
import { validateConfig, type MgSaicConfig } from './config';
import { SaicApiClient, type SaicVehicle, type SaicVehicleStatus } from './saic-client';
import { resolveSaicRegion } from './regions';

class MgSaic extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'mg-saic',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		const config = this.config as unknown as MgSaicConfig;
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
			const client = new SaicApiClient();
			const loginOptions = {
				...region,
				accountType: config.accountType as 'email' | 'phone',
				accountIdentifier: config.accountIdentifier ?? '',
				phoneCountryCode: config.phoneCountryCode,
				password: config.password ?? '',
			};
			const login = await client.login(loginOptions);
			const vehicles = await client.listVehicles(loginOptions, login.accessToken);
			for (const vehicle of vehicles) {
				await this.createVehicleObjects(vehicle);
			}
			await this.setState('info.connection', true, true);
			this.log.info(`SAIC account authenticated; discovered ${vehicles.length} vehicle(s).`);

			const statusErrors: string[] = [];
			for (const vehicle of vehicles) {
				try {
					const status = await client.getVehicleStatus(loginOptions, login.accessToken, vehicle.vin);
					await this.createVehicleStatusObjects(vehicle.vin, status);
				} catch {
					statusErrors.push(`Vehicle status request failed for ${vehicle.vin}`);
					this.log.warn(`Could not retrieve current status for vehicle ${vehicle.vin}.`);
				}
			}
			await this.setState('info.lastError', statusErrors.join('; '), true);
		} catch {
			const error = 'SAIC login failed; check the selected region, account credentials, or connectivity';
			await this.setState('info.connection', false, true);
			await this.setState('info.lastError', error, true);
			this.log.warn(error);
		}
	}

	private async createVehicleStatusObjects(vin: string, status: SaicVehicleStatus): Promise<void> {
		const statusId = `vehicles.${vin}.status`;
		await this.setObjectNotExistsAsync(statusId, {
			type: 'channel',
			common: { name: 'Current status' },
			native: {},
		});

		const values: Record<string, number> = { ...status.basicVehicleStatus };
		if (status.statusTime !== undefined) {
			values.statusTime = status.statusTime;
		}
		for (const [key, value] of Object.entries(values)) {
			await this.setObjectNotExistsAsync(`${statusId}.${key}`, {
				type: 'state',
				common: {
					name: key,
					type: 'number',
					role: 'value',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setStateAsync(`${statusId}.${key}`, { val: value, ack: true });
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
