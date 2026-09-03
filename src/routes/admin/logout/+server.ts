import { clearAdminSession } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	clearAdminSession(cookies);
	throw redirect(303, '/admin/login');
};
