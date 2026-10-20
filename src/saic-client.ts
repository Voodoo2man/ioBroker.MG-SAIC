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
	/** Numeric basic vehicle status values, including fields added by SAIC. */
	basicVehicleStatus: Record<string, number>;
}

/** HTTP transport type used for injectable API requests. */
type FetchFunction = typeof fetch;
type WaitFunction = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

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
class SaicBodyReadError extends Error {}
/** HTTP status failure returned by SAIC. */
export class SaicHttpError extends Error {
	/**
	 * @param message Bounded request error message.
	 * @param status HTTP status code.
	 */
	public constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
	}
}

/**
 * Accept missing timestamps, but reject implausibly old or future vehicle data.
 *
 * @param statusTime Vehicle timestamp in epoch seconds.
 * @param now Current time in epoch milliseconds.
 */
export function isVehicleStatusTimestampValid(statusTime: number | undefined, now: number): boolean {
	if (statusTime === undefined) {
		return true;
	}
	const timestampMs = statusTime * 1000;
	return Number.isFinite(timestampMs) && timestampMs <= now + 5 * 60_000 && timestampMs >= now - 24 * 60 * 60_000;
}

/**
 * Compare vehicle timestamps in epoch seconds, allowing missing timestamps.
 *
 * @param statusTime Current response timestamp.
 * @param previousStatusTime Timestamp of the last accepted response.
 */
export function isVehicleStatusNotOlder(
	statusTime: number | undefined,
	previousStatusTime: number | undefined,
): boolean {
	return statusTime === undefined || previousStatusTime === undefined || statusTime >= previousStatusTime;
}

/** Minimal client for the global SAIC OAuth login endpoint. */
export class SaicApiClient {
	private readonly fetchFunction: FetchFunction;
	private readonly now: () => number;
	private readonly monotonicNow: () => number;
	private readonly wait: WaitFunction;

	/**
	 * @param fetchFunction HTTP transport, injectable for tests.
	 * @param now Clock function returning milliseconds since epoch.
	 * @param wait Delay function used between retry attempts.
	 * @param debug Optional debug logger that receives status diagnostics without response values.
	 * @param monotonicNow Monotonic clock used to bound live event polling.
	 */
	public constructor(
		fetchFunction: FetchFunction = fetch,
		now: () => number = Date.now,
		wait: WaitFunction = (milliseconds, signal) =>
			new Promise((resolve, reject) => {
				if (signal?.aborted) {
					reject(signal.reason instanceof Error ? signal.reason : new Error('Request was aborted'));
					return;
				}
				const timerRef: { current?: NodeJS.Timeout } = {};
				const onAbort = (): void => {
					if (timerRef.current) {
						clearTimeout(timerRef.current);
					}
					reject(signal?.reason instanceof Error ? signal.reason : new Error('Request was aborted'));
				};
				const timer = setTimeout(() => {
					signal?.removeEventListener('abort', onAbort);
					resolve();
				}, milliseconds);
				timerRef.current = timer;
				signal?.addEventListener('abort', onAbort, { once: true });
			}),
		debug: (message: string) => void = () => undefined,
		monotonicNow: () => number = () => performance.now(),
	) {
		this.fetchFunction = fetchFunction;
		this.now = now;
		this.wait = wait;
		this.monotonicNow = monotonicNow;
		this.debug = debug;
	}

	private readonly debug: (message: string) => void;

	/**
	 * Sign in and return a validated access token.
	 *
	 * @param options Account and regional API settings.
	 * @param signal Optional caller cancellation signal.
	 */
	public async login(options: SaicLoginOptions, signal?: AbortSignal): Promise<SaicLoginResult> {
		const requestTime = this.now();
		const timestamp = String(requestTime);
		const contentType = 'application/x-www-form-urlencoded';
		const form = new URLSearchParams({
			grant_type: 'password',
			username: options.accountIdentifier,
			password: sha1PasswordDigest(options.password),
			scope: 'all',
			deviceId: `simulator*********************************************${Math.floor(requestTime / 1000)}###com.saicmotor.europecar`,
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

		let result: { response: Response; body: string };
		try {
			const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
			const requestUrl = new URL(requestPath.replace(/^\/+/, ''), baseUrl);
			result = await this.fetchResponse(
				requestUrl,
				{ method: 'POST', headers, body: encryptedBody },
				15_000,
				signal,
			);
		} catch (error) {
			if (signal?.aborted) {
				throw signal.reason;
			}
			if (error instanceof SaicBodyReadError) {
				throw new Error(`SAIC login response body could not be read: ${error.message}`);
			}
			throw new Error(`SAIC login request failed before a response was received: ${this.errorMessage(error)}`);
		}

		const { response, body: responseText } = result;
		if (!response.ok) {
			throw new Error(`SAIC login failed with HTTP status ${response.status}`);
		}

		const decodedBody = this.decodeResponseBody(response, responseText, 'login');

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
	 * @param signal Optional caller cancellation signal.
	 */
	public async listVehicles(
		options: SaicLoginOptions,
		accessToken: string,
		signal?: AbortSignal,
	): Promise<SaicVehicle[]> {
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

		let result: { response: Response; body: string };
		try {
			const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
			const requestUrl = new URL(requestPath.replace(/^\/+/, ''), baseUrl);
			result = await this.fetchResponse(requestUrl, { method: 'GET', headers }, 15_000, signal);
		} catch (error) {
			if (signal?.aborted) {
				throw signal.reason;
			}
			if (error instanceof SaicBodyReadError) {
				throw new Error(`SAIC vehicle list response body could not be read: ${error.message}`);
			}
			throw new Error(
				`SAIC vehicle list request failed before a response was received: ${this.errorMessage(error)}`,
			);
		}

		const { response, body: responseText } = result;
		if (!response.ok) {
			throw new Error(`SAIC vehicle list failed with HTTP status ${response.status}`);
		}

		const decodedBody = this.decodeResponseBody(response, responseText, 'vehicle list');

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
	 * @param signal Optional caller cancellation signal.
	 */
	public async getVehicleStatus(
		options: SaicLoginOptions,
		accessToken: string,
		vin: string,
		signal?: AbortSignal,
	): Promise<SaicVehicleStatus> {
		let lastError: unknown;
		for (let attempt = 1; attempt <= 5; attempt++) {
			if (signal?.aborted) {
				throw signal.reason;
			}
			try {
				this.debug(`Live status request for ${vin}: attempt ${attempt}/5`);
				return await this.requestVehicleStatus(options, accessToken, vin, '/vehicle/status', true, signal);
			} catch (error) {
				if (signal?.aborted) {
					throw signal.reason;
				}
				if (!(error instanceof RetryableVehicleStatusError)) {
					throw error;
				}
				lastError = error;
				this.debug(
					`Live status request for ${vin} failed on attempt ${attempt}/5: ${this.errorMessage(error)}`,
				);
				if (attempt < 5) {
					this.debug(`Retrying live status request for ${vin} in 15 seconds`);
					await this.wait(15_000, signal);
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
	 * @param signal Optional caller cancellation signal.
	 */
	public async getCachedVehicleStatus(
		options: SaicLoginOptions,
		accessToken: string,
		vin: string,
		signal?: AbortSignal,
	): Promise<SaicVehicleStatus> {
		this.debug(`Cached status request for ${vin}`);
		return this.requestVehicleStatus(options, accessToken, vin, '/vehicle/status/cache', false, signal);
	}

	private async fetchResponse(
		url: URL,
		init: RequestInit,
		timeoutMs: number,
		signal?: AbortSignal,
	): Promise<{ response: Response; body: string }> {
		const controller = new AbortController();
		const timer = setTimeout(
			() => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
			timeoutMs,
		);
		const abort = (): void => controller.abort(signal?.reason);
		if (signal?.aborted) {
			abort();
		} else if (signal) {
			signal.addEventListener('abort', abort, { once: true });
		}
		try {
			const response = await this.fetchFunction(url, { ...init, signal: controller.signal });
			try {
				return { response, body: await response.text() };
			} catch (error) {
				throw new SaicBodyReadError(this.errorMessage(error));
			}
		} finally {
			clearTimeout(timer);
			signal?.removeEventListener('abort', abort);
		}
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Unknown error';
	}

	private decodeResponseBody(response: Response, responseText: string, context: string): string {
		const responseTimestamp = response.headers.get('APP-SEND-DATE');
		const responseContentType = response.headers.get('ORIGINAL-CONTENT-TYPE');
		if (!responseTimestamp || !responseContentType) {
			return responseText;
		}
		try {
			return decryptSaicResponseBody(responseText, responseTimestamp, responseContentType);
		} catch (error) {
			throw new Error(`SAIC ${context} response could not be decrypted: ${this.errorMessage(error)}`);
		}
	}

	/**
	 * Send a status request and normalize its response.
	 *
	 * @param options Account region and tenant settings.
	 * @param accessToken Token returned by {@link login}.
	 * @param vin Vehicle identification number.
	 * @param requestPath SAIC status endpoint path.
	 * @param useEventId Whether this request asks the vehicle for a live response.
	 * @param signal Optional caller cancellation signal.
	 */
	private async requestVehicleStatus(
		options: SaicLoginOptions,
		accessToken: string,
		vin: string,
		requestPath: string,
		useEventId: boolean,
		signal?: AbortSignal,
	): Promise<SaicVehicleStatus> {
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
			'APP-CONTENT-ENCRYPTED': '1',
			'APP-LANGUAGE-TYPE': 'en',
			REGION: options.regionCode,
			'tenant-id': options.tenantId,
			'User-Type': 'app',
			'User-Agent': 'Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)',
			'blade-auth': accessToken,
		};
		const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
		const requestUrl = new URL(`${requestPath.replace(/^\/+/, '')}?${query.toString()}`, baseUrl);
		const deadline = this.monotonicNow() + (useEventId ? 30_000 : 15_000);
		let eventId = '0';
		let requestCount = 0;
		let envelope: SaicApiEnvelope;
		let responseHeaders: Headers;
		while (true) {
			if (signal?.aborted) {
				throw signal.reason;
			}
			if (useEventId && this.monotonicNow() >= deadline) {
				throw new RetryableVehicleStatusError('SAIC vehicle status timed out while waiting for vehicle data');
			}
			if (requestCount >= 11) {
				throw new RetryableVehicleStatusError('SAIC vehicle status event polling exceeded its request limit');
			}
			const timestamp = String(this.now());
			const headers = { ...baseHeaders };
			headers['APP-SEND-DATE'] = timestamp;
			headers['APP-VERIFICATION-STRING'] = createSaicRequestSignature(
				`${requestPath}?${query.toString()}`,
				options.tenantId,
				accessToken,
				timestamp,
				contentType,
				'',
			);
			if (useEventId) {
				headers['event-id'] = eventId;
			}
			let result: { response: Response; body: string };
			let requestStartedAt = this.now();
			try {
				requestCount++;
				const requestTimeoutMs = Math.ceil(
					Math.max(1, Math.min(useEventId ? 5_000 : 15_000, deadline - this.monotonicNow())),
				);
				requestStartedAt = this.now();
				this.debug(
					`GET ${requestPath} for ${vin}, request ${requestCount}, timeout ${requestTimeoutMs}ms, event-id ${useEventId ? eventId : 'none'}`,
				);
				result = await this.fetchResponse(requestUrl, { method: 'GET', headers }, requestTimeoutMs, signal);
				this.debug(
					`GET ${requestPath} for ${vin} received response and body after ${this.now() - requestStartedAt}ms`,
				);
			} catch (error) {
				if (signal?.aborted) {
					throw signal.reason;
				}
				if (error instanceof SaicBodyReadError) {
					throw new RetryableVehicleStatusError(
						`SAIC vehicle status response could not be read: ${error.message}`,
					);
				}
				const details = error instanceof Error ? error.message : 'Unknown network error';
				this.debug(
					`GET ${requestPath} for ${vin} failed after ${this.now() - requestStartedAt}ms before response: ${details}`,
				);
				throw new RetryableVehicleStatusError(
					`SAIC vehicle status request failed before a response was received: ${details}`,
				);
			}

			const { response, body: responseText } = result;
			this.debug(
				`GET ${requestPath} for ${vin} returned HTTP ${response.status}, ${responseText.length} response characters`,
			);
			if (!response.ok) {
				if (response.status === 429 || response.status >= 500) {
					throw new RetryableVehicleStatusError(
						`SAIC vehicle status failed with HTTP status ${response.status}`,
					);
				}
				throw new SaicHttpError(
					`SAIC vehicle status failed with HTTP status ${response.status}`,
					response.status,
				);
			}

			const decodedBody = this.decodeResponseBody(response, responseText, 'vehicle status');

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
			const returnCode = Number(envelope.code);
			if (returnCode === 401 || returnCode === 403) {
				throw new SaicHttpError(`SAIC rejected vehicle status with code ${returnCode}`, returnCode);
			}
			if (
				useEventId &&
				![2, 3, 7].includes(returnCode) &&
				((Boolean(nextEventId) && envelope.data === undefined) || (returnCode !== 0 && eventId !== '0'))
			) {
				if (this.monotonicNow() >= deadline) {
					throw new RetryableVehicleStatusError(
						envelope.message || 'SAIC vehicle status timed out while waiting for vehicle data',
					);
				}
				await this.wait(Math.min(3_000, Math.max(0, deadline - this.monotonicNow())), signal);
				if (nextEventId) {
					eventId = nextEventId;
				}
				continue;
			}
			if (useEventId && returnCode === 0 && envelope.data === undefined && this.monotonicNow() >= deadline) {
				throw new RetryableVehicleStatusError('SAIC vehicle status timed out while waiting for vehicle data');
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
		if (
			envelope.data.statusTime !== undefined &&
			envelope.data.statusTime !== null &&
			(typeof envelope.data.statusTime !== 'number' ||
				!isVehicleStatusTimestampValid(envelope.data.statusTime, this.now()))
		) {
			throw new Error('SAIC vehicle status timestamp is outside the trusted freshness window');
		}

		const rawStatus = envelope.data.basicVehicleStatus as Record<string, unknown>;
		const basicVehicleStatus: Record<string, number> = {};
		const acceptedFields: string[] = [];
		const ignoredFields: string[] = [];
		for (const [field, value] of Object.entries(rawStatus)) {
			if (typeof value === 'number' && Number.isFinite(value) && value !== -128) {
				basicVehicleStatus[field] = value;
				acceptedFields.push(field);
			} else {
				ignoredFields.push(field);
			}
		}
		const gpsPosition = envelope.data.gpsPosition;
		if (gpsPosition && typeof gpsPosition === 'object' && !Array.isArray(gpsPosition)) {
			const wayPoint = (gpsPosition as Record<string, unknown>).wayPoint;
			if (wayPoint && typeof wayPoint === 'object' && !Array.isArray(wayPoint)) {
				for (const [field, value] of Object.entries(wayPoint as Record<string, unknown>)) {
					if (typeof value === 'number' && Number.isFinite(value) && value !== -128) {
						const statusField =
							field === 'speed' ? 'speed' : `gps${field[0].toUpperCase()}${field.slice(1)}`;
						basicVehicleStatus[statusField] = value;
						acceptedFields.push(statusField);
					} else {
						ignoredFields.push(`gpsPosition.wayPoint.${field}`);
					}
				}
			}
		}
		this.debug(
			`GET ${requestPath} for ${vin} parsed ${acceptedFields.length} status fields [${acceptedFields.join(', ')}]; ignored fields [${ignoredFields.join(', ') || 'none'}]`,
		);
		if (acceptedFields.length === 0) {
			throw new Error('SAIC vehicle status response contained no usable vehicle fields');
		}

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
