import * as utils from '@iobroker/adapter-core';
import { DEFAULT_POLL_INTERVAL_SECONDS, validateConfig, type MgSaicConfig } from './config';
import {
	SaicApiClient,
	SaicHttpError,
	isVehicleStatusNotOlder,
	type SaicVehicle,
	type SaicVehicleStatus,
} from './saic-client';
import { resolveSaicRegion } from './regions';
import { isRefreshCommand } from './refresh-command';
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
	private refreshQueued = false;
	private stopping = false;
	private unloadCallbackCalled = false;
	private readonly abortController = new AbortController();
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
	private accessTokenExpiresAt = 0;
	private vehicles: SaicVehicle[] = [];
	private readonly lastStatusTimes = new Map<string, number>();

	private async onReady(): Promise<void> {
		if (this.stopping) {
			return;
		}
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
		if (this.stopping) {
			return;
		}
		await this.setStateAsync('commands.refresh', { val: false, ack: true });
		if (this.stopping) {
			return;
		}
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
			this.client = new SaicApiClient(undefined, Date.now, undefined, message => this.log.debug(message));
			this.loginOptions = {
				...region,
				accountType: config.accountType as 'email' | 'phone',
				accountIdentifier: config.accountIdentifier ?? '',
				phoneCountryCode: config.phoneCountryCode,
				password: config.password ?? '',
			};
			await this.authenticate();
			if (this.stopping) {
				return;
			}
			this.vehicles = await this.client.listVehicles(
				this.loginOptions,
				this.accessToken!,
				this.abortController.signal,
			);
		} catch (error) {
			if (this.stopping) {
				return;
			}
			const details = error instanceof Error ? error.message : 'Unknown initialization error';
			const message = `SAIC initialization failed: ${details}`;
			await this.setState('info.connection', false, true);
			await this.setState('info.lastError', message, true);
			this.log.warn(message);
			return;
		}

		try {
			for (const vehicle of this.vehicles) {
				if (this.stopping) {
					return;
				}
				await this.createVehicleObjects(vehicle);
			}
			await this.setState('info.connection', true, true);
			this.log.info(`SAIC account authenticated; discovered ${this.vehicles.length} vehicle(s).`);
			if (this.vehicles.length === 0) {
				await this.setState('info.lastError', 'No vehicles are linked to this SAIC account', true);
				this.log.warn('No vehicles are linked to this SAIC account.');
				return;
			}

			await this.refreshVehicleStatuses();
			const intervalSeconds = config.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
			if (!this.stopping) {
				this.pollTimer = this.setInterval(() => this.triggerRefresh(), intervalSeconds * 1000);
			}
		} catch (error) {
			if (this.stopping) {
				return;
			}
			const details = error instanceof Error ? error.message : 'Unknown local adapter error';
			await this.setState('info.lastError', `Could not initialize vehicle objects: ${details}`, true);
			this.log.error(`Could not initialize vehicle objects: ${details}`);
		}
	}

	private async authenticate(): Promise<void> {
		if (!this.client || !this.loginOptions || this.stopping) {
			throw new Error('Adapter is stopping or not initialized');
		}
		const login = await this.client.login(this.loginOptions, this.abortController.signal);
		if (this.stopping) {
			return;
		}
		this.accessToken = login.accessToken;
		this.accessTokenExpiresAt = Date.now() + login.expiresIn * 1000;
		await this.setState('info.connection', true, true);
	}

	private triggerRefresh(): void {
		void this.refreshVehicleStatuses().catch(error => {
			const details = error instanceof Error ? error.message : 'Unknown refresh error';
			this.log.error(`Vehicle status refresh failed: ${details}`);
		});
	}

	private async refreshVehicleStatuses(): Promise<void> {
		if (this.stopping || !this.client || !this.loginOptions || !this.accessToken) {
			return;
		}
		if (this.pollInProgress) {
			this.refreshQueued = true;
			return;
		}
		this.pollInProgress = true;
		const statusErrors: string[] = [];
		let followUpUsed = false;
		try {
			do {
				this.refreshQueued = false;
				for (const vehicle of this.vehicles) {
					if (this.stopping) {
						break;
					}
					if (Date.now() >= this.accessTokenExpiresAt - 60_000) {
						try {
							await this.authenticate();
						} catch (error) {
							if (this.stopping) {
								break;
							}
							const details = error instanceof Error ? error.message : 'Unknown authentication error';
							statusErrors.push(`SAIC re-authentication failed: ${details}`);
							await this.setState('info.connection', false, true);
							break;
						}
					}
					let status: SaicVehicleStatus;
					try {
						this.log.debug(`Refreshing live status for ${vehicle.vin}`);
						status = await this.client.getVehicleStatus(
							this.loginOptions,
							this.accessToken,
							vehicle.vin,
							this.abortController.signal,
						);
					} catch (error) {
						if (this.stopping) {
							break;
						}
						if (error instanceof SaicHttpError && (error.status === 401 || error.status === 403)) {
							try {
								await this.authenticate();
								status = await this.client.getVehicleStatus(
									this.loginOptions,
									this.accessToken,
									vehicle.vin,
									this.abortController.signal,
								);
							} catch (reauthError) {
								if (this.stopping) {
									break;
								}
								const details =
									reauthError instanceof Error ? reauthError.message : 'Unknown authentication error';
								statusErrors.push(`SAIC re-authentication failed for ${vehicle.vin}: ${details}`);
								await this.setState('info.connection', false, true);
								continue;
							}
						} else {
							const details = error instanceof Error ? error.message : 'Unknown error';
							statusErrors.push(`Vehicle status request failed for ${vehicle.vin}: ${details}`);
							this.log.warn(`Could not retrieve current status for vehicle ${vehicle.vin}: ${details}`);
							let cachedStatus: SaicVehicleStatus;
							try {
								this.log.debug(`Refreshing cached status as fallback for ${vehicle.vin}`);
								cachedStatus = await this.client.getCachedVehicleStatus(
									this.loginOptions,
									this.accessToken,
									vehicle.vin,
									this.abortController.signal,
								);
							} catch (cacheError) {
								if (this.stopping) {
									break;
								}
								const cacheDetails = cacheError instanceof Error ? cacheError.message : 'Unknown error';
								statusErrors.push(
									`Cached vehicle status request failed for ${vehicle.vin}: ${cacheDetails}`,
								);
								this.log.warn(
									`Could not retrieve cached status for vehicle ${vehicle.vin}: ${cacheDetails}`,
								);
								continue;
							}
							try {
								await this.createVehicleStatusObjects(
									vehicle.vin,
									cachedStatus,
									'cachedStatus',
									'SAIC cached status',
								);
							} catch (error) {
								const writeDetails =
									error instanceof Error ? error.message : 'Unknown state write error';
								statusErrors.push(`Could not write cached status for ${vehicle.vin}: ${writeDetails}`);
								this.log.error(`Could not write cached status for ${vehicle.vin}: ${writeDetails}`);
							}
							continue;
						}
					}
					if (this.stopping) {
						break;
					}
					if (!isVehicleStatusNotOlder(status.statusTime, this.lastStatusTimes.get(vehicle.vin))) {
						statusErrors.push(`Ignored older live status for ${vehicle.vin}`);
						continue;
					}
					try {
						this.log.debug(
							`Received live status for ${vehicle.vin}: ${Object.keys(status.basicVehicleStatus).length} basic fields, statusTime ${status.statusTime ?? 'missing'}`,
						);
						await this.createVehicleStatusObjects(vehicle.vin, status);
						if (!this.stopping && status.statusTime !== undefined) {
							this.lastStatusTimes.set(vehicle.vin, status.statusTime);
						}
						this.log.debug(`Created/updated live status objects for ${vehicle.vin}`);
					} catch (error) {
						const details = error instanceof Error ? error.message : 'Unknown state write error';
						statusErrors.push(`Could not write live status for ${vehicle.vin}: ${details}`);
						this.log.error(`Could not write live status for ${vehicle.vin}: ${details}`);
					}
				}
				if (this.refreshQueued && followUpUsed) {
					this.refreshQueued = false;
				} else if (this.refreshQueued) {
					followUpUsed = true;
				}
			} while (this.refreshQueued && !this.stopping);
			if (!this.stopping) {
				await this.setState('info.lastError', statusErrors.join('; '), true);
			}
		} finally {
			this.pollInProgress = false;
		}
	}

	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (!isRefreshCommand(id, this.namespace, state) || this.stopping) {
			return;
		}
		void this.setStateAsync('commands.refresh', { val: false, ack: true }).catch(error => {
			const details = error instanceof Error ? error.message : 'Unknown state error';
			this.log.error(`Could not acknowledge refresh command: ${details}`);
		});
		this.triggerRefresh();
	}

	private async createVehicleStatusObjects(
		vin: string,
		status: SaicVehicleStatus,
		channel = 'status',
		channelName = 'Current status',
	): Promise<void> {
		if (this.stopping) {
			return;
		}
		const statusId = `vehicles.${vin}.${channel}`;
		await this.setObjectNotExistsAsync(statusId, {
			type: 'channel',
			common: { name: channelName },
			native: {},
		});
		if (this.stopping) {
			return;
		}

		const values: Record<string, number> = { ...status.basicVehicleStatus };
		if (status.statusTime !== undefined) {
			values.statusTime = status.statusTime;
		}
		if (status.onlineStatus !== undefined) {
			values.onlineStatus = status.onlineStatus;
		}
		this.log.debug(`Writing ${Object.keys(values).length} values under ${statusId}`);
		for (const [key, value] of Object.entries(values)) {
			if (this.stopping) {
				return;
			}
			const group = getVehicleStatusGroup(key);
			const groupId = `${statusId}.${group}`;
			await this.setObjectNotExistsAsync(groupId, {
				type: 'channel',
				common: { name: group },
				native: {},
			});
			if (this.stopping) {
				return;
			}
			const metadata = getVehicleStatusMetadata(key);
			const stateId = `${groupId}.${key}`;
			const common = {
				name: metadata.name,
				type: metadata.type,
				role: metadata.role,
				read: true,
				write: false,
				...(metadata.unit ? { unit: metadata.unit } : {}),
			};
			await this.setObjectNotExistsAsync(stateId, {
				type: 'state',
				common,
				native: {},
			});
			if (this.stopping) {
				return;
			}
			await this.extendObjectAsync(stateId, {
				type: 'state',
				common,
				native: {},
			});
			if (this.stopping) {
				return;
			}
			await this.setStateAsync(stateId, { val: normalizeVehicleStatusValue(key, value), ack: true });
			if (this.stopping) {
				return;
			}
			await this.delObjectAsync(`${statusId}.${key}`);
		}
	}

	private async createVehicleObjects(vehicle: SaicVehicle): Promise<void> {
		if (this.stopping) {
			return;
		}
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
		if (this.stopping) {
			return;
		}
		for (const [key, value] of Object.entries(values)) {
			if (this.stopping) {
				return;
			}
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
			if (this.stopping) {
				return;
			}
			await this.setStateAsync(`${deviceId}.${key}`, { val: value, ack: true });
		}
	}

	private onUnload(callback: () => void): void {
		if (this.unloadCallbackCalled) {
			return;
		}
		this.unloadCallbackCalled = true;
		this.stopping = true;
		this.abortController.abort(new DOMException('Adapter is stopping', 'AbortError'));
		this.refreshQueued = false;
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
