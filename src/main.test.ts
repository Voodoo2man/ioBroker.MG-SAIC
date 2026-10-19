import { expect } from 'chai';
import { validateConfig } from './config';
import { isIndiaRegion, resolveSaicRegion } from './regions';

describe('validateConfig', () => {
	const validEmailConfig = {
		region: 'EU',
		accountType: 'email',
		accountIdentifier: 'driver@example.com',
		password: 'secret',
	};

	it('accepts a complete email account configuration', () => {
		expect(validateConfig(validEmailConfig)).to.deep.equal([]);
	});

	it('requires a country calling code for phone accounts', () => {
		expect(validateConfig({ ...validEmailConfig, accountType: 'phone', phoneCountryCode: '' })).to.include(
			'Phone country calling code is required',
		);
	});

	it('reports missing required account fields', () => {
		expect(validateConfig({})).to.deep.equal([
			'Region/backend code is required',
			'Login type must be email or phone',
			'Email address or phone number is required',
			'Password is required',
		]);
	});

	it('resolves supported global regions to their API routes', () => {
		expect(resolveSaicRegion('EU')).to.deep.equal({
			baseUrl: 'https://gateway-mg-eu.soimt.com/api.app/v1/',
			regionCode: 'eu',
			tenantId: '459771',
		});
		expect(resolveSaicRegion('Rest of World')?.regionCode).to.equal('eu');
		expect(resolveSaicRegion('India')).to.equal(undefined);
	});

	it('rejects India TAP and unknown regions before cloud login', () => {
		expect(validateConfig({ ...validEmailConfig, region: 'India' })).to.include(
			'India TAP connectivity is not implemented yet',
		);
		expect(validateConfig({ ...validEmailConfig, region: 'Unknown' })).to.include('Unsupported SAIC region');
		expect(isIndiaRegion(' india ')).to.equal(true);
	});
});
