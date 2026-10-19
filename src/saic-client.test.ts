import { expect } from 'chai';
import { SaicApiClient } from './saic-client';

describe('SaicApiClient login', () => {
	const options = {
		baseUrl: 'https://gateway-mg-eu.soimt.com/api.app/v1/',
		regionCode: 'eu',
		tenantId: '459771',
		accountType: 'email' as const,
		accountIdentifier: 'driver@example.com',
		password: 'test-password',
	};

	it('uses the API base path and decodes an encrypted token response', async () => {
		let requestUrl: URL | undefined;
		const fetchFunction: typeof fetch = input => {
			requestUrl = input instanceof URL ? input : new URL(input instanceof Request ? input.url : input);
			return Promise.resolve(
				new Response(
					'5a7918074831d63b5987038e572c12febe792a0427e47754c8fc9cf5dcb5d7532aa92b0c010749b2' +
						'4fb9571ce5af2ac487748c2ac612a6c3faa162bd0f4f4f2b1b7fc46ac50dcb7a08f135cae5c0a199',
					{
						status: 200,
						headers: {
							'APP-SEND-DATE': '1700000000123',
							'ORIGINAL-CONTENT-TYPE': 'application/json',
						},
					},
				),
			);
		};
		const client = new SaicApiClient(fetchFunction, () => 1_700_000_000_123);

		expect(await client.login(options)).to.deep.equal({ accessToken: 'access-token', expiresIn: 3600 });
		expect(requestUrl?.href).to.equal('https://gateway-mg-eu.soimt.com/api.app/v1/oauth/token');
	});

	it('rejects phone login without a country calling code before making a request', async () => {
		let requestMade = false;
		const fetchFunction: typeof fetch = () => {
			requestMade = true;
			return Promise.resolve(new Response('{}'));
		};
		const client = new SaicApiClient(fetchFunction);

		try {
			await client.login({ ...options, accountType: 'phone' });
			expect.fail('Expected missing phone country code to be rejected');
		} catch (error) {
			expect((error as Error).message).to.equal('Phone country calling code is required');
		}
		expect(requestMade).to.equal(false);
	});

	it('reports HTTP failures without attempting to decrypt the error body', async () => {
		const fetchFunction: typeof fetch = () =>
			Promise.resolve(
				new Response('unauthorized', {
					status: 401,
					headers: {
						'APP-SEND-DATE': '1700000000123',
						'ORIGINAL-CONTENT-TYPE': 'application/json',
					},
				}),
			);
		const client = new SaicApiClient(fetchFunction, () => 1_700_000_000_123);

		try {
			await client.login(options);
			expect.fail('Expected HTTP failure to be rejected');
		} catch (error) {
			expect((error as Error).message).to.equal('SAIC login failed with HTTP status 401');
		}
	});
});

describe('SaicApiClient vehicle list', () => {
	const options = {
		baseUrl: 'https://gateway-mg-eu.soimt.com/api.app/v1/',
		regionCode: 'eu',
		tenantId: '459771',
		accountType: 'email' as const,
		accountIdentifier: 'driver@example.com',
		password: 'test-password',
	};

	it('sends the access token and validates vehicles from the SAIC response', async () => {
		let requestUrl: URL | undefined;
		let requestInit: RequestInit | undefined;
		const fetchFunction: typeof fetch = (input, init) => {
			requestUrl = input instanceof URL ? input : new URL(input instanceof Request ? input.url : input);
			requestInit = init;
			return Promise.resolve(
				new Response(
					JSON.stringify({
						code: 0,
						data: {
							vinList: [
								{ vin: 'LSJWH4099NS012345', name: 'MG4', modelName: 'MG4', modelYear: '2023' },
								{ vin: '../invalid', name: 'invalid' },
							],
						},
					}),
				),
			);
		};
		const client = new SaicApiClient(fetchFunction, () => 1_700_000_000_123);

		expect(await client.listVehicles(options, 'test-access-token')).to.deep.equal([
			{ vin: 'LSJWH4099NS012345', name: 'MG4', modelName: 'MG4', modelYear: '2023' },
		]);
		expect(requestUrl?.href).to.equal('https://gateway-mg-eu.soimt.com/api.app/v1/vehicle/list');
		expect(requestInit?.method).to.equal('GET');
		expect(new Headers(requestInit?.headers).get('blade-auth')).to.equal('test-access-token');
	});

	it('rejects an unexpected vehicle-list response shape', async () => {
		const client = new SaicApiClient(() => Promise.resolve(new Response('{"code":0,"data":{}}')));

		try {
			await client.listVehicles(options, 'test-access-token');
			expect.fail('Expected missing vinList to be rejected');
		} catch (error) {
			expect((error as Error).message).to.equal('SAIC vehicle list response did not contain a vehicle list');
		}
	});
});

describe('SaicApiClient vehicle status', () => {
	const options = {
		baseUrl: 'https://gateway-mg-eu.soimt.com/api.app/v1/',
		regionCode: 'eu',
		tenantId: '459771',
		accountType: 'email' as const,
		accountIdentifier: 'driver@example.com',
		password: 'test-password',
	};

	it('requests status with a hashed VIN and filters unknown or unavailable fields', async () => {
		let requestUrl: URL | undefined;
		let requestInit: RequestInit | undefined;
		const fetchFunction: typeof fetch = (input, init) => {
			requestUrl = input instanceof URL ? input : new URL(input instanceof Request ? input.url : input);
			requestInit = init;
			return Promise.resolve(
				new Response(
					JSON.stringify({
						code: 0,
						data: {
							statusTime: 1_700_000_000,
							basicVehicleStatus: {
								batteryVoltage: 142,
								mileage: -128,
								unexpectedValue: 5,
								lockStatus: 'locked',
							},
						},
					}),
				),
			);
		};
		const client = new SaicApiClient(fetchFunction, () => 1_700_000_000_123);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			statusTime: 1_700_000_000,
			basicVehicleStatus: { batteryVoltage: 142 },
		});
		expect(requestUrl?.pathname).to.equal('/api.app/v1/vehicle/status');
		expect(requestUrl?.searchParams.get('vin')).to.equal(
			'c33961cdfef7f7b6a22110cfbd900a4cba50418b926077cf81334e6264bca0e5',
		);
		expect(requestUrl?.searchParams.get('vehStatusReqType')).to.equal('2');
		expect(new Headers(requestInit?.headers).get('event-id')).to.equal('0');
		expect(new Headers(requestInit?.headers).get('blade-auth')).to.equal('test-access-token');
	});

	it('rejects status replies without basicVehicleStatus', async () => {
		const client = new SaicApiClient(() => Promise.resolve(new Response('{"code":0,"data":{}}')));

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected missing basicVehicleStatus to be rejected');
		} catch (error) {
			expect((error as Error).message).to.contain(
				'SAIC vehicle status response did not contain basic status data (code: 0, response keys: code, data, data type: object, data keys: none)',
			);
		}
	});

	it('reports the JSON type when SAIC status data is null', async () => {
		const client = new SaicApiClient(() =>
			Promise.resolve(new Response('{"code":0,"message":"success","data":null}')),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected null status data to be rejected');
		} catch (error) {
			expect((error as Error).message).to.contain('response keys: code, message, data, data type: null');
		}
	});

	it('continues live status requests with the event id returned by SAIC', async () => {
		const requestEventIds: string[] = [];
		let callCount = 0;
		const client = new SaicApiClient((_input, init) => {
			requestEventIds.push(new Headers(init?.headers).get('event-id') ?? 'missing');
			callCount += 1;
			if (callCount === 1) {
				return Promise.resolve(
					new Response('{"code":0,"message":"success"}', {
						headers: { 'event-id': 'next-event-123' },
					}),
				);
			}
			return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
		});

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(requestEventIds).to.deep.equal(['0', 'next-event-123']);
	});

	it('retries empty live replies without an event id using the current event id', async () => {
		const requestEventIds: string[] = [];
		let callCount = 0;
		const client = new SaicApiClient((_input, init) => {
			requestEventIds.push(new Headers(init?.headers).get('event-id') ?? 'missing');
			callCount += 1;
			if (callCount === 1) {
				return Promise.resolve(new Response('{"code":0,"message":"success"}'));
			}
			return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
		});

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(requestEventIds).to.deep.equal(['0', '0']);
	});

	it('retries live timeout replies using the next event id', async function () {
		this.timeout(5_000);
		const requestEventIds: string[] = [];
		let callCount = 0;
		const client = new SaicApiClient((_input, init) => {
			requestEventIds.push(new Headers(init?.headers).get('event-id') ?? 'missing');
			callCount += 1;
			if (callCount === 1) {
				return Promise.resolve(
					new Response('{"code":0,"message":"success"}', {
						headers: { 'event-id': 'event-123' },
					}),
				);
			}
			if (callCount === 2) {
				return Promise.resolve(
					new Response('{"code":1,"message":"The request timed out, please try again later."}', {
						headers: { 'event-id': 'event-456' },
					}),
				);
			}
			return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
		});

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(requestEventIds).to.deep.equal(['0', 'event-123', 'event-456']);
	});

	it('retries an initial live timeout reply when SAIC provides an event id', async () => {
		const requestEventIds: string[] = [];
		const client = new SaicApiClient((_input, init) => {
			requestEventIds.push(new Headers(init?.headers).get('event-id') ?? 'missing');
			if (requestEventIds.length === 1) {
				return Promise.resolve(
					new Response('{"code":1,"message":"The request timed out, please try again later."}', {
						headers: { 'event-id': 'event-123' },
					}),
				);
			}
			return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
		});

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(requestEventIds).to.deep.equal(['0', 'event-123']);
	});

	it('requests SAIC cached status without an event id', async () => {
		let requestUrl: URL | undefined;
		let requestInit: RequestInit | undefined;
		const client = new SaicApiClient((input, init) => {
			requestUrl = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
			requestInit = init;
			return Promise.resolve(
				new Response(
					JSON.stringify({
						code: 0,
						data: { basicVehicleStatus: { lockStatus: 1 }, statusTime: 1_700_000_000, onlineStatus: 1 },
					}),
				),
			);
		});

		expect(await client.getCachedVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
			statusTime: 1_700_000_000,
			onlineStatus: 1,
		});
		expect(requestUrl?.pathname).to.equal('/api.app/v1/vehicle/status/cache');
		expect(requestUrl?.searchParams.get('vehStatusReqType')).to.equal('2');
		expect(new Headers(requestInit?.headers).has('event-id')).to.equal(false);
	});

	it('preserves network failure details for status requests', async () => {
		const client = new SaicApiClient(() => Promise.reject(new Error('getaddrinfo ENOTFOUND gateway.example')));

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected network failure to be rejected');
		} catch (error) {
			expect((error as Error).message).to.contain('getaddrinfo ENOTFOUND gateway.example');
		}
	});
});
