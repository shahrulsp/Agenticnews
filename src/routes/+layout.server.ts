import { env } from '$env/dynamic/public';
import type { LayoutServerLoad } from './$types';

const VALID_LOCALES = new Set(['ms', 'en']);

export const load: LayoutServerLoad = ({ url }) => {
	const requestedLocale = url.searchParams.get('lang');
	const defaultLocale =
		typeof env.PUBLIC_DEFAULT_LOCALE === 'string' && VALID_LOCALES.has(env.PUBLIC_DEFAULT_LOCALE)
			? (env.PUBLIC_DEFAULT_LOCALE as 'ms' | 'en')
			: 'ms';

	return {
		locale:
			requestedLocale && VALID_LOCALES.has(requestedLocale)
				? (requestedLocale as 'ms' | 'en')
				: defaultLocale
	};
};
