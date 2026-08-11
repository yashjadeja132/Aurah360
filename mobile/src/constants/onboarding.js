/** AsyncStorage key marking that the first-run onboarding sequence (privacy notice →
 *  language/notifications/app-lock preferences) has been completed on this device/install.
 *  Shared between AuthStack, OtpVerifyScreen and PinSetupScreen so all three agree on the
 *  same key name. */
export const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';
