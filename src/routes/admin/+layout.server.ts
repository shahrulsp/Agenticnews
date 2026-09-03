import { isAuthenticated } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ cookies, url }) => {
	const authenticated = isAuthenticated(cookies);
	const isLoginRoute = url.pathname === '/admin/login';

	if (!authenticated && !isLoginRoute) {
		throw redirect(303, '/admin/login');
	}

	if (authenticated && isLoginRoute) {
		throw redirect(303, '/admin');
	}

	return {
		authenticated
	};
};
