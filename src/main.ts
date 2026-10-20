import * as utils from '@iobroker/adapter-core';
import { DEFAULT_POLL_INTERVAL_SECONDS, validateConfig, type MgSaicConfig } from './config';
import {
	SaicApiClient,
	SaicHttpError,
	SaicRemoteInstructionError,
	climateTemperatureToIndex,
	getClimateTemperatureRange,
	isVehicleStatusNotOlder,
	targetSocPercentToCode,
	type SaicVehicleSetting,
	type SaicVehicleCommand,
	type SaicVehicle,
	type SaicVehicleStatus,
} from './saic-client';
import { resolveSaicRegion } from './regions';
import { isRefreshCommand } from './refresh-command';
import { getVehicleStatusGroup, getVehicleStatusMetadata, normalizeVehicleStatusValue } from './status-metadata';
import { getRuntimeName } from './runtime-translations';

const vehicleCommands: Array<{ id: SaicVehicleCommand }> = [
	{ id: 'lock' },
	{ id: 'unlock' },
	{ id: 'openBoot' },
	{ id: 'climateStart' },
	{ id: 'climateStop' },
	{ id: 'frontDefrost' },
	{ id: 'rearWindowHeatStart' },
	{ id: 'rearWindowHeatStop' },
	{ id: 'batteryHeatStart' },
	{ id: 'batteryHeatStop' },
	{ id: 'chargingStart' },
	{ id: 'chargingStop' },
	{ id: 'chargingPortLock' },
	{ id: 'chargingPortUnlock' },
	{ id: 'findMyCar' },
];

const commandGroups: Partial<Record<SaicVehicleCommand, string>> = {
	lock: 'access',
	unlock: 'access',
	openBoot: 'access',
	climateStart: 'climate',
	climateStop: 'climate',
	frontDefrost: 'climate',
	rearWindowHeatStart: 'heating',
	rearWindowHeatStop: 'heating',
	batteryHeatStart: 'heating',
	batteryHeatStop: 'heating',
	chargingStart: 'charging',
	chargingStop: 'charging',
	chargingPortLock: 'charging',
	chargingPortUnlock: 'charging',
	findMyCar: 'vehicle',
};

const settingGroups: Record<string, string> = {
	driverSeatHeatLevel: 'heating',
	passengerSeatHeatLevel: 'heating',
	climateTemperature: 'climate',
	chargeTargetSoc: 'charging',
	chargingCurrentLimit: 'charging',
	chargingScheduleStart: 'schedules',
	chargingScheduleEnd: 'schedules',
	chargingScheduleMode: 'schedules',
	batteryHeatingScheduleEnabled: 'schedules',
	batteryHeatingScheduleStart: 'schedules',
};

const actionGroups: Record<SettingAction, string> = {
	climateTemperatureApply: 'climate',
	chargingSettingsApply: 'charging',
	chargingScheduleApply: 'schedules',
	batteryHeatingScheduleApply: 'schedules',
};

function vehicleCommandPath(vin: string, id: string): string {
	const group =
		id in commandGroups
			? commandGroups[id as SaicVehicleCommand]
			: id in settingGroups
				? settingGroups[id]
				: actionGroups[id as SettingAction];
	if (!group) {
		throw new Error(`Missing command group for ${id}`);
	}
	return `vehicles.${vin}.commands.${group}.${id}`;
}

const settingActions = [
	{ id: 'climateTemperatureApply' },
	{ id: 'chargingSettingsApply' },
	{ id: 'chargingScheduleApply' },
	{ id: 'batteryHeatingScheduleApply' },
] as const;

type SettingAction = (typeof settingActions)[number]['id'];

const EXPOSE_SOURCE_STATUS_DATAPOINTS = false;

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
	private readonly lastCanonicalStatusTimes = new Map<string, number>();
	private readonly vehicleCommandsInProgress = new Set<string>();

	private async onReady(): Promise<void> {
		if (this.stopping) {
			return;
		}
		const config = this.config as unknown as MgSaicConfig;
		await this.setObjectNotExistsAsync('commands.refresh', {
			type: 'state',
			common: {
				name: getRuntimeName('refresh'),
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
			},
			native: {},
		});
		await this.extendObjectAsync('commands.refresh', { common: { name: getRuntimeName('refresh') } });
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
				if (!EXPOSE_SOURCE_STATUS_DATAPOINTS) {
					await this.delObjectAsync(`vehicles.${vehicle.vin}.cachedStatus`, { recursive: true });
				}
				await this.delObjectAsync(`vehicles.${vehicle.vin}.canonicalStatus`, { recursive: true });
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
							const diagnostic =
								error instanceof SaicRemoteInstructionError
									? `SAIC/MG returned remote instruction code 4 for ${vehicle.vin}; this is a response from the MG/SAIC service or vehicle, not an adapter parsing/processing error. SAIC message: ${details}`
									: details;
							statusErrors.push(`Vehicle status request failed for ${vehicle.vin}: ${diagnostic}`);
							this.log.warn(
								`Could not retrieve current status for vehicle ${vehicle.vin}: ${diagnostic}`,
							);
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
								if (EXPOSE_SOURCE_STATUS_DATAPOINTS) {
									await this.createVehicleStatusObjects(
										vehicle.vin,
										cachedStatus,
										'cachedStatus',
										'cachedStatus',
									);
								}
								await this.createCanonicalVehicleStatusObjects(vehicle.vin, cachedStatus, 'cached');
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
						if (EXPOSE_SOURCE_STATUS_DATAPOINTS) {
							await this.createVehicleStatusObjects(vehicle.vin, status, 'liveStatus', 'liveStatus');
						}
						await this.createCanonicalVehicleStatusObjects(vehicle.vin, status, 'live');
						if (!this.stopping && status.statusTime !== undefined) {
							this.lastStatusTimes.set(vehicle.vin, status.statusTime);
							if (
								isVehicleStatusNotOlder(
									status.statusTime,
									this.lastCanonicalStatusTimes.get(vehicle.vin),
								)
							) {
								this.lastCanonicalStatusTimes.set(vehicle.vin, status.statusTime);
							}
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
		if (this.stopping) {
			return;
		}
		if (isRefreshCommand(id, this.namespace, state)) {
			void this.setStateAsync('commands.refresh', { val: false, ack: true }).catch(error => {
				const details = error instanceof Error ? error.message : 'Unknown state error';
				this.log.error(`Could not acknowledge refresh command: ${details}`);
			});
			this.triggerRefresh();
			return;
		}
		if (!state || state.ack) {
			return;
		}
		const settingAction = settingActions.find(({ id: actionId }) =>
			this.vehicles.some(({ vin }) => id === `${this.namespace}.${vehicleCommandPath(vin, actionId)}`),
		);
		const settingVehicle = this.vehicles.find(
			({ vin }) => settingAction && id === `${this.namespace}.${vehicleCommandPath(vin, settingAction.id)}`,
		);
		if (settingAction && settingVehicle) {
			void this.executeVehicleSetting(settingVehicle.vin, settingAction.id);
			return;
		}
		const settingInput = this.vehicles
			.flatMap(({ vin }) =>
				Object.keys(settingGroups)
					.filter(stateId => stateId !== 'driverSeatHeatLevel' && stateId !== 'passengerSeatHeatLevel')
					.map(stateId => ({ vin, stateId })),
			)
			.find(({ vin, stateId }) => id === `${this.namespace}.${vehicleCommandPath(vin, stateId)}`);
		if (settingInput) {
			void this.setStateAsync(vehicleCommandPath(settingInput.vin, settingInput.stateId), {
				val: state.val,
				ack: true,
			});
			return;
		}
		const seatHeating = this.vehicles
			.flatMap(({ vin }) =>
				(['driverSeatHeatLevel', 'passengerSeatHeatLevel'] as const).map(stateId => ({ vin, stateId })),
			)
			.find(({ vin, stateId }) => id === `${this.namespace}.${vehicleCommandPath(vin, stateId)}`);
		if (seatHeating) {
			const seat = seatHeating.stateId === 'driverSeatHeatLevel' ? 'driver' : 'passenger';
			void this.executeSeatHeating(seatHeating.vin, seat, state.val);
			return;
		}
		if (state.val !== true) {
			return;
		}
		const commandEntry = vehicleCommands.find(({ id: commandId }) =>
			this.vehicles.some(({ vin }) => id === `${this.namespace}.${vehicleCommandPath(vin, commandId)}`),
		);
		const vehicle = this.vehicles.find(
			({ vin }) => commandEntry && id === `${this.namespace}.${vehicleCommandPath(vin, commandEntry.id)}`,
		);
		if (!commandEntry || !vehicle) {
			return;
		}
		void this.executeVehicleCommand(vehicle.vin, commandEntry.id);
	}

	private async executeSeatHeating(
		vin: string,
		seat: 'driver' | 'passenger',
		value: ioBroker.StateValue,
	): Promise<void> {
		const stateId = vehicleCommandPath(vin, `${seat}SeatHeatLevel`);
		if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 3) {
			await this.setStateAsync(stateId, { ack: true });
			this.log.warn(`Ignored ${seat} seat heating level for ${vin}: expected an integer from 0 to 3`);
			return;
		}
		if (this.vehicleCommandsInProgress.has(vin)) {
			await this.setStateAsync(stateId, { ack: true });
			this.log.warn(`Ignored ${seat} seat heating for ${vin}: another vehicle command is still running`);
			return;
		}
		this.vehicleCommandsInProgress.add(vin);
		try {
			if (!this.client || !this.loginOptions) {
				throw new Error('SAIC client is not initialized');
			}
			if (!this.accessToken || this.accessTokenExpiresAt <= Date.now() + 30_000) {
				await this.authenticate();
			}
			await this.client.sendVehicleSeatHeating(
				this.loginOptions,
				this.accessToken!,
				vin,
				seat,
				value,
				this.abortController.signal,
			);
			await this.setStateAsync(stateId, { val: value, ack: true });
			this.log.info(`SAIC ${seat} seat heating level ${value} completed for ${vin}`);
		} catch (error) {
			if (!this.stopping) {
				await this.setStateAsync(stateId, { val: value, ack: true });
				const details = error instanceof Error ? error.message : 'Unknown command error';
				this.log.warn(`SAIC ${seat} seat heating failed for ${vin}: ${details}`);
			}
		} finally {
			this.vehicleCommandsInProgress.delete(vin);
		}
	}

	private async executeVehicleSetting(vin: string, action: SettingAction): Promise<void> {
		const stateId = vehicleCommandPath(vin, action);
		if (this.vehicleCommandsInProgress.has(vin)) {
			await this.setStateAsync(stateId, { val: false, ack: true });
			this.log.warn(`Ignored ${action} for ${vin}: another vehicle command is still running`);
			return;
		}
		this.vehicleCommandsInProgress.add(vin);
		try {
			await this.setStateAsync(stateId, { val: false, ack: true });
			if (!this.client || !this.loginOptions) {
				throw new Error('SAIC client is not initialized');
			}
			const setting = await this.readVehicleSetting(vin, action);
			if (!this.accessToken || this.accessTokenExpiresAt <= Date.now() + 30_000) {
				await this.authenticate();
			}
			await this.client.sendVehicleSetting(
				this.loginOptions,
				this.accessToken!,
				vin,
				setting,
				this.abortController.signal,
			);
			this.log.info(`SAIC ${action} completed for ${vin}`);
		} catch (error) {
			if (!this.stopping) {
				const details = error instanceof Error ? error.message : 'Unknown settings error';
				this.log.warn(`SAIC ${action} failed for ${vin}: ${details}`);
			}
		} finally {
			this.vehicleCommandsInProgress.delete(vin);
		}
	}

	private async readVehicleSetting(vin: string, action: SettingAction): Promise<SaicVehicleSetting> {
		const readNumber = async (id: string): Promise<number> => {
			const state = await this.getStateAsync(vehicleCommandPath(vin, id));
			if (!state || typeof state.val !== 'number' || !Number.isFinite(state.val)) {
				throw new Error(`Setting ${id} must contain a finite number`);
			}
			return state.val;
		};
		const readString = async (id: string): Promise<string> => {
			const state = await this.getStateAsync(vehicleCommandPath(vin, id));
			if (!state || typeof state.val !== 'string') {
				throw new Error(`Setting ${id} must contain a time in HH:MM format`);
			}
			return state.val;
		};
		if (action === 'climateTemperatureApply') {
			const vehicle = this.vehicles.find(item => item.vin === vin);
			return {
				type: 'climateTemperature',
				value: climateTemperatureToIndex(await readNumber('climateTemperature'), vehicle?.series),
			};
		}
		if (action === 'chargingSettingsApply') {
			return {
				type: 'chargingSettings',
				targetSoc: targetSocPercentToCode(await readNumber('chargeTargetSoc')),
				currentLimit: await readNumber('chargingCurrentLimit'),
			};
		}
		if (action === 'chargingScheduleApply') {
			return {
				type: 'chargingSchedule',
				start: await readString('chargingScheduleStart'),
				end: await readString('chargingScheduleEnd'),
				mode: await readNumber('chargingScheduleMode'),
			};
		}
		const enabled = await this.getStateAsync(vehicleCommandPath(vin, 'batteryHeatingScheduleEnabled'));
		if (!enabled || typeof enabled.val !== 'boolean') {
			throw new Error('Battery heating schedule enabled must be boolean');
		}
		return {
			type: 'batteryHeatingSchedule',
			enabled: enabled.val,
			start: await readString('batteryHeatingScheduleStart'),
		};
	}

	private async executeVehicleCommand(vin: string, command: SaicVehicleCommand): Promise<void> {
		const stateId = vehicleCommandPath(vin, command);
		if (this.vehicleCommandsInProgress.has(vin)) {
			await this.setStateAsync(stateId, { val: false, ack: true });
			this.log.warn(`Ignored ${command} command for ${vin}: another vehicle command is still running`);
			return;
		}
		this.vehicleCommandsInProgress.add(vin);
		try {
			await this.setStateAsync(stateId, { val: false, ack: true });
			if (!this.client || !this.loginOptions) {
				throw new Error('SAIC client is not initialized');
			}
			if (!this.accessToken || this.accessTokenExpiresAt <= Date.now() + 30_000) {
				await this.authenticate();
			}
			await this.client.sendVehicleCommand(
				this.loginOptions,
				this.accessToken!,
				vin,
				command,
				this.abortController.signal,
			);
			this.log.info(`SAIC ${command} command completed for ${vin}`);
		} catch (error) {
			if (!this.stopping) {
				const details = error instanceof Error ? error.message : 'Unknown command error';
				this.log.warn(`SAIC ${command} command failed for ${vin}: ${details}`);
			}
		} finally {
			this.vehicleCommandsInProgress.delete(vin);
		}
	}

	private async createVehicleStatusObjects(
		vin: string,
		status: SaicVehicleStatus,
		channel = 'status',
		channelName = 'currentStatus',
	): Promise<void> {
		if (this.stopping) {
			return;
		}
		if (!EXPOSE_SOURCE_STATUS_DATAPOINTS && (channel === 'liveStatus' || channel === 'cachedStatus')) {
			return;
		}
		const statusId = `vehicles.${vin}.${channel}`;
		await this.setObjectNotExistsAsync(statusId, {
			type: 'channel',
			common: { name: getRuntimeName(channelName) },
			native: {},
		});
		await this.extendObjectAsync(statusId, { common: { name: getRuntimeName(channelName) } });
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
				common: { name: getRuntimeName(`commandGroup_${group}`) },
				native: {},
			});
			await this.extendObjectAsync(groupId, { common: { name: getRuntimeName(`commandGroup_${group}`) } });
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

	private async createCanonicalVehicleStatusObjects(
		vin: string,
		status: SaicVehicleStatus,
		source: 'live' | 'cached',
	): Promise<void> {
		if (this.stopping || !isVehicleStatusNotOlder(status.statusTime, this.lastCanonicalStatusTimes.get(vin))) {
			return;
		}
		await this.createVehicleStatusObjects(vin, status);
		if (this.stopping) {
			return;
		}
		const sourceId = `vehicles.${vin}.status.source`;
		await this.setObjectNotExistsAsync(sourceId, {
			type: 'state',
			common: { name: getRuntimeName('statusSource'), type: 'string', role: 'text', read: true, write: false },
			native: {},
		});
		await this.extendObjectAsync(sourceId, { common: { name: getRuntimeName('statusSource') } });
		if (this.stopping) {
			return;
		}
		await this.setStateAsync(sourceId, { val: source, ack: true });
		if (status.statusTime !== undefined) {
			this.lastCanonicalStatusTimes.set(vin, status.statusTime);
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
		const commandsId = `${deviceId}.commands`;
		await this.setObjectNotExistsAsync(commandsId, {
			type: 'channel',
			common: { name: getRuntimeName('commands') },
			native: {},
		});
		await this.extendObjectAsync(commandsId, { common: { name: getRuntimeName('commands') } });
		for (const group of ['access', 'climate', 'heating', 'charging', 'schedules', 'vehicle']) {
			const groupId = `${commandsId}.${group}`;
			const groupName = getRuntimeName(`commandGroup_${group}`);
			await this.setObjectNotExistsAsync(groupId, {
				type: 'channel',
				common: { name: groupName },
				native: {},
			});
			await this.extendObjectAsync(groupId, { common: { name: groupName } });
		}
		for (const command of vehicleCommands) {
			const commandId = vehicleCommandPath(vehicle.vin, command.id);
			await this.setObjectNotExistsAsync(commandId, {
				type: 'state',
				common: {
					name: getRuntimeName(command.id),
					type: 'boolean',
					role: 'button',
					read: false,
					write: true,
				},
				native: {},
			});
			await this.extendObjectAsync(commandId, {
				common: { name: getRuntimeName(command.id) },
			});
			await this.setStateAsync(commandId, { val: false, ack: true });
		}
		const settingStates: Array<{
			id: string;
			type: 'number' | 'string' | 'boolean';
			role: string;
			def: number | string | boolean;
			min?: number;
			max?: number;
			step?: number;
			unit?: string;
			states?: Record<string, string>;
		}> = [
			{
				id: 'driverSeatHeatLevel',
				type: 'number',
				role: 'level',
				def: 0,
				min: 0,
				max: 3,
				states: { 0: 'Off', 1: 'Low', 2: 'Medium', 3: 'High' },
			},
			{
				id: 'passengerSeatHeatLevel',
				type: 'number',
				role: 'level',
				def: 0,
				min: 0,
				max: 3,
				states: { 0: 'Off', 1: 'Low', 2: 'Medium', 3: 'High' },
			},
			{
				id: 'climateTemperature',
				type: 'number',
				role: 'level.temperature',
				def: 22,
				min: getClimateTemperatureRange(vehicle.series).min,
				max: getClimateTemperatureRange(vehicle.series).max,
				unit: '°C',
			},
			{
				id: 'chargeTargetSoc',
				type: 'number',
				role: 'level',
				def: 80,
				min: 40,
				max: 100,
				step: 10,
				unit: '%',
				states: { 40: '40%', 50: '50%', 60: '60%', 70: '70%', 80: '80%', 90: '90%', 100: '100%' },
			},
			{
				id: 'chargingCurrentLimit',
				type: 'number',
				role: 'level',
				def: 4,
				min: 1,
				max: 4,
				states: { 1: '6 A', 2: '8 A', 3: '16 A', 4: 'Maximum' },
			},
			{
				id: 'chargingScheduleStart',
				type: 'string',
				role: 'value.time',
				def: '00:00',
			},
			{
				id: 'chargingScheduleEnd',
				type: 'string',
				role: 'value.time',
				def: '06:00',
			},
			{
				id: 'chargingScheduleMode',
				type: 'number',
				role: 'level',
				def: 2,
				min: 1,
				max: 3,
				states: { 1: 'Until configured time', 2: 'Disabled', 3: 'Until configured SOC' },
			},
			{
				id: 'batteryHeatingScheduleEnabled',
				type: 'boolean',
				role: 'switch',
				def: false,
			},
			{
				id: 'batteryHeatingScheduleStart',
				type: 'string',
				role: 'value.time',
				def: '00:00',
			},
		];
		for (const setting of settingStates) {
			const stateId = vehicleCommandPath(vehicle.vin, setting.id);
			const legacyStateId = `${commandsId}.${setting.id}`;
			const stateObject = await this.getObjectAsync(stateId);
			const legacyState = await this.getStateAsync(legacyStateId);
			await this.setObjectNotExistsAsync(stateId, {
				type: 'state',
				common: {
					name: getRuntimeName(setting.id),
					type: setting.type,
					role: setting.role,
					read: true,
					write: true,
					def: setting.def,
					...(setting.min === undefined ? {} : { min: setting.min }),
					...(setting.max === undefined ? {} : { max: setting.max }),
					...(setting.step === undefined ? {} : { step: setting.step }),
					...(setting.unit === undefined ? {} : { unit: setting.unit }),
					...(setting.states ? { states: setting.states } : {}),
				},
				native: {},
			});
			const currentState = await this.getStateAsync(stateId);
			if (!currentState || currentState.val === null) {
				await this.setStateAsync(stateId, { val: legacyState?.val ?? setting.def, ack: true });
			} else if (typeof currentState.val === 'number' && stateObject?.common.unit !== setting.unit) {
				if (setting.id === 'climateTemperature') {
					await this.setStateAsync(stateId, { val: currentState.val + 14, ack: true });
				} else if (setting.id === 'chargeTargetSoc' && currentState.val >= 1 && currentState.val <= 7) {
					await this.setStateAsync(stateId, { val: (currentState.val + 3) * 10, ack: true });
				}
			}
			await this.extendObjectAsync(stateId, {
				common: {
					name: getRuntimeName(setting.id),
					type: setting.type,
					role: setting.role,
					read: true,
					write: true,
					def: setting.def,
					...(setting.min === undefined ? {} : { min: setting.min }),
					...(setting.max === undefined ? {} : { max: setting.max }),
					...(setting.step === undefined ? {} : { step: setting.step }),
					...(setting.unit === undefined ? {} : { unit: setting.unit }),
					...(setting.states ? { states: setting.states } : {}),
				},
			});
			await this.delObjectAsync(legacyStateId);
		}
		for (const action of settingActions) {
			const actionId = vehicleCommandPath(vehicle.vin, action.id);
			await this.setObjectNotExistsAsync(actionId, {
				type: 'state',
				common: { name: getRuntimeName(action.id), type: 'boolean', role: 'button', read: false, write: true },
				native: {},
			});
			await this.extendObjectAsync(actionId, {
				common: { name: getRuntimeName(action.id) },
			});
			await this.setStateAsync(actionId, { val: false, ack: true });
			await this.delObjectAsync(`${commandsId}.${action.id}`);
		}
		for (const command of vehicleCommands) {
			await this.delObjectAsync(`${commandsId}.${command.id}`);
		}
		this.subscribeStates(`${commandsId}.*`);
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
			const name = getRuntimeName(key);
			await this.setObjectNotExistsAsync(`${deviceId}.${key}`, {
				type: 'state',
				common: {
					name,
					type: isBoolean ? 'boolean' : 'string',
					role: isBoolean ? 'indicator' : key === 'vin' ? 'text' : 'info.name',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.extendObjectAsync(`${deviceId}.${key}`, { common: { name } });
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
