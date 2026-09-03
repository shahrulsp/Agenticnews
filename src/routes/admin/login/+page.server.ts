import { setAdminSession, verifyPassword } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return {};
};

export const actions: Actions = {
	default: async ({ cookies, request }) => {
		const formData = await request.formData();
		const password = formData.get('password');

		if (typeof password !== 'string' || password.trim().length === 0) {
			return fail(400, { error: 'Enter the admin password.' });
		}

		const isValid = await verifyPassword(password);

		if (!isValid) {
			return fail(401, { error: 'That password did not match.' });
		}

		setAdminSession(cookies);

		throw redirect(303, '/admin');
	}
};
