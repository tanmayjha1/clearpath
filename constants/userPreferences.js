/**
 * User Preferences for ClearPath
 *
 * This file stores hardcoded user settings for the driver experience.
 * To change the driver's preferred language, modify the `language` field below.
 *
 * Supported languages:
 *   "english"  — English (default)
 *   "mandarin" — Simplified Chinese (简体中文)
 *   "malay"    — Bahasa Melayu
 *   "tamil"    — Tamil (தமிழ்)
 */

export const USER_PREFERENCES = {
    /**
     * The driver's preferred language for safety alerts.
     * Change this value to switch the language of all alerts and UI text.
     * Supported values: "english", "mandarin", "malay", "tamil"
     */
    language: 'english',

    // TODO Step 5: fetch language preference from Supabase user profile instead of hardcoded value
    // Example:
    //   const { data } = await supabase.from('profiles').select('language').eq('id', userId).single();
    //   language: data?.language || 'english',
};
