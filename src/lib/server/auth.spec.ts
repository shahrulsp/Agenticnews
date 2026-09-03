import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import {
	ADMIN_SESSION_TTL_SECONDS,
	createAdminSessionToken,
	validateAdminSessionToken,
	verifyPassword
} from './auth';

const SECRET = 'test-admin-cookie-secret';
const NOW = Date.UTC(2026, 8, 2, 16, 0, 0);

describe('admin auth helpers', () => {
	it('validates a freshly issued session token', () => {
		const token = createAdminSessionToken(SECRET, NOW);

		expect(validateAdminSessionToken(token, SECRET, NOW)).toEqual({
			sub: 'admin',
			exp: Math.floor(NOW / 1000) + ADMIN_SESSION_TTL_SECONDS
		});
	});

	it('rejects a tampered session token', () => {
		const token = createAdminSessionToken(SECRET, NOW);
		const [payload, signature] = token.split('.');
		const tamperedToken = `${payload}.x${signature.slice(1)}`;

		expect(validateAdminSessionToken(tamperedToken, SECRET, NOW)).toBeNull();
	});

	it('rejects an expired session token', () => {
		const token = createAdminSessionToken(SECRET, NOW);
		const later = NOW + (ADMIN_SESSION_TTL_SECONDS + 1) * 1000;

		expect(validateAdminSessionToken(token, SECRET, later)).toBeNull();
	});

	it('verifies a bcrypt password hash', async () => {
		const passwordHash = await bcrypt.hash('correct horse battery staple', 10);

		await expect(verifyPassword('correct horse battery staple', passwordHash)).resolves.toBe(true);
		await expect(verifyPassword('wrong password', passwordHash)).resolves.toBe(false);
	});
});
