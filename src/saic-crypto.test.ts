import { expect } from 'chai';
import { createSaicRequestSignature, encryptSaicRequestBody, sha1PasswordDigest } from './saic-crypto';

describe('SAIC request cryptography', () => {
	const requestPath = '/oauth/token';
	const tenantId = '459771';
	const userToken = '';
	const timestamp = '1700000000000';
	const contentType = 'application/x-www-form-urlencoded';
	const requestBody = 'grant_type=password&username=driver%40example.com&password=abc';

	it('creates the expected encrypted request body and signature', () => {
		const encryptedBody = encryptSaicRequestBody(
			requestPath,
			tenantId,
			userToken,
			timestamp,
			contentType,
			requestBody,
		);

		expect(encryptedBody).to.equal(
			'2d5719119cfea6563e52ebffeb600a2df2ad6da18f51df9599f7e645675983404705d77294d7a088f9a08fcabc25914dedf771439e3de1de31c75f03c07af7ac',
		);
		expect(
			createSaicRequestSignature(requestPath, tenantId, userToken, timestamp, contentType, encryptedBody),
		).to.equal('19617da19bf0f1159d75e57acde0ccc76a84665e9fb5e3cabd1149ce9cd62963');
	});

	it('returns an empty encrypted body for bodyless requests', () => {
		expect(encryptSaicRequestBody(requestPath, tenantId, userToken, timestamp, contentType, '')).to.equal('');
	});

	it('hashes the password for OAuth login without exposing the source value', () => {
		expect(sha1PasswordDigest('test-password')).to.equal('789cbe0407840b1c2041cb33452ff60f19bf58cc');
	});
});
