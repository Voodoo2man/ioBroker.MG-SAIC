import { expect } from 'chai';
import { createHash } from 'node:crypto';
import {
	isVehicleStatusNotOlder,
	isVehicleStatusTimestampValid,
	SaicApiClient,
	SaicRemoteInstructionError,
	climateTemperatureToIndex,
	getClimateTemperatureRange,
	targetSocPercentToCode,
	type SaicVehicleSetting,
	type SaicVehicleCommand,
} from './saic-client';
import { createSaicRequestSignature, encryptSaicRequestBody, sha1PasswordDigest } from './saic-crypto';

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
		let requestInit: RequestInit | undefined;
		const fetchFunction: typeof fetch = (input, init) => {
			requestInit = init;
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
		const form = new URLSearchParams({
			grant_type: 'password',
			username: options.accountIdentifier,
			password: sha1PasswordDigest(options.password),
			scope: 'all',
			deviceId: 'simulator*********************************************1700000000###com.saicmotor.europecar',
			deviceType: '0',
			language: 'EN',
			loginType: '2',
		});
		expect(requestInit?.body).to.equal(
			encryptSaicRequestBody(
				'/oauth/token',
				options.tenantId,
				'',
				'1700000000123',
				'application/x-www-form-urlencoded',
				form.toString(),
			),
		);
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

describe('Home Assistant control value mappings', () => {
	it('converts Celsius setpoints using the vehicle-series ranges and index offsets', () => {
		expect(getClimateTemperatureRange('EH32 S')).to.deep.equal({ min: 17, max: 31 });
		expect(getClimateTemperatureRange('MZS3E')).to.deep.equal({ min: 16, max: 31 });
		expect(getClimateTemperatureRange('EP2')).to.deep.equal({ min: 16, max: 28 });
		expect(climateTemperatureToIndex(17, 'EH32 S')).to.equal(3);
		expect(climateTemperatureToIndex(22, 'EH32 S')).to.equal(8);
		expect(climateTemperatureToIndex(16, 'EP2')).to.equal(2);
	});

	it('converts supported target SoC percentages to SAIC codes', () => {
		expect([40, 50, 60, 70, 80, 90, 100].map(targetSocPercentToCode)).to.deep.equal([1, 2, 3, 4, 5, 6, 7]);
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
		const client = new SaicApiClient(
			() => Promise.resolve(new Response('{"code":0,"data":{}}')),
			Date.now,
			() => Promise.resolve(),
		);

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

	it('accepts missing/fresh status timestamps and rejects stale or far-future timestamps', () => {
		const now = 1_800_000_000_000;
		expect(isVehicleStatusTimestampValid(undefined, now)).to.equal(true);
		expect(isVehicleStatusTimestampValid(now / 1000, now)).to.equal(true);
		expect(isVehicleStatusTimestampValid(now / 1000 - 24 * 60 * 60, now)).to.equal(true);
		expect(isVehicleStatusTimestampValid(now / 1000 - 24 * 60 * 60 - 1, now)).to.equal(false);
		expect(isVehicleStatusTimestampValid(now / 1000 + 5 * 60 + 1, now)).to.equal(false);
	});

	it('does not treat an older live status timestamp as fresh', () => {
		expect(isVehicleStatusNotOlder(100, 101)).to.equal(false);
		expect(isVehicleStatusNotOlder(101, 101)).to.equal(true);
		expect(isVehicleStatusNotOlder(102, 101)).to.equal(true);
		expect(isVehicleStatusNotOlder(undefined, 101)).to.equal(true);
	});

	it('rejects a stale status response instead of returning old vehicle values', async () => {
		let callCount = 0;
		const now = 1_800_000_000_000;
		const client = new SaicApiClient(
			() => {
				callCount += 1;
				return Promise.resolve(
					new Response(
						JSON.stringify({
							code: 0,
							data: { statusTime: now / 1000 - 25 * 60 * 60, basicVehicleStatus: { lockStatus: 1 } },
						}),
					),
				);
			},
			() => now,
			() => Promise.resolve(),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected stale status to be rejected');
		} catch (error) {
			expect((error as Error).message).to.equal(
				'SAIC vehicle status timestamp is outside the trusted freshness window',
			);
		}
		expect(callCount).to.equal(1);
	});

	it('requests status with a hashed VIN and retains numeric fields while filtering unavailable values', async () => {
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
								extendedData1: 63,
								fuelLevelPrc: 0,
								mileage: -128,
								remoteClimateStatus: 2,
								vehicleAlarmStatus: 1,
								wheelTyreMonitorStatus: 2,
								newSaicStatusValue: 17,
								unexpectedValue: 5,
								lockStatus: 'locked',
							},
							gpsPosition: {
								wayPoint: {
									speed: 42,
									position: { altitude: 18, latitude: 51.5, longitude: -0.12, unavailable: -128 },
								},
							},
						},
					}),
				),
			);
		};
		const client = new SaicApiClient(fetchFunction, () => 1_700_000_000_123);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			statusTime: 1_700_000_000,
			basicVehicleStatus: {
				batteryVoltage: 142,
				extendedData1: 63,
				fuelLevelPrc: 0,
				mileage: undefined,
				remoteClimateStatus: 2,
				vehicleAlarmStatus: 1,
				wheelTyreMonitorStatus: 2,
				newSaicStatusValue: 17,
				unexpectedValue: 5,
				lockStatus: undefined,
				gpsUnavailable: undefined,
				gpsAltitude: 18,
				gpsLatitude: 51.5,
				gpsLongitude: -0.12,
				speed: 42,
			},
		});
		expect(requestUrl?.pathname).to.equal('/api.app/v1/vehicle/status');
		expect(requestUrl?.searchParams.get('vin')).to.equal(
			'c33961cdfef7f7b6a22110cfbd900a4cba50418b926077cf81334e6264bca0e5',
		);
		expect(requestUrl?.searchParams.get('vehStatusReqType')).to.equal('2');
		expect(new Headers(requestInit?.headers).get('event-id')).to.equal('0');
		expect(new Headers(requestInit?.headers).get('blade-auth')).to.equal('test-access-token');
		expect(new Headers(requestInit?.headers).get('user-agent')).to.equal(
			'Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)',
		);
	});

	it('sends the verified lock and climate command payloads', async () => {
		const vin = 'LSJWH4095RN166487';
		const expectedParams: Record<string, Array<{ paramId: number; paramValue: string }> | null> = {
			lock: null,
			unlock: [
				{ paramId: 4, paramValue: 'AA==' },
				{ paramId: 5, paramValue: 'AA==' },
				{ paramId: 6, paramValue: 'AA==' },
				{ paramId: 7, paramValue: 'Aw==' },
				{ paramId: 255, paramValue: 'AAAAAA==' },
			],
			climateStart: [
				{ paramId: 19, paramValue: 'Ag==' },
				{ paramId: 20, paramValue: 'CA==' },
				{ paramId: 255, paramValue: 'AAAAAA==' },
			],
			climateStop: [
				{ paramId: 19, paramValue: 'AA==' },
				{ paramId: 22, paramValue: 'AA==' },
				{ paramId: 255, paramValue: 'AAAAAA==' },
			],
		};
		for (const [command, rvcParams] of Object.entries(expectedParams) as Array<
			[SaicVehicleCommand, Array<{ paramId: number; paramValue: string }> | null]
		>) {
			let requestUrl: URL | undefined;
			let requestInit: RequestInit | undefined;
			const client = new SaicApiClient(
				(input, init) => {
					requestUrl = input instanceof URL ? input : new URL(input instanceof Request ? input.url : input);
					requestInit = init;
					return Promise.resolve(new Response('{"code":0,"message":"success","data":{}}'));
				},
				() => 1_700_000_000_123,
			);

			await client.sendVehicleCommand(options, 'test-access-token', vin, command);

			expect(requestUrl?.pathname).to.equal('/api.app/v1/vehicle/control');
			expect(requestInit?.method).to.equal('POST');
			const payload = JSON.stringify({
				rvcParams,
				rvcReqType: command === 'lock' ? '1' : command === 'unlock' ? '2' : '6',
				vin: createHash('sha256').update(vin, 'utf8').digest('hex'),
			});
			const headers = new Headers(requestInit?.headers);
			const encryptedBody = encryptSaicRequestBody(
				'/vehicle/control',
				options.tenantId,
				'test-access-token',
				'1700000000123',
				'application/json',
				payload,
			);
			expect(requestInit?.body).to.equal(encryptedBody);
			expect(headers.get('event-id')).to.equal('0');
			expect(headers.get('APP-VERIFICATION-STRING')).to.equal(
				createSaicRequestSignature(
					'/vehicle/control',
					options.tenantId,
					'test-access-token',
					'1700000000123',
					'application/json',
					encryptedBody,
				),
			);
		}
	});

	it('polls command event ids through SAIC pending codes until command data arrives', async () => {
		const requestEventIds: string[] = [];
		const waitDurations: number[] = [];
		let callCount = 0;
		const client = new SaicApiClient(
			(_input, init) => {
				requestEventIds.push(new Headers(init?.headers).get('event-id') ?? 'missing');
				callCount += 1;
				if (callCount === 1) {
					return Promise.resolve(
						new Response('{"code":4,"message":"pending"}', {
							headers: { 'event-id': 'control-event-1' },
						}),
					);
				}
				return Promise.resolve(new Response('{"code":0,"message":"success","data":{"rvcReqSts":"AQ=="}}'));
			},
			() => 1_700_000_000_123,
			milliseconds => {
				waitDurations.push(milliseconds);
				return Promise.resolve();
			},
		);

		await client.sendVehicleCommand(options, 'test-access-token', 'LSJWH4095RN166487', 'lock');

		expect(callCount).to.equal(2);
		expect(requestEventIds).to.deep.equal(['0', 'control-event-1']);
		expect(waitDurations).to.deep.equal([1_000]);
	});

	it('maps HA-style vehicle controls to the documented SAIC endpoints and payloads', async () => {
		const vin = 'LSJWH4095RN166487';
		const hashedVin = createHash('sha256').update(vin, 'utf8').digest('hex');
		const cases: Array<{ command: SaicVehicleCommand; path: string; body: Record<string, unknown> }> = [
			{
				command: 'openBoot',
				path: '/vehicle/control',
				body: {
					rvcReqType: '2',
					rvcParams: [
						{ paramId: 4, paramValue: 'AA==' },
						{ paramId: 5, paramValue: 'AA==' },
						{ paramId: 6, paramValue: 'AA==' },
						{ paramId: 7, paramValue: 'Ag==' },
						{ paramId: 255, paramValue: 'AAAAAA==' },
					],
					vin: hashedVin,
				},
			},
			{
				command: 'driverSeatHeatHigh',
				path: '/vehicle/control',
				body: {
					rvcReqType: '5',
					rvcParams: [
						{ paramId: 17, paramValue: 'Aw==' },
						{ paramId: 18, paramValue: 'AA==' },
						{ paramId: 255, paramValue: 'AAAAAA==' },
					],
					vin: hashedVin,
				},
			},
			{
				command: 'rearWindowHeatStart',
				path: '/vehicle/control',
				body: {
					rvcReqType: '32',
					rvcParams: [
						{ paramId: 23, paramValue: 'AQ==' },
						{ paramId: 255, paramValue: 'AAAAAA==' },
					],
					vin: hashedVin,
				},
			},
			{
				command: 'batteryHeatStart',
				path: '/vehicle/charging/ptcHeat',
				body: { ptcHeatReq: 1, vin: hashedVin },
			},
			{
				command: 'chargingStart',
				path: '/vehicle/charging/control',
				body: { chrgCtrlReq: 1, tboxV2XReq: 0, tboxEleccLckCtrlReq: 0, vin: hashedVin },
			},
			{
				command: 'chargingPortUnlock',
				path: '/vehicle/charging/control',
				body: { chrgCtrlReq: 0, tboxV2XReq: 0, tboxEleccLckCtrlReq: 2, vin: hashedVin },
			},
		];

		for (const { command, path, body } of cases) {
			let requestUrl: URL | undefined;
			let requestInit: RequestInit | undefined;
			const client = new SaicApiClient(
				(input, init) => {
					requestUrl = input instanceof URL ? input : new URL(input instanceof Request ? input.url : input);
					requestInit = init;
					return Promise.resolve(new Response('{"code":0,"data":{}}'));
				},
				() => 1_700_000_000_123,
			);

			await client.sendVehicleCommand(options, 'test-access-token', vin, command);

			expect(requestUrl?.pathname).to.equal(`/api.app/v1${path}`);
			const serializedBody =
				path === '/vehicle/control'
					? JSON.stringify({ rvcParams: body.rvcParams, rvcReqType: body.rvcReqType, vin: body.vin })
					: JSON.stringify(body);
			expect(requestInit?.body).to.equal(
				encryptSaicRequestBody(
					path,
					options.tenantId,
					'test-access-token',
					'1700000000123',
					'application/json',
					serializedBody,
				),
			);
		}
	});

	it('sends selectable seat-heating levels through the SAIC vehicle-control parameters', async () => {
		const vin = 'LSJWH4095RN166487';
		const hashedVin = createHash('sha256').update(vin, 'utf8').digest('hex');
		for (const { seat, level, driverValue, passengerValue } of [
			{ seat: 'driver' as const, level: 1, driverValue: 'AQ==', passengerValue: 'AA==' },
			{ seat: 'passenger' as const, level: 3, driverValue: 'AA==', passengerValue: 'Aw==' },
		]) {
			let requestUrl: URL | undefined;
			let requestInit: RequestInit | undefined;
			const client = new SaicApiClient(
				(input, init) => {
					requestUrl = input instanceof URL ? input : new URL(input instanceof Request ? input.url : input);
					requestInit = init;
					return Promise.resolve(new Response('{"code":0,"data":{}}'));
				},
				() => 1_700_000_000_123,
			);
			await client.sendVehicleSeatHeating(options, 'test-access-token', vin, seat, level);
			expect(requestUrl?.pathname).to.equal('/api.app/v1/vehicle/control');
			const body = {
				rvcParams: [
					{ paramId: 17, paramValue: driverValue },
					{ paramId: 18, paramValue: passengerValue },
					{ paramId: 255, paramValue: 'AAAAAA==' },
				],
				rvcReqType: '5',
				vin: hashedVin,
			};
			expect(requestInit?.body).to.equal(
				encryptSaicRequestBody(
					'/vehicle/control',
					options.tenantId,
					'test-access-token',
					'1700000000123',
					'application/json',
					JSON.stringify({ rvcReqType: body.rvcReqType, rvcParams: body.rvcParams, vin: body.vin }),
				),
			);
		}
		const client = new SaicApiClient();
		try {
			await client.sendVehicleSeatHeating(options, 'test-access-token', vin, 'driver', 4);
			expect.fail('Invalid seat-heating level should be rejected');
		} catch (error) {
			expect(error)
				.to.be.instanceOf(Error)
				.and.have.property('message', 'Seat heating level must be an integer from 0 to 3');
		}
	});

	it('classifies SAIC code 4 as a remote instruction response', async () => {
		const client = new SaicApiClient(
			() => Promise.resolve(new Response('{"code":4,"message":"Remote instruction failed"}')),
			Date.now,
			() => Promise.resolve(),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected the remote instruction response to be rejected');
		} catch (error) {
			expect(error).to.be.instanceOf(SaicRemoteInstructionError);
			expect((error as Error).message).to.equal('Remote instruction failed');
		}
	});

	it('maps writable settings to documented SAIC payloads', async () => {
		const vin = 'LSJWH4095RN166487';
		const hashedVin = createHash('sha256').update(vin, 'utf8').digest('hex');
		const expectedBatteryStart = new Date(1_700_000_000_000);
		expectedBatteryStart.setHours(23, 5, 0, 0);
		if (expectedBatteryStart.getTime() < 1_700_000_000_000) {
			expectedBatteryStart.setDate(expectedBatteryStart.getDate() + 1);
		}
		const cases: Array<{
			setting: SaicVehicleSetting;
			path: string;
			body: Record<string, unknown>;
			polling: boolean;
		}> = [
			{
				setting: { type: 'climateTemperature', value: 10 },
				path: '/vehicle/control',
				body: {
					rvcParams: [
						{ paramId: 19, paramValue: 'Ag==' },
						{ paramId: 20, paramValue: 'Cg==' },
						{ paramId: 255, paramValue: 'AAAAAA==' },
					],
					rvcReqType: '6',
					vin: hashedVin,
				},
				polling: true,
			},
			{
				setting: { type: 'chargingSettings', targetSoc: 5, currentLimit: 4 },
				path: '/vehicle/charging/setting',
				body: { onBdChrgTrgtSOCReq: 5, altngChrgCrntReq: 4, tboxV2XSpSOCReq: 0, vin: hashedVin },
				polling: true,
			},
			{
				setting: { type: 'chargingSchedule', start: '22:30', end: '06:15', mode: 1 },
				path: '/vehicle/charging/reservation',
				body: {
					rsvanStHour: 22,
					rsvanStMintue: 30,
					rsvanSpHour: 6,
					rsvanSpMintue: 15,
					tboxAdpPubChrgSttnReq: 1,
					tboxReserCtrlReq: 1,
					vin: hashedVin,
				},
				polling: true,
			},
			{
				setting: { type: 'batteryHeatingSchedule', enabled: true, start: '23:05' },
				path: '/charging/batteryHeating',
				body: { startTime: expectedBatteryStart.getTime(), status: 1, vin: hashedVin },
				polling: false,
			},
		];

		for (const { setting, path, body, polling } of cases) {
			let requestUrl: URL | undefined;
			let requestInit: RequestInit | undefined;
			const client = new SaicApiClient(
				(input, init) => {
					requestUrl = input instanceof URL ? input : new URL(input instanceof Request ? input.url : input);
					requestInit = init;
					return Promise.resolve(new Response(polling ? '{"code":0,"data":{}}' : ''));
				},
				() => 1_700_000_000_000,
			);
			await client.sendVehicleSetting(options, 'test-access-token', vin, setting);
			expect(requestUrl?.pathname).to.equal(`/api.app/v1${path}`);
			expect(requestInit?.body, `${setting.type}: ${JSON.stringify(body)}`).to.equal(
				encryptSaicRequestBody(
					path,
					options.tenantId,
					'test-access-token',
					'1700000000000',
					'application/json',
					JSON.stringify(body),
				),
			);
			expect(new Headers(requestInit?.headers).has('event-id')).to.equal(polling);
		}
	});

	it('rejects invalid settings before making a request', async () => {
		let requestMade = false;
		const client = new SaicApiClient(() => {
			requestMade = true;
			return Promise.resolve(new Response('{"code":0,"data":{}}'));
		});
		for (const setting of [
			{ type: 'climateTemperature', value: -1 },
			{ type: 'chargingSettings', targetSoc: 0, currentLimit: 4 },
			{ type: 'chargingSchedule', start: '25:00', end: '06:00', mode: 1 },
			{ type: 'batteryHeatingSchedule', enabled: true, start: 'noon' },
		] as SaicVehicleSetting[]) {
			try {
				await client.sendVehicleSetting(options, 'test-access-token', 'LSJWH4095RN166487', setting);
				expect.fail('Expected invalid setting to be rejected');
			} catch (error) {
				expect((error as Error).message).not.to.equal('Expected invalid setting to be rejected');
			}
		}
		expect(requestMade).to.equal(false);
	});

	it('signs each event poll with its own timestamp and event id', async () => {
		let currentTime = 1_700_000_000_123;
		const requests: { timestamp: string | null; signature: string | null; eventId: string | null }[] = [];
		let callCount = 0;
		const client = new SaicApiClient(
			(_input, init) => {
				const headers = new Headers(init?.headers);
				requests.push({
					timestamp: headers.get('APP-SEND-DATE'),
					signature: headers.get('APP-VERIFICATION-STRING'),
					eventId: headers.get('event-id'),
				});
				callCount += 1;
				return Promise.resolve(
					callCount === 1
						? new Response('{"code":0}', { headers: { 'event-id': 'event-next' } })
						: new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":0}}}'),
				);
			},
			() => currentTime,
			milliseconds => {
				currentTime += milliseconds;
				return Promise.resolve();
			},
		);

		await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');

		const signedPath = `/vehicle/status?vin=${createHash('sha256').update('LSJWH4095RN166487').digest('hex')}&vehStatusReqType=2`;
		expect(requests).to.have.length(2);
		expect(requests.map(request => request.timestamp)).to.deep.equal(['1700000000123', '1700000003123']);
		expect(requests.map(request => request.eventId)).to.deep.equal(['0', 'event-next']);
		for (const request of requests) {
			expect(request.signature).to.equal(
				createSaicRequestSignature(
					signedPath,
					options.tenantId,
					'test-access-token',
					request.timestamp!,
					'application/json',
					'',
				),
			);
		}
	});

	it('logs response metadata and field names without logging status values', async () => {
		const debugMessages: string[] = [];
		const client = new SaicApiClient(
			() =>
				Promise.resolve(
					new Response(
						'{"code":0,"message":"success","data":{"basicVehicleStatus":{"batteryVoltage":142,"lockStatus":1}}}',
					),
				),
			Date.now,
			undefined,
			message => debugMessages.push(message),
		);

		await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');

		expect(debugMessages.some(message => message.includes('SAIC code 0'))).to.equal(true);
		expect(debugMessages.some(message => message.includes('message: success'))).to.equal(true);
		expect(debugMessages.some(message => message.includes('timeout 5000ms'))).to.equal(true);
		expect(debugMessages.some(message => message.includes('batteryVoltage, lockStatus'))).to.equal(true);
		expect(debugMessages.join('\n')).not.to.contain('142');
	});

	it('uses injected timer functions for HTTP request timeouts', async () => {
		let timeoutCreated = false;
		let timeoutCleared = false;
		const client = new SaicApiClient(
			() => Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}')),
			Date.now,
			undefined,
			undefined,
			undefined,
			{
				setTimeout: (callback, milliseconds) => {
					timeoutCreated = true;
					const timer = setTimeout(callback, milliseconds);
					return () => {
						timeoutCleared = true;
						clearTimeout(timer);
					};
				},
			},
		);

		await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');

		expect(timeoutCreated).to.equal(true);
		expect(timeoutCleared).to.equal(true);
	});

	it('rejects status replies without basicVehicleStatus', async () => {
		const client = new SaicApiClient(
			() => Promise.resolve(new Response('{"code":0,"data":{}}')),
			Date.now,
			() => Promise.resolve(),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected missing basicVehicleStatus to be rejected');
		} catch (error) {
			expect((error as Error).message).to.contain(
				'SAIC vehicle status response did not contain basic status data (code: 0, response keys: code, data, data type: object, data keys: none)',
			);
		}
	});

	it('rejects status data with no recognized usable fields', async () => {
		const client = new SaicApiClient(() =>
			Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"unexpected":-128}}}')),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected an unusable status response to be rejected');
		} catch (error) {
			expect((error as Error).message).to.equal(
				'SAIC vehicle status response contained no usable vehicle fields',
			);
		}
	});

	it('reports the JSON type when SAIC status data is null', async () => {
		const client = new SaicApiClient(
			() => Promise.resolve(new Response('{"code":0,"message":"success","data":null}')),
			Date.now,
			() => Promise.resolve(),
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
		const client = new SaicApiClient(
			(_input, init) => {
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
			},
			Date.now,
			() => Promise.resolve(),
		);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(requestEventIds).to.deep.equal(['0', 'next-event-123']);
	});

	it('does not retry a malformed live reply without an event id', async () => {
		const requestEventIds: string[] = [];
		const client = new SaicApiClient(
			(_input, init) => {
				requestEventIds.push(new Headers(init?.headers).get('event-id') ?? 'missing');
				return Promise.resolve(new Response('{"code":0,"message":"success"}'));
			},
			Date.now,
			() => Promise.resolve(),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected an empty initial response without event id to be rejected');
		} catch (error) {
			expect((error as Error).message).to.contain('did not contain basic status data');
		}
		expect(requestEventIds).to.deep.equal(['0']);
	});

	it('retries live timeout replies using the next event id', async function () {
		this.timeout(5_000);
		const requestEventIds: string[] = [];
		let callCount = 0;
		const client = new SaicApiClient(
			(_input, init) => {
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
			},
			Date.now,
			() => Promise.resolve(),
		);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(requestEventIds).to.deep.equal(['0', 'event-123', 'event-456']);
	});

	it('retries an initial live timeout reply when SAIC provides an event id', async () => {
		const requestEventIds: string[] = [];
		const client = new SaicApiClient(
			(_input, init) => {
				requestEventIds.push(new Headers(init?.headers).get('event-id') ?? 'missing');
				if (requestEventIds.length === 1) {
					return Promise.resolve(
						new Response('{"code":1,"message":"The request timed out, please try again later."}', {
							headers: { 'event-id': 'event-123' },
						}),
					);
				}
				return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
			},
			Date.now,
			() => Promise.resolve(),
		);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(requestEventIds).to.deep.equal(['0', 'event-123']);
	});

	it('does not retry an initial live timeout without an event id', async () => {
		let callCount = 0;
		const client = new SaicApiClient(
			() => {
				callCount += 1;
				return Promise.resolve(
					new Response('{"code":1,"message":"The request timed out, please try again later."}'),
				);
			},
			Date.now,
			() => Promise.resolve(),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected an initial timeout without event id to be rejected');
		} catch (error) {
			expect((error as Error).message).to.contain('timed out');
		}
		expect(callCount).to.equal(1);
	});

	it('does not event-poll definitive SAIC codes or an initial nonzero response without an event id', async () => {
		for (const code of [2, 3, 7, 12808]) {
			let callCount = 0;
			const waitDurations: number[] = [];
			const client = new SaicApiClient(
				() => {
					callCount += 1;
					return Promise.resolve(new Response(`{"code":${code},"message":"rejected"}`));
				},
				Date.now,
				milliseconds => {
					waitDurations.push(milliseconds);
					return Promise.resolve();
				},
			);

			try {
				await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
				expect.fail(`Expected SAIC code ${code} to be rejected`);
			} catch (error) {
				expect((error as Error).message).to.equal('rejected');
			}
			expect(callCount).to.equal(1);
			expect(waitDurations).to.deep.equal([]);
		}
	});

	it('continues polling an event after SAIC code 4 while the event is pending', async () => {
		let callCount = 0;
		const eventIds: string[] = [];
		const waitDurations: number[] = [];
		const client = new SaicApiClient(
			(_input, init) => {
				callCount += 1;
				eventIds.push(new Headers(init?.headers).get('event-id') ?? 'none');
				if (callCount === 1) {
					return Promise.resolve(
						new Response('{"code":4,"message":"The vehicle is processing the request."}', {
							headers: { 'event-id': '573135718' },
						}),
					);
				}
				return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
			},
			Date.now,
			milliseconds => {
				waitDurations.push(milliseconds);
				return Promise.resolve();
			},
		);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(callCount).to.equal(2);
		expect(eventIds).to.deep.equal(['0', '573135718']);
		expect(waitDurations).to.deep.equal([3_000]);
	});

	it('classifies SAIC code 4 without a pending event as a remote instruction failure', async () => {
		let callCount = 0;
		const client = new SaicApiClient(
			() => {
				callCount += 1;
				return Promise.resolve(new Response('{"code":4,"message":"The remote control instruction failed."}'));
			},
			Date.now,
			() => Promise.resolve(),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected SAIC remote instruction failure');
		} catch (error) {
			expect(error).to.be.instanceOf(SaicRemoteInstructionError);
			expect((error as Error).message).to.equal('The remote control instruction failed.');
		}
		expect(callCount).to.equal(1);
	});

	it('does not treat SAIC authorization codes as pending event responses', async () => {
		for (const code of [401, 403]) {
			let callCount = 0;
			const client = new SaicApiClient(
				() => {
					callCount += 1;
					return Promise.resolve(
						new Response(`{"code":${code},"message":"authorization failed"}`, {
							headers: { 'event-id': 'next-event' },
						}),
					);
				},
				Date.now,
				() => Promise.resolve(),
			);

			try {
				await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
				expect.fail('Expected SAIC authorization failure');
			} catch (error) {
				expect(error).to.have.property('status', code);
			}
			expect(callCount).to.equal(1);
		}
	});

	it('surfaces HTTP authorization failures without retrying', async () => {
		for (const status of [401, 403]) {
			let callCount = 0;
			const client = new SaicApiClient(
				() => {
					callCount += 1;
					return Promise.resolve(new Response('unauthorized', { status }));
				},
				Date.now,
				() => Promise.resolve(),
			);

			try {
				await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
				expect.fail('Expected HTTP authorization failure');
			} catch (error) {
				expect(error).to.have.property('status', status);
			}
			expect(callCount).to.equal(1);
		}
	});

	it('aborts an in-flight status request without retrying', async () => {
		const controller = new AbortController();
		let callCount = 0;
		const client = new SaicApiClient((_, init) => {
			callCount += 1;
			return new Promise((_, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true });
			});
		});
		const request = client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487', controller.signal);
		controller.abort(new DOMException('test abort', 'AbortError'));

		try {
			await request;
			expect.fail('Expected request cancellation');
		} catch (error) {
			expect((error as Error).name).to.equal('AbortError');
		}
		expect(callCount).to.equal(1);
	});

	it('aborts the event-id wait without starting another request', async () => {
		const controller = new AbortController();
		let callCount = 0;
		let enterWait: (() => void) | undefined;
		const waitStarted = new Promise<void>(resolve => {
			enterWait = resolve;
		});
		const client = new SaicApiClient(
			() => {
				callCount += 1;
				return Promise.resolve(new Response('{"code":0}', { headers: { 'event-id': 'next-event' } }));
			},
			Date.now,
			(_milliseconds, signal) =>
				new Promise((_, reject) => {
					enterWait?.();
					if (signal?.aborted) {
						reject(signal.reason instanceof Error ? signal.reason : new Error('Wait aborted'));
						return;
					}
					signal?.addEventListener('abort', () => reject(new Error('Wait aborted')), { once: true });
				}),
		);
		const request = client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487', controller.signal);
		await waitStarted;
		controller.abort(new DOMException('test abort', 'AbortError'));

		try {
			await request;
			expect.fail('Expected event-id wait cancellation');
		} catch (error) {
			expect((error as Error).name).to.equal('AbortError');
		}
		expect(callCount).to.equal(1);
	});

	it('does not event-poll SAIC codes 2, 3, or 7 after receiving an event id', async () => {
		for (const code of [2, 3, 7]) {
			let callCount = 0;
			const waitDurations: number[] = [];
			const client = new SaicApiClient(
				(_input, init) => {
					callCount += 1;
					if (new Headers(init?.headers).get('event-id') === '0') {
						return Promise.resolve(
							new Response('{"code":0,"message":"success"}', {
								headers: { 'event-id': 'event-123' },
							}),
						);
					}
					return Promise.resolve(
						new Response(`{"code":${code},"message":"rejected"}`, {
							headers: { 'event-id': 'event-456' },
						}),
					);
				},
				Date.now,
				milliseconds => {
					waitDurations.push(milliseconds);
					return Promise.resolve();
				},
			);

			try {
				await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
				expect.fail(`Expected SAIC code ${code} to be rejected`);
			} catch (error) {
				expect((error as Error).message).to.equal('rejected');
			}
			expect(callCount).to.equal(2);
			expect(waitDurations).to.deep.equal([3_000]);
		}
	});

	it('continues polling the current event id after SAIC code 12808', async () => {
		const requestEventIds: string[] = [];
		const waitDurations: number[] = [];
		let callCount = 0;
		const client = new SaicApiClient(
			(_input, init) => {
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
						new Response('{"code":12808,"message":"The request timed out, please try again later."}'),
					);
				}
				return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
			},
			Date.now,
			milliseconds => {
				waitDurations.push(milliseconds);
				return Promise.resolve();
			},
		);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(requestEventIds).to.deep.equal(['0', 'event-123', 'event-123']);
		expect(waitDurations).to.deep.equal([3_000, 3_000]);
	});

	it('keeps the full timeout and starts an outer retry after the event-id deadline', async () => {
		let currentTime = 0;
		let requestCount = 0;
		const requestEventIds: string[] = [];
		const waitDurations: number[] = [];
		const debugMessages: string[] = [];
		const client = new SaicApiClient(
			(_input, init) => {
				requestCount += 1;
				const eventId = new Headers(init?.headers).get('event-id') ?? 'missing';
				requestEventIds.push(eventId);
				if (requestCount === 1) {
					return Promise.resolve(
						new Response('{"code":0,"message":"success"}', {
							headers: { 'event-id': 'event-123' },
						}),
					);
				}
				if (eventId === '0') {
					return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
				}
				expect(eventId).to.equal('event-123');
				return Promise.resolve(
					new Response('{"code":12808,"message":"The request timed out, please try again later."}'),
				);
			},
			() => currentTime,
			milliseconds => {
				waitDurations.push(milliseconds);
				currentTime += milliseconds;
				return Promise.resolve();
			},
			message => debugMessages.push(message),
			() => currentTime,
		);

		await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');

		expect(requestCount).to.equal(11);
		expect(requestEventIds[0]).to.equal('0');
		expect(requestEventIds[9]).to.equal('event-123');
		expect(requestEventIds[10]).to.equal('0');
		expect(waitDurations).to.deep.equal([...Array(10).fill(3_000), 15_000]);
		expect(debugMessages).to.include(
			'GET /vehicle/status for LSJWH4095RN166487, request 10, timeout 3000ms, event-id event-123',
		);
	});

	it('retries timed-out live HTTP waits until a response is received', async () => {
		let callCount = 0;
		const waitDurations: number[] = [];
		const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
		const client = new SaicApiClient(
			() => {
				callCount += 1;
				if (callCount === 1) {
					return Promise.reject(timeout);
				}
				return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
			},
			Date.now,
			milliseconds => {
				waitDurations.push(milliseconds);
				return Promise.resolve();
			},
		);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(callCount).to.equal(2);
		expect(waitDurations).to.deep.equal([15_000]);
	});

	it('retries live transport failures like other coordinator errors', async () => {
		let callCount = 0;
		const waitDurations: number[] = [];
		const client = new SaicApiClient(
			() => {
				callCount += 1;
				if (callCount === 1) {
					return Promise.reject(new Error('socket hang up'));
				}
				return Promise.resolve(new Response('{"code":0,"data":{"basicVehicleStatus":{"lockStatus":1}}}'));
			},
			Date.now,
			milliseconds => {
				waitDurations.push(milliseconds);
				return Promise.resolve();
			},
		);

		expect(await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
		});
		expect(callCount).to.equal(2);
		expect(waitDurations).to.deep.equal([15_000]);
	});

	it('requests SAIC cached status without an event id', async () => {
		let requestUrl: URL | undefined;
		let requestInit: RequestInit | undefined;
		const client = new SaicApiClient(
			(input, init) => {
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
			},
			() => 1_700_000_000_000,
		);

		expect(await client.getCachedVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487')).to.deep.equal({
			basicVehicleStatus: { lockStatus: 1 },
			statusTime: 1_700_000_000,
			onlineStatus: 1,
		});
		expect(requestUrl?.pathname).to.equal('/api.app/v1/vehicle/status/cache');
		expect(requestUrl?.searchParams.get('vehStatusReqType')).to.equal('2');
		expect(new Headers(requestInit?.headers).has('event-id')).to.equal(false);
		expect(new Headers(requestInit?.headers).get('user-agent')).to.equal(
			'Europe/2.1.0 (iPad; iOS 18.5; Scale/2.00)',
		);
	});

	it('preserves network failure details for status requests', async () => {
		let callCount = 0;
		const client = new SaicApiClient(
			() => {
				callCount += 1;
				return Promise.reject(new Error('getaddrinfo ENOTFOUND gateway.example'));
			},
			Date.now,
			() => Promise.resolve(),
		);

		try {
			await client.getVehicleStatus(options, 'test-access-token', 'LSJWH4095RN166487');
			expect.fail('Expected network failure to be rejected');
		} catch (error) {
			expect((error as Error).message).to.contain('getaddrinfo ENOTFOUND gateway.example');
		}
		expect(callCount).to.equal(5);
	});
});

describe('SaicApiClient charging status', () => {
	const options = {
		baseUrl: 'https://gateway-mg-eu.soimt.com/api.app/v1/',
		regionCode: 'eu',
		tenantId: '459771',
		accountType: 'email' as const,
		accountIdentifier: 'driver@example.com',
		password: 'test-password',
	};

	it('requests charging data with a hashed VIN and filters unavailable values', async () => {
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
							chrgMgmtData: { bmsChrgSts: 1, ccuEleccLckCtrlDspCmd: 1, missing: -128 },
							rvsChargeStatus: { chargingGunState: 2, chargingPileID: 'pile-7' },
						},
					}),
				),
			);
		};
		const client = new SaicApiClient(fetchFunction, () => 1_700_000_000_123);

		expect(await client.getVehicleChargingStatus(options, 'test-access-token', 'LSJWH4099NS012345')).to.deep.equal({
			chrgMgmtData: { bmsChrgSts: 1, ccuEleccLckCtrlDspCmd: 1, missing: undefined },
			rvsChargeStatus: { chargingGunState: 2, chargingPileID: 'pile-7' },
		});
		expect(requestUrl?.pathname).to.equal('/api.app/v1/vehicle/charging/mgmtData');
		expect(requestUrl?.searchParams.get('vin')).to.equal(
			createHash('sha256').update('LSJWH4099NS012345').digest('hex'),
		);
		expect(requestInit?.method).to.equal('GET');
		expect(new Headers(requestInit?.headers).get('event-id')).to.equal('0');
		expect(new Headers(requestInit?.headers).get('blade-auth')).to.equal('test-access-token');
	});
});
