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

const vehicleCommands: Array<{ id: SaicVehicleCommand; name: string }> = [
	{ id: 'lock', name: 'Lock doors' },
	{ id: 'unlock', name: 'Unlock doors' },
	{ id: 'openBoot', name: 'Open boot' },
	{ id: 'climateStart', name: 'Start climate control' },
	{ id: 'climateStop', name: 'Stop climate control' },
	{ id: 'frontDefrost', name: 'Start front defrost' },
	{ id: 'rearWindowHeatStart', name: 'Start rear window heating' },
	{ id: 'rearWindowHeatStop', name: 'Stop rear window heating' },
	{ id: 'driverSeatHeatOff', name: 'Driver seat heating off' },
	{ id: 'driverSeatHeatLow', name: 'Driver seat heating low' },
	{ id: 'driverSeatHeatMedium', name: 'Driver seat heating medium' },
	{ id: 'driverSeatHeatHigh', name: 'Driver seat heating high' },
	{ id: 'passengerSeatHeatOff', name: 'Passenger seat heating off' },
	{ id: 'passengerSeatHeatLow', name: 'Passenger seat heating low' },
	{ id: 'passengerSeatHeatMedium', name: 'Passenger seat heating medium' },
	{ id: 'passengerSeatHeatHigh', name: 'Passenger seat heating high' },
	{ id: 'batteryHeatStart', name: 'Start battery heating' },
	{ id: 'batteryHeatStop', name: 'Stop battery heating' },
	{ id: 'chargingStart', name: 'Start charging' },
	{ id: 'chargingStop', name: 'Stop charging' },
	{ id: 'chargingPortLock', name: 'Lock charging port' },
	{ id: 'chargingPortUnlock', name: 'Unlock charging port' },
	{ id: 'findMyCar', name: 'Trigger vehicle alarm' },
];

const settingActions = [
	{ id: 'climateTemperatureApply', name: 'Apply climate temperature' },
	{ id: 'chargingSettingsApply', name: 'Apply charging settings' },
	{ id: 'chargingScheduleApply', name: 'Apply charging schedule' },
	{ id: 'batteryHeatingScheduleApply', name: 'Apply battery heating schedule' },
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
										'SAIC cached status',
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
							await this.createVehicleStatusObjects(vehicle.vin, status, 'liveStatus', 'Live status');
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
		const settingAction = settingActions.find(({ id: actionId }) => id.endsWith(`.commands.${actionId}`));
		const settingVehicle = this.vehicles.find(
			({ vin }) => id === `${this.namespace}.vehicles.${vin}.commands.${settingAction?.id}`,
		);
		if (settingAction && settingVehicle) {
			void this.executeVehicleSetting(settingVehicle.vin, settingAction.id);
			return;
		}
		const settingInputVehicle = this.vehicles.find(({ vin }) =>
			id.startsWith(`${this.namespace}.vehicles.${vin}.commands.`),
		);
		const settingInputId = settingInputVehicle
			? id.slice(`${this.namespace}.vehicles.${settingInputVehicle.vin}.commands.`.length)
			: '';
		if (
			settingInputVehicle &&
			[
				'climateTemperature',
				'chargeTargetSoc',
				'chargingCurrentLimit',
				'chargingScheduleStart',
				'chargingScheduleEnd',
				'chargingScheduleMode',
				'batteryHeatingScheduleEnabled',
				'batteryHeatingScheduleStart',
			].includes(settingInputId)
		) {
			void this.setStateAsync(`vehicles.${settingInputVehicle.vin}.commands.${settingInputId}`, {
				val: state.val,
				ack: true,
			});
			return;
		}
		if (state.val !== true) {
			return;
		}
		const commandEntry = vehicleCommands.find(({ id: commandId }) => id.endsWith(`.commands.${commandId}`));
		const vehicle = this.vehicles.find(
			({ vin }) => id === `${this.namespace}.vehicles.${vin}.commands.${commandEntry?.id}`,
		);
		if (!commandEntry || !vehicle) {
			return;
		}
		void this.executeVehicleCommand(vehicle.vin, commandEntry.id);
	}

	private async executeVehicleSetting(vin: string, action: SettingAction): Promise<void> {
		const stateId = `vehicles.${vin}.commands.${action}`;
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
			const state = await this.getStateAsync(`vehicles.${vin}.commands.${id}`);
			if (!state || typeof state.val !== 'number' || !Number.isFinite(state.val)) {
				throw new Error(`Setting ${id} must contain a finite number`);
			}
			return state.val;
		};
		const readString = async (id: string): Promise<string> => {
			const state = await this.getStateAsync(`vehicles.${vin}.commands.${id}`);
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
		const enabled = await this.getStateAsync(`vehicles.${vin}.commands.batteryHeatingScheduleEnabled`);
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
		const stateId = `vehicles.${vin}.commands.${command}`;
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
		channelName = 'Current status',
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

	private async createCanonicalVehicleStatusObjects(
		vin: string,
		status: SaicVehicleStatus,
		source: 'live' | 'cached',
	): Promise<void> {
		if (this.stopping || !isVehicleStatusNotOlder(status.statusTime, this.lastCanonicalStatusTimes.get(vin))) {
			return;
		}
		await this.createVehicleStatusObjects(vin, status, 'status', 'Current status');
		if (this.stopping) {
			return;
		}
		const sourceId = `vehicles.${vin}.status.source`;
		await this.setObjectNotExistsAsync(sourceId, {
			type: 'state',
			common: { name: 'Status source', type: 'string', role: 'text', read: true, write: false },
			native: {},
		});
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
			common: { name: 'Remote commands' },
			native: {},
		});
		for (const command of vehicleCommands) {
			await this.setObjectNotExistsAsync(`${commandsId}.${command.id}`, {
				type: 'state',
				common: {
					name: command.name,
					type: 'boolean',
					role: 'button',
					read: false,
					write: true,
				},
				native: {},
			});
			await this.setStateAsync(`${commandsId}.${command.id}`, { val: false, ack: true });
		}
		const settingStates: Array<{
			id: string;
			name: string;
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
				id: 'climateTemperature',
				name: 'Climate target temperature',
				type: 'number',
				role: 'level.temperature',
				def: 22,
				min: getClimateTemperatureRange(vehicle.series).min,
				max: getClimateTemperatureRange(vehicle.series).max,
				unit: '°C',
			},
			{
				id: 'chargeTargetSoc',
				name: 'Charging target state of charge',
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
				name: 'Charging current limit',
				type: 'number',
				role: 'level',
				def: 4,
				min: 1,
				max: 4,
				states: { 1: '6 A', 2: '8 A', 3: '16 A', 4: 'Maximum' },
			},
			{
				id: 'chargingScheduleStart',
				name: 'Charging schedule start (HH:MM)',
				type: 'string',
				role: 'value.time',
				def: '00:00',
			},
			{
				id: 'chargingScheduleEnd',
				name: 'Charging schedule end (HH:MM)',
				type: 'string',
				role: 'value.time',
				def: '06:00',
			},
			{
				id: 'chargingScheduleMode',
				name: 'Charging schedule mode',
				type: 'number',
				role: 'level',
				def: 2,
				min: 1,
				max: 3,
				states: { 1: 'Until configured time', 2: 'Disabled', 3: 'Until configured SOC' },
			},
			{
				id: 'batteryHeatingScheduleEnabled',
				name: 'Battery heating schedule enabled',
				type: 'boolean',
				role: 'switch',
				def: false,
			},
			{
				id: 'batteryHeatingScheduleStart',
				name: 'Battery heating schedule start (HH:MM)',
				type: 'string',
				role: 'value.time',
				def: '00:00',
			},
		];
		for (const setting of settingStates) {
			const stateId = `${commandsId}.${setting.id}`;
			const stateObject = await this.getObjectAsync(stateId);
			await this.setObjectNotExistsAsync(stateId, {
				type: 'state',
				common: {
					name: setting.name,
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
				await this.setStateAsync(stateId, { val: setting.def, ack: true });
			} else if (typeof currentState.val === 'number' && stateObject?.common.unit !== setting.unit) {
				if (setting.id === 'climateTemperature') {
					await this.setStateAsync(stateId, { val: currentState.val + 14, ack: true });
				} else if (setting.id === 'chargeTargetSoc' && currentState.val >= 1 && currentState.val <= 7) {
					await this.setStateAsync(stateId, { val: (currentState.val + 3) * 10, ack: true });
				}
			}
			await this.extendObjectAsync(stateId, {
				common: {
					name: setting.name,
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
		}
		for (const action of settingActions) {
			await this.setObjectNotExistsAsync(`${commandsId}.${action.id}`, {
				type: 'state',
				common: { name: action.name, type: 'boolean', role: 'button', read: false, write: true },
				native: {},
			});
			await this.setStateAsync(`${commandsId}.${action.id}`, { val: false, ack: true });
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
