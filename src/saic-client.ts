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

type FetchFunction = typeof fetch;

interface SaicApiEnvelope {
	code?: number | string;
	message?: string;
	data?: {
		access_token?: string;
		expires_in?: number;
		vinList?: unknown;
	};
}

/** Minimal client for the global SAIC OAuth login endpoint. */
export class SaicApiClient {
	private readonly fetchFunction: FetchFunction;
	private readonly now: () => number;

	/**
	 * @param fetchFunction HTTP transport, injectable for tests.
	 * @param now Clock function returning milliseconds since epoch.
	 */
	public constructor(fetchFunction: FetchFunction = fetch, now: () => number = Date.now) {
		this.fetchFunction = fetchFunction;
		this.now = now;
	}

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
}
