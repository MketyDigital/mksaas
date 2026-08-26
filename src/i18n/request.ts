import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, type Locale, LOCALE_COOKIE_NAME, locales } from './config';
import { landingMessages } from './landing-messages';

async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME);
  if (localeCookie && locales.includes(localeCookie.value as Locale)) return localeCookie.value as Locale;

  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language');
  if (acceptLanguage) {
    const browserLocales = acceptLanguage
      .split(',')
      .map((part) => {
        const [locale, quality = 'q=1'] = part.trim().split(';');
        return { locale: locale.split('-')[0].toLowerCase(), quality: parseFloat(quality.replace('q=', '')) };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const { locale } of browserLocales) {
      if (locales.includes(locale as Locale)) return locale as Locale;
    }
  }

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  const messages = (await import(`./messages/${locale}.json`)).default;
  const navMessages = messages.nav as Record<string, string>;

  return {
    locale,
    messages: {
      ...messages,
      landing: landingMessages,
      nav: {
        ...navMessages,
        myProfile: navMessages.myProfile ?? (locale === 'es' ? 'Mi perfil' : 'My Profile'),
        integrations: navMessages.integrations ?? (locale === 'es' ? 'Integraciones' : 'Integrations'),
      },
    },
  };
});
