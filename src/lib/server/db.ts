import { env } from '$env/dynamic/private';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type DatabaseClient = NeonQueryFunction<false, false>;

let databaseClient: DatabaseClient | null = null;

export function hasDatabaseConfig(
	databaseUrl: string | undefined = env.NEON_DATABASE_URL
): boolean {
	return typeof databaseUrl === 'string' && databaseUrl.trim().length > 0;
}

export function createDatabaseClient(databaseUrl: string): DatabaseClient {
	if (!databaseUrl) {
		throw new Error('NEON_DATABASE_URL is required to connect to Neon');
	}

	return neon(databaseUrl);
}

export function getDatabaseClient(
	databaseUrl: string | undefined = env.NEON_DATABASE_URL
): DatabaseClient {
	if (!databaseUrl) {
		throw new Error('NEON_DATABASE_URL is required to connect to Neon');
	}

	if (!databaseClient) {
		databaseClient = createDatabaseClient(databaseUrl);
	}

	return databaseClient;
}
