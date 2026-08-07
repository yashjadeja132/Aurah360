export { eventBus } from './eventBus.js';

/** Domain event name constants — expand per module. */
export const DOMAIN_EVENTS = Object.freeze({
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
});
