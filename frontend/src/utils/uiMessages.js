export const UI_MESSAGES = Object.freeze({
  loading: Object.freeze({
    default: 'Just a moment while we prepare everything...',
    content: 'Arranging sacred content...',
    guidance: "Gathering today's spiritual guidance...",
    scriptures: 'Opening the sacred texts...',
    calendar: 'Preparing the sacred calendar...',
    temples: 'Bringing temple information to you...',
    profile: 'Preparing your profile...',
    route: 'Finding a peaceful path for your journey...',
    audio: 'Preparing the sacred reading...',
    upload: 'Safely placing your offering in the library...',
  }),
  error: Object.freeze({
    default: "We couldn't complete this right now. Please try again in a few moments.",
    network: "We couldn't connect right now. Please check your internet connection and try again.",
    session: 'Your session has ended. Please sign in again to continue.',
    permission: "You don't have access to this area. Please use an account with the required permission.",
    notFound: "We couldn't find what you were looking for. Please return and try another path.",
    load: "We couldn't load this information right now. Please try again in a few moments.",
    save: "We couldn't save your changes right now. Please review them and try again.",
    upload: "We couldn't upload this file right now. Please check the file and try again.",
    auth: 'The email or password you entered is incorrect. Please check your details and try again.',
  }),
  success: Object.freeze({
    saved: 'Your changes have been saved with care.',
    submitted: 'Thank you. Your details have been received with gratitude.',
    deleted: 'The item has been removed.',
    bookmarked: 'This page has been saved for your spiritual journey.',
  }),
});

const TECHNICAL_ERROR_PATTERN =
  /\b(stack|traceback|exception|internal server|request failed|network error|failed to fetch|axios|sql|database|postgres|jwt|token payload|status code|openrouter|anthropic|api key|undefined|null|cannot read|timeout|econn|cors|json)\b/i;

export function friendlyError(error, fallback = UI_MESSAGES.error.default) {
  if (!error) return fallback;

  if (!error.response && (error.code === 'ERR_NETWORK' || error.name === 'TypeError')) {
    return UI_MESSAGES.error.network;
  }

  const status = error.response?.status ?? error.status;
  if (status === 401) {
    return fallback === UI_MESSAGES.error.auth
      ? UI_MESSAGES.error.auth
      : UI_MESSAGES.error.session;
  }
  if (status === 403) return UI_MESSAGES.error.permission;
  if (status === 404) return UI_MESSAGES.error.notFound;

  const detail = error.response?.data?.detail ?? error.detail;
  const candidate =
    typeof detail === 'string'
      ? detail
      : typeof detail?.message === 'string'
        ? detail.message
        : typeof error.message === 'string'
          ? error.message
          : '';

  return candidate && !TECHNICAL_ERROR_PATTERN.test(candidate) ? candidate : fallback;
}
