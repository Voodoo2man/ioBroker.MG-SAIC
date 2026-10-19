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
