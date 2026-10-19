import { createCipheriv, createDecipheriv, createHash, createHmac } from 'node:crypto';

function md5Hex(value: string): string {
	return createHash('md5').update(value, 'utf8').digest('hex');
}

/**
 * Create the SHA-1 hexadecimal password digest expected by OAuth.
 *
 * @param password Plaintext account password.
 */
export function sha1PasswordDigest(password: string): string {
	return createHash('sha1').update(password, 'utf8').digest('hex');
}

/**
 * Encrypt a request body using the SAIC application AES-CBC scheme.
 *
 * @param requestPath API path included in key derivation.
 * @param tenantId Tenant identifier.
 * @param userToken Current access token, or an empty string before login.
 * @param timestamp Request timestamp in milliseconds.
 * @param contentType Normalized request content type.
 * @param requestBody Plaintext request body.
 */
export function encryptSaicRequestBody(
	requestPath: string,
	tenantId: string,
	userToken: string,
	timestamp: string,
	contentType: string,
	requestBody: string,
): string {
	if (!requestBody) {
		return '';
	}

	const origin = `${requestPath}${tenantId}${userToken}app`;
	const key = md5Hex(`${md5Hex(origin)}${timestamp}1${contentType}`);
	const iv = md5Hex(timestamp);
	const cipher = createCipheriv('aes-128-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
	return Buffer.concat([cipher.update(requestBody, 'utf8'), cipher.final()]).toString('hex');
}

/**
 * Create the HMAC-SHA256 signature for an encrypted SAIC API request.
 *
 * @param requestPath API path included in the signature.
 * @param tenantId Tenant identifier.
 * @param userToken Current access token, or an empty string before login.
 * @param timestamp Request timestamp in milliseconds.
 * @param contentType Normalized request content type.
 * @param encryptedBody Encrypted request body as hexadecimal text.
 */
export function createSaicRequestSignature(
	requestPath: string,
	tenantId: string,
	userToken: string,
	timestamp: string,
	contentType: string,
	encryptedBody: string,
): string {
	const origin = `${requestPath}${tenantId}${userToken}app`;
	const key = md5Hex(`${md5Hex(origin)}${timestamp}1${contentType}`);
	const signingKey = md5Hex(`${key}${timestamp}`);
	const signedContent = `${requestPath}${tenantId}${userToken}app${timestamp}1${contentType}${encryptedBody}`;
	return createHmac('sha256', signingKey).update(signedContent, 'utf8').digest('hex');
}

/**
 * Decrypt an AES-CBC response body returned by the SAIC API.
 *
 * @param responseBody Encrypted response body as hexadecimal text.
 * @param timestamp Response timestamp in milliseconds.
 * @param contentType Normalized response content type.
 */
export function decryptSaicResponseBody(responseBody: string, timestamp: string, contentType: string): string {
	if (!responseBody) {
		return '';
	}

	const key = md5Hex(`${timestamp}1${contentType}`);
	const iv = md5Hex(timestamp);
	const decipher = createDecipheriv('aes-128-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
	return Buffer.concat([decipher.update(Buffer.from(responseBody.trim(), 'hex')), decipher.final()]).toString('utf8');
}
