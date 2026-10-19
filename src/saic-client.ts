import { createHash } from 'node:crypto';
import {
	createSaicRequestSignature,
	decryptSaicResponseBody,
	encryptSaicRequestBody,
	sha1PasswordDigest,
} from './saic-crypto';

/** Options required to sign in to the global SAIC API. */
export interface SaicLoginOptions {
	/** Regional API base URL. */
	baseUrl: string;
	/** Region code sent in the request header. */
	regionCode: string;
	/** Tenant identifier used in request signing. */
	tenantId: string;
	/** Whether the account identifier is an email or phone number. */
	accountType: 'email' | 'phone';
	/** Email address or phone number. */
	accountIdentifier: string;
	/** International calling code required for phone accounts. */
	phoneCountryCode?: string;
	/** Account password. */
	password: string;
}

/** Token values returned by the SAIC OAuth endpoint. */
export interface SaicLoginResult {
	/** Bearer token for subsequent API requests. */
	accessToken: string;
	/** Token validity in seconds. */
	expiresIn: number;
}

/** Basic vehicle information returned by the SAIC vehicle list endpoint. */
export interface SaicVehicle {
	/** Vehicle identification number used as the object ID. */
	vin: string;
	/** User-assigned vehicle name. */
	name?: string;
	/** Vehicle brand returned by the account API. */
	brandName?: string;
	/** Vehicle model name. */
	modelName?: string;
	/** Model series. */
	series?: string;
	/** Model year. */
	modelYear?: string;
	/** Vehicle color name. */
	colorName?: string;
	/** Whether this is the account's currently selected vehicle. */
	isCurrentVehicle?: boolean;
	/** Whether this vehicle is shared from another account. */
	isSubaccount?: boolean;
}

/** Vehicle status values returned by the SAIC vehicle status endpoint. */
export interface SaicVehicleStatus {
	/** Raw status timestamp returned by the service. */
	statusTime?: number;
	/** Online flag returned by SAIC's cached status endpoint. */
	onlineStatus?: number;
	/** Allowlisted numeric basic vehicle status values. */
	basicVehicleStatus: Record<string, number>;
}

/** HTTP transport type used for injectable API requests. */
type FetchFunction = typeof fetch;

interface SaicApiEnvelope {
	code?: number | string;
	message?: string;
	data?: {
		access_token?: string;
		expires_in?: number;
		vinList?: unknown;
		basicVehicleStatus?: unknown;
		gpsPosition?: unknown;
		statusTime?: unknown;
		onlineStatus?: unknown;
	};
}

class RetryableVehicleStatusError extends Error {}

/** Numeric basic-status fields accepted from the SAIC response. */
const vehicleStatusFields = [
	'batteryVoltage',
	'bonnetStatus',
	'bootStatus',
	'canBusActive',
	'currentJourneyDistance',
	'dippedBeamStatus',
	'driverDoor',
	'driverWindow',
	'engineStatus',
	'exteriorTemperature',
	'frontLeftTyrePressure',
	'frontRightTyrePressure',
	'fuelLevelPrc',
	'fuelRange',
	'fuelRangeElec',
	'handBrake',
	'interiorTemperature',
	'lockStatus',
	'mileage',
	'passengerDoor',
	'passengerWindow',
	'rearLeftDoor',
	'rearLeftTyrePressure',
	'rearLeftWindow',
	'rearRightDoor',
	'rearRightTyrePressure',
	'rearRightWindow',
	'remoteClimateStatus',
	'secondRowLeftSeatHeatLevel',
	'secondRowRightSeatHeatLevel',
	'sideLightStatus',
	'steeringHeatLevel',
	'steeringWheelHeatFailureReason',
	'sunroofStatus',
	'vehElecRngDsp',
	'vehicleAlarmStatus',
	'wheelTyreMonitorStatus',
] as const;

/** Minimal client for the global SAIC OAuth login endpoint. */
export class SaicApiClient {
	private readonly fetchFunction: FetchFunction;
	private readonly now: () => number;
	private readonly wait: (milliseconds: number) => Promise<void>;

	/**
	 * @param fetchFunction HTTP transport, injectable for tests.
	 * @param now Clock function returning milliseconds since epoch.
	 * @param wait Delay function used between retry attempts.
	 * @param debug Optional debug logger that receives status diagnostics without response values.
	 */
	public constructor(
		fetchFunction: FetchFunction = fetch,
		now: () => number = Date.now,
		wait: (milliseconds: number) => Promise<void> = milliseconds =>
			new Promise(resolve => setTimeout(resolve, milliseconds)),
		debug: (message: string) => void = () => undefined,
	) {
		this.fetchFunction = fetchFunction;
		this.now = now;
		this.wait = wait;
		this.debug = debug;
	}

	private readonly debug: (message: string) => void;

	/**
	 * Sign in and return a validated access token.
	 *
	 * @param options Account and regional API settings.
	 */
	public async login(options: SaicLoginOptions): Promise<SaicLoginResult> {
		const requestTime = this.now();
		const timestamp = String(requestTime);
		const contentType = 'application/x-www-form-urlencoded';
		const form = new URLSearchParams({
			grant_type: 'password',
			username: options.accountIdentifier,
			password: sha1PasswordDigest(options.password),
			scope: 'all',
			deviceId: `simulator*********************************************${Math.floor(requestTime / 1000)}`,
			deviceType: '0',
			language: 'EN',
			loginType: options.accountType === 'email' ? '2' : '1',
		});

		if (options.accountType === 'phone') {
			if (!options.phoneCountryCode) {
				throw new Error('Phone country calling code is required');
			}
			form.set('countryCode', options.phoneCountryCode);
		}

		const requestPath = '/oauth/token';
		const requestBody = form.toString();
		const encryptedBody = encryptSaicRequestBody(
			requestPath,
			options.tenantId,
			'',
			timestamp,
			contentType,
			requestBody,
		);
		const headers: Record<string, string> = {
			Authorization: 'Basic c3dvcmQ6c3dvcmRfc2VjcmV0',
			Accept: 'application/json',
			'Accept-Encoding': 'gzip',
			'Content-Type': `${contentType};charset=utf-8`,
			'ORIGINAL-CONTENT-TYPE': contentType,
			'APP-SEND-DATE': timestamp,
			'APP-CONTENT-ENCRYPTED': '1',
			'APP-LANGUAGE-TYPE': 'en',
			'APP-VERIFICATION-STRING': createSaicRequestSignature(
				requestPath,
				options.tenantId,
				'',
				timestamp,
				contentType,
				encryptedBody,
			),
			REGION: options.regionCode,
			'tenant-id': options.tenantId,
			'User-Type': 'app',
			'User-Agent': 'Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)',
		};

		let response: Response;
		try {
			const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
			const requestUrl = new URL(requestPath.replace(/^\/+/, ''), baseUrl);
			response = await this.fetchFunction(requestUrl, {
				method: 'POST',
				headers,
				body: encryptedBody,
				signal: AbortSignal.timeout(15_000),
			});
		} catch {
			throw new Error('SAIC login request failed before a response was received');
		}

		const responseText = await response.text();
		if (!response.ok) {
			throw new Error(`SAIC login failed with HTTP status ${response.status}`);
		}

		const responseTimestamp = response.headers.get('APP-SEND-DATE');
		const responseContentType = response.headers.get('ORIGINAL-CONTENT-TYPE');
		const decodedBody =
			responseTimestamp && responseContentType
				? decryptSaicResponseBody(responseText, responseTimestamp, responseContentType)
				: responseText;

		let envelope: SaicApiEnvelope;
		try {
			envelope = JSON.parse(decodedBody) as SaicApiEnvelope;
		} catch {
			throw new Error('SAIC login returned an invalid response');
		}

		if (Number(envelope.code) !== 0) {
			throw new Error(envelope.message || 'SAIC login was rejected');
		}

		const accessToken = envelope.data?.access_token;
		const expiresIn = envelope.data?.expires_in;
		if (!accessToken || !Number.isFinite(expiresIn) || !expiresIn) {
			throw new Error('SAIC login response did not contain a valid access token');
		}

		return { accessToken, expiresIn };
	}

	/**
	 * Retrieve vehicles linked to the authenticated account.
	 *
	 * @param options Account region and tenant settings.
	 * @param accessToken Token returned by {@link login}.
	 */
	public async listVehicles(options: SaicLoginOptions, accessToken: string): Promise<SaicVehicle[]> {
		const timestamp = String(this.now());
		const requestPath = '/vehicle/list';
		const contentType = 'application/json';
		const encryptedBody = '';
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Accept-Encoding': 'gzip',
			'Content-Type': `${contentType};charset=utf-8`,
			'ORIGINAL-CONTENT-TYPE': contentType,
			'APP-SEND-DATE': timestamp,
			'APP-CONTENT-ENCRYPTED': '1',
			'APP-LANGUAGE-TYPE': 'en',
			'APP-VERIFICATION-STRING': createSaicRequestSignature(
				requestPath,
				options.tenantId,
				accessToken,
				timestamp,
				contentType,
				encryptedBody,
			),
			REGION: options.regionCode,
			'tenant-id': options.tenantId,
			'User-Type': 'app',
			'User-Agent': 'Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)',
			'blade-auth': accessToken,
		};

		let response: Response;
		try {
			const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
			const requestUrl = new URL(requestPath.replace(/^\/+/, ''), baseUrl);
			response = await this.fetchFunction(requestUrl, {
				method: 'GET',
				headers,
				signal: AbortSignal.timeout(15_000),
			});
		} catch {
			throw new Error('SAIC vehicle list request failed before a response was received');
		}

		const responseText = await response.text();
		if (!response.ok) {
			throw new Error(`SAIC vehicle list failed with HTTP status ${response.status}`);
		}

		const responseTimestamp = response.headers.get('APP-SEND-DATE');
		const responseContentType = response.headers.get('ORIGINAL-CONTENT-TYPE');
		const decodedBody =
			responseTimestamp && responseContentType
				? decryptSaicResponseBody(responseText, responseTimestamp, responseContentType)
				: responseText;

		let envelope: SaicApiEnvelope;
		try {
			envelope = JSON.parse(decodedBody) as SaicApiEnvelope;
		} catch {
			throw new Error('SAIC vehicle list returned an invalid response');
		}

		if (Number(envelope.code) !== 0) {
			throw new Error(envelope.message || 'SAIC vehicle list request was rejected');
		}
		if (!Array.isArray(envelope.data?.vinList)) {
			throw new Error('SAIC vehicle list response did not contain a vehicle list');
		}

		return envelope.data.vinList.flatMap((item): SaicVehicle[] => {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				return [];
			}
			const record = item as Record<string, unknown>;
			if (typeof record.vin !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(record.vin)) {
				return [];
			}

			const vehicle: SaicVehicle = { vin: record.vin };
			for (const key of ['name', 'brandName', 'modelName', 'series', 'modelYear', 'colorName'] as const) {
				if (typeof record[key] === 'string') {
					vehicle[key] = record[key];
				}
			}
			for (const key of ['isCurrentVehicle', 'isSubaccount'] as const) {
				if (typeof record[key] === 'boolean') {
					vehicle[key] = record[key];
				}
			}
			return [vehicle];
		});
	}

	/**
	 * Retrieve the latest reported status for one vehicle.
	 *
	 * @param options Account region and tenant settings.
	 * @param accessToken Token returned by {@link login}.
	 * @param vin Vehicle identification number.
	 */
	public async getVehicleStatus(
		options: SaicLoginOptions,
		accessToken: string,
		vin: string,
	): Promise<SaicVehicleStatus> {
		let lastError: unknown;
		for (let attempt = 1; attempt <= 5; attempt++) {
			try {
				this.debug(`Live status request for ${vin}: attempt ${attempt}/5`);
				return await this.requestVehicleStatus(options, accessToken, vin, '/vehicle/status', true);
			} catch (error) {
				if (!(error instanceof RetryableVehicleStatusError)) {
					this.debug(`Live status request for ${vin} failed without retry: ${this.errorMessage(error)}`);
					throw error;
				}
				lastError = error;
				this.debug(`Live status request for ${vin} failed on attempt ${attempt}/5: ${error.message}`);
				if (attempt < 5) {
					this.debug(`Retrying live status request for ${vin} in 15 seconds`);
					await this.wait(15_000);
				}
			}
		}
		throw lastError;
	}

	/**
	 * Retrieve the last status stored by SAIC without requesting a live vehicle response.
	 *
	 * @param options Account region and tenant settings.
	 * @param accessToken Token returned by {@link login}.
	 * @param vin Vehicle identification number.
	 */
	public async getCachedVehicleStatus(
		options: SaicLoginOptions,
		accessToken: string,
		vin: string,
	): Promise<SaicVehicleStatus> {
		this.debug(`Cached status request for ${vin}`);
		return this.requestVehicleStatus(options, accessToken, vin, '/vehicle/status/cache', false);
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Unknown error';
	}

	/**
	 * Send a status request and normalize its response.
	 *
	 * @param options Account region and tenant settings.
	 * @param accessToken Token returned by {@link login}.
	 * @param vin Vehicle identification number.
	 * @param requestPath SAIC status endpoint path.
	 * @param useEventId Whether this request asks the vehicle for a live response.
	 */
	private async requestVehicleStatus(
		options: SaicLoginOptions,
		accessToken: string,
		vin: string,
		requestPath: string,
		useEventId: boolean,
	): Promise<SaicVehicleStatus> {
		const timestamp = String(this.now());
		const contentType = 'application/json';
		const query = new URLSearchParams({
			vin: createHash('sha256').update(vin, 'utf8').digest('hex'),
			vehStatusReqType: '2',
		});
		const baseHeaders: Record<string, string> = {
			Accept: 'application/json',
			'Accept-Encoding': 'gzip',
			'Content-Type': `${contentType};charset=utf-8`,
			'ORIGINAL-CONTENT-TYPE': contentType,
			'APP-SEND-DATE': timestamp,
			'APP-CONTENT-ENCRYPTED': '1',
			'APP-LANGUAGE-TYPE': 'en',
			'APP-VERIFICATION-STRING': createSaicRequestSignature(
				`${requestPath}?${query.toString()}`,
				options.tenantId,
				accessToken,
				timestamp,
				contentType,
				'',
			),
			REGION: options.regionCode,
			'tenant-id': options.tenantId,
			'User-Type': 'app',
			'User-Agent': 'Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)',
			'blade-auth': accessToken,
		};
		const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
		const requestUrl = new URL(`${requestPath.replace(/^\/+/, '')}?${query.toString()}`, baseUrl);
		const deadline = Date.now() + (useEventId ? 30_000 : 15_000);
		let eventId = '0';
		let requestCount = 0;
		let initialTimeoutRetried = false;
		let envelope: SaicApiEnvelope;
		let responseHeaders: Headers;
		while (true) {
			const headers = { ...baseHeaders };
			if (useEventId) {
				headers['event-id'] = eventId;
			}
			let response: Response;
			let requestStartedAt = Date.now();
			try {
				requestCount++;
				const requestTimeoutMs = Math.max(1, Math.min(useEventId ? 5_000 : 15_000, deadline - Date.now()));
				requestStartedAt = Date.now();
				this.debug(
					`GET ${requestPath} for ${vin}, request ${requestCount}, timeout ${requestTimeoutMs}ms, event-id ${useEventId ? eventId : 'none'}`,
				);
				response = await this.fetchFunction(requestUrl, {
					method: 'GET',
					headers,
					signal: AbortSignal.timeout(requestTimeoutMs),
				});
				this.debug(
					`GET ${requestPath} for ${vin} received response headers after ${Date.now() - requestStartedAt}ms`,
				);
			} catch (error) {
				const details = error instanceof Error ? error.message : 'Unknown network error';
				this.debug(
					`GET ${requestPath} for ${vin} failed after ${Date.now() - requestStartedAt}ms before response: ${details}`,
				);
				throw new RetryableVehicleStatusError(
					`SAIC vehicle status request failed before a response was received: ${details}`,
				);
			}

			let responseText: string;
			try {
				responseText = await response.text();
			} catch (error) {
				const details = error instanceof Error ? error.message : 'Unknown network error';
				this.debug(`GET ${requestPath} for ${vin} response body read failed: ${details}`);
				throw new RetryableVehicleStatusError(`SAIC vehicle status response could not be read: ${details}`);
			}
			this.debug(
				`GET ${requestPath} for ${vin} returned HTTP ${response.status}, ${responseText.length} response characters`,
			);
			if (!response.ok) {
				const ErrorType =
					response.status === 429 || response.status >= 500 ? RetryableVehicleStatusError : Error;
				throw new ErrorType(`SAIC vehicle status failed with HTTP status ${response.status}`);
			}

			const responseTimestamp = response.headers.get('APP-SEND-DATE');
			const responseContentType = response.headers.get('ORIGINAL-CONTENT-TYPE');
			const decodedBody =
				responseTimestamp && responseContentType
					? decryptSaicResponseBody(responseText, responseTimestamp, responseContentType)
					: responseText;

			try {
				envelope = JSON.parse(decodedBody) as SaicApiEnvelope;
			} catch {
				this.debug(`GET ${requestPath} for ${vin} returned invalid JSON`);
				throw new Error('SAIC vehicle status returned an invalid response');
			}
			responseHeaders = response.headers;
			const nextEventId = response.headers.get('event-id');
			const responseMessage =
				typeof envelope.message === 'string'
					? envelope.message.replace(/[\r\n\t]/g, ' ').slice(0, 200)
					: 'none';
			this.debug(
				`GET ${requestPath} for ${vin} returned SAIC code ${String(envelope.code)}, message: ${responseMessage}, data keys: ${Object.keys(envelope.data ?? {}).join(', ') || 'none'}, next event-id: ${nextEventId ?? 'none'}`,
			);
			if (useEventId && Number(envelope.code) === 0 && envelope.data === undefined) {
				if (Date.now() >= deadline) {
					throw new Error('SAIC vehicle status timed out while waiting for vehicle data');
				}
				await new Promise(resolve => setTimeout(resolve, Math.min(1_000, Math.max(0, deadline - Date.now()))));
				if (nextEventId) {
					eventId = nextEventId;
				}
				continue;
			}
			const returnCode = Number(envelope.code);
			if (useEventId && returnCode === 12808) {
				throw new RetryableVehicleStatusError(envelope.message || 'SAIC vehicle status request timed out');
			}
			if (
				useEventId &&
				returnCode !== 0 &&
				![2, 3, 7].includes(returnCode) &&
				(eventId !== '0' ||
					(envelope.data === undefined && Boolean(nextEventId)) ||
					(returnCode === 1 && !initialTimeoutRetried))
			) {
				if (Date.now() >= deadline) {
					throw new Error(envelope.message || 'SAIC vehicle status timed out while waiting for vehicle data');
				}
				if (eventId === '0' && !nextEventId) {
					initialTimeoutRetried = true;
				}
				await new Promise(resolve => setTimeout(resolve, Math.min(1_000, Math.max(0, deadline - Date.now()))));
				if (nextEventId) {
					eventId = nextEventId;
				}
				continue;
			}
			break;
		}

		if (Number(envelope.code) !== 0) {
			throw new Error(envelope.message || 'SAIC vehicle status request was rejected');
		}
		if (
			!envelope.data?.basicVehicleStatus ||
			typeof envelope.data.basicVehicleStatus !== 'object' ||
			Array.isArray(envelope.data.basicVehicleStatus)
		) {
			const responseKeys = Object.keys(envelope).join(', ') || 'none';
			const responseEventId = useEventId ? responseHeaders.get('event-id') : null;
			const dataType =
				envelope.data === null ? 'null' : Array.isArray(envelope.data) ? 'array' : typeof envelope.data;
			const dataKeys =
				envelope.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)
					? Object.keys(envelope.data).join(', ') || 'none'
					: 'unavailable';
			this.debug(
				`GET ${requestPath} for ${vin} status shape invalid: code ${String(envelope.code)}, data type ${dataType}, data keys ${dataKeys}`,
			);
			throw new Error(
				`SAIC vehicle status response did not contain basic status data (code: ${String(envelope.code)}, response keys: ${responseKeys}, data type: ${dataType}, data keys: ${dataKeys}${responseEventId ? `, event-id: ${responseEventId}` : ''})`,
			);
		}

		const rawStatus = envelope.data.basicVehicleStatus as Record<string, unknown>;
		const basicVehicleStatus: Record<string, number> = {};
		const acceptedFields: string[] = [];
		const ignoredFields: string[] = [];
		for (const field of vehicleStatusFields) {
			const value = rawStatus[field];
			if (typeof value === 'number' && Number.isFinite(value) && value !== -128) {
				basicVehicleStatus[field] = value;
				acceptedFields.push(field);
			} else if (value !== undefined) {
				ignoredFields.push(field);
			}
		}
		const unknownFields = Object.keys(rawStatus).filter(
			field => !(vehicleStatusFields as readonly string[]).includes(field),
		);
		const gpsPosition = envelope.data.gpsPosition;
		if (gpsPosition && typeof gpsPosition === 'object' && !Array.isArray(gpsPosition)) {
			const wayPoint = (gpsPosition as Record<string, unknown>).wayPoint;
			if (wayPoint && typeof wayPoint === 'object' && !Array.isArray(wayPoint)) {
				const speed = (wayPoint as Record<string, unknown>).speed;
				if (typeof speed === 'number' && Number.isFinite(speed) && speed !== -128) {
					basicVehicleStatus.speed = speed;
					acceptedFields.push('speed');
				}
			}
		}
		this.debug(
			`GET ${requestPath} for ${vin} parsed ${acceptedFields.length} status fields [${acceptedFields.join(', ')}]; ignored fields [${ignoredFields.join(', ') || 'none'}]; unknown fields [${unknownFields.join(', ') || 'none'}]`,
		);

		return {
			basicVehicleStatus,
			...(typeof envelope.data.statusTime === 'number' && Number.isFinite(envelope.data.statusTime)
				? { statusTime: envelope.data.statusTime }
				: {}),
			...(typeof envelope.data.onlineStatus === 'number' && Number.isFinite(envelope.data.onlineStatus)
				? { onlineStatus: envelope.data.onlineStatus }
				: {}),
		};
	}
}
