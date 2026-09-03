import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
	sub: 'admin';
	exp: number;
};

function requireSecret(secret: string | undefined): string {
	if (!secret) {
		throw new Error('ADMIN_COOKIE_SECRET is required to manage admin sessions');
	}

	return secret;
}

function encodePayload(payload: AdminSessionPayload): string {
	return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(encoded: string): AdminSessionPayload | null {
	try {
		const value = JSON.parse(
			Buffer.from(encoded, 'base64url').toString('utf8')
		) as AdminSessionPayload;

		if (value.sub !== 'admin' || typeof value.exp !== 'number') {
			return null;
		}

		return value;
	} catch {
		return null;
	}
}

function signPayload(encodedPayload: string, secret: string): string {
	return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function signaturesMatch(actual: string, expected: string): boolean {
	const actualBuffer = Buffer.from(actual);
	const expectedBuffer = Buffer.from(expected);

	if (actualBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function verifyPassword(
	password: string,
	passwordHash: string | undefined = env.ADMIN_PASSWORD_HASH
): Promise<boolean> {
	if (!passwordHash) {
		return false;
	}

	return bcrypt.compare(password, passwordHash);
}

export function createAdminSessionToken(
	secret: string | undefined = env.ADMIN_COOKIE_SECRET,
	now = Date.now()
): string {
	const resolvedSecret = requireSecret(secret);
	const payload: AdminSessionPayload = {
		sub: 'admin',
		exp: Math.floor(now / 1000) + ADMIN_SESSION_TTL_SECONDS
	};
	const encodedPayload = encodePayload(payload);
	const signature = signPayload(encodedPayload, resolvedSecret);

	return `${encodedPayload}.${signature}`;
}

export function validateAdminSessionToken(
	token: string | undefined,
	secret: string | undefined = env.ADMIN_COOKIE_SECRET,
	now = Date.now()
): AdminSessionPayload | null {
	if (!token) {
		return null;
	}

	const resolvedSecret = requireSecret(secret);
	const [encodedPayload, signature, extraPart] = token.split('.');

	if (!encodedPayload || !signature || extraPart) {
		return null;
	}

	const expectedSignature = signPayload(encodedPayload, resolvedSecret);
	if (!signaturesMatch(signature, expectedSignature)) {
		return null;
	}

	const payload = decodePayload(encodedPayload);
	if (!payload) {
		return null;
	}

	if (payload.exp <= Math.floor(now / 1000)) {
		return null;
	}

	return payload;
}

export function setAdminSession(
	cookies: Cookies,
	secret: string | undefined = env.ADMIN_COOKIE_SECRET,
	now = Date.now()
): string {
	const token = createAdminSessionToken(secret, now);

	cookies.set(ADMIN_SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: env.NODE_ENV === 'production',
		maxAge: ADMIN_SESSION_TTL_SECONDS
	});

	return token;
}

export function clearAdminSession(cookies: Cookies): void {
	cookies.delete(ADMIN_SESSION_COOKIE, { path: '/' });
}

export function isAuthenticated(
	cookies: Cookies,
	secret: string | undefined = env.ADMIN_COOKIE_SECRET,
	now = Date.now()
): boolean {
	return validateAdminSessionToken(cookies.get(ADMIN_SESSION_COOKIE), secret, now) !== null;
}
