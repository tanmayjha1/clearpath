/**
 * Localized strings for ClearPath
 *
 * All user-facing text is centralized here.
 * Strings are keyed by language code matching USER_PREFERENCES.language
 */

export const STRINGS = {
    english: {
        // Loading state
        loadingAlert: 'Generating alert...',

        // Alert screen
        alertTitle: '⚠️ Emergency Vehicle Approaching',
        clearButtonText: 'Lane Cleared',
        countdownLabel: 'Ambulance arrives in',

        // Default (idle) screen
        allClear: 'All Clear',
        noEmergency: 'No emergency vehicles nearby',
        clearedTitle: 'Lane Cleared — Thank You!',
        clearedSubtext: 'You helped an emergency vehicle reach its destination faster.',
        branding: '🚗 ClearPath',
        brandingSubtext: 'Keeping roads clear for emergencies',

        // Fallback message if AI fails
        fallbackMessage: 'Emergency vehicle approaching. Please move to the left lane.',

        // Time labels
        minuteLabel: 'min',
        minutesLabel: 'mins',
        lessThanMinute: '<1 min',

        // Destination-templated alert messages
        alertMessageTemplate: (dest) =>
            `An ambulance is heading to ${dest}. Please move to the left lane immediately.`,
    },

    mandarin: {
        loadingAlert: '正在生成警报...',
        alertTitle: '⚠️ 紧急车辆正在靠近',
        clearButtonText: '已让出车道',
        countdownLabel: '救护车到达时间',
        allClear: '一切正常',
        noEmergency: '附近没有紧急车辆',
        clearedTitle: '已让出车道 — 谢谢您！',
        clearedSubtext: '您帮助了紧急车辆更快到达目的地。',
        branding: '🚗 ClearPath',
        brandingSubtext: '为紧急情况保持道路畅通',
        fallbackMessage: '紧急车辆正在靠近。请移至左侧车道。',
        minuteLabel: '分钟',
        minutesLabel: '分钟',
        lessThanMinute: '<1 分钟',

        alertMessageTemplate: (dest) =>
            `一辆救护车正前往${dest}。请立即移至左侧车道。`,
    },

    malay: {
        loadingAlert: 'Menjana amaran...',
        alertTitle: '⚠️ Kenderaan Kecemasan Menghampiri',
        clearButtonText: 'Lorong Dibersihkan',
        countdownLabel: 'Ambulans tiba dalam',
        allClear: 'Selamat',
        noEmergency: 'Tiada kenderaan kecemasan berdekatan',
        clearedTitle: 'Lorong Dibersihkan — Terima Kasih!',
        clearedSubtext: 'Anda membantu kenderaan kecemasan tiba lebih cepat.',
        branding: '🚗 ClearPath',
        brandingSubtext: 'Memastikan jalan lancar untuk kecemasan',
        fallbackMessage: 'Kenderaan kecemasan menghampiri. Sila pindah ke lorong kiri.',
        minuteLabel: 'min',
        minutesLabel: 'min',
        lessThanMinute: '<1 min',

        alertMessageTemplate: (dest) =>
            `Ambulans menuju ke ${dest}. Sila pindah ke lorong kiri segera.`,
    },

    tamil: {
        loadingAlert: 'எச்சரிக்கை உருவாக்கப்படுகிறது...',
        alertTitle: '⚠️ அவசர வாகனம் நெருங்குகிறது',
        clearButtonText: 'லேன் அகற்றப்பட்டது',
        countdownLabel: 'ஆம்புலன்ஸ் வரும் நேரம்',
        allClear: 'பாதுகாப்பானது',
        noEmergency: 'அருகில் அவசர வாகனங்கள் இல்லை',
        clearedTitle: 'லேன் அகற்றப்பட்டது — நன்றி!',
        clearedSubtext: 'அவசர வாகனம் விரைவாக சேர உதவினீர்கள்.',
        branding: '🚗 ClearPath',
        brandingSubtext: 'அவசரநிலைக்கு சாலைகளை சுத்தமாக வைத்தல்',
        fallbackMessage: 'அவசர வாகனம் நெருங்குகிறது. இடது லேனுக்கு நகரவும்.',
        minuteLabel: 'நிமிடம்',
        minutesLabel: 'நிமிடங்கள்',
        lessThanMinute: '<1 நிமிடம்',

        alertMessageTemplate: (dest) =>
            `ஆம்புலன்ஸ் ${dest} செல்கிறது. உடனே இடது லேனுக்கு நகரவும்.`,
    },
};

/**
 * Helper: get strings for the current user language
 * @param {string} language - Language code from USER_PREFERENCES
 * @returns {Object} String dictionary for that language
 */
export function getStrings(language) {
    return STRINGS[language] || STRINGS.english;
}
