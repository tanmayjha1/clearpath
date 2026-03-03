/**
 * OpenAI ChatGPT Alert Service for ClearPath
 *
 * Generates natural language driving alerts in the driver's preferred language.
 * Uses gpt-4o-mini for fast, cost-effective alert generation.
 */

import { USER_PREFERENCES } from '../constants/userPreferences';
import { getStrings } from '../constants/strings';
import { AMBULANCE_CONFIG } from '../constants/ambulanceConfig';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_KEY || '';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 5000; // 5 second timeout, fallback if exceeded

// ─── System prompts per language ───────────────────────────────────────

const SYSTEM_PROMPTS = {
    english:
        'You are a safety alert system for Singapore drivers. Generate short, clear, calm driving instructions. The instruction MUST be: "Move to the left lane as emergency responders are coming on the right lane. Maintain a safe distance as they approach." or something very similar. Do not specify other specific lanes. Maximum 2 sentences. Never use exclamation marks. Do NOT mention any destination or location name.',

    mandarin:
        '你是新加坡驾驶员的安全警报系统。生成简短、清晰、冷静的驾驶指示。指示必须是：“紧急救援人员正从右侧车道驶来，请移至左侧车道。在他们靠近时保持安全距离。”或非常相似的内容。最多两句话。不要使用感叹号。不要提及任何目的地或地点名称。请用简体中文回复。',

    malay:
        'Anda adalah sistem amaran keselamatan untuk pemandu di Singapura. Jana arahan pemanduan yang ringkas, jelas dan tenang. Arahan mestilah: "Sila beralih ke lorong kiri kerana responden kecemasan sedang menghampiri di lorong kanan. Jaga jarak selamat." atau yang serupa dengannya. Maksimum dua ayat. Jangan gunakan tanda seru. Jangan sebut sebarang destinasi atau nama lokasi. Sila balas dalam Bahasa Melayu.',

    tamil:
        'நீங்கள் சிங்கப்பூர் ஓட்டுநர்களுக்கான பாதுகாப்பு எச்சரிக்கை அமைப்பு. சுருக்கமான, தெளிவான, அமைதியான வாகன ஓட்டுதல் வழிமுறைகளை உருவாக்கவும். "அவசர உதவி வாகனங்கள் வலது லேனில் வருவதால், இடது லேனுக்கு மாறவும். அவை நெருங்கும் போது பாதுகாப்பான தூரத்தை பராமரிக்கவும்." என்று மட்டும் கூறவும். அதிகபட்சம் இரண்டு வாக்கியங்கள். ஆச்சரியக்குறி பயன்படுத்தாதீர்கள். எந்த இடம் அல்லது செல்லுமிடம் குறிப்பிடவேண்டாம். தமிழில் பதிலளிக்கவும்.',
};

// ─── Trip context from centralized config ──────────────────────────────
// TODO: These values will be populated by the location selector in a future step

/**
 * Generate an AI-powered driving alert in the user's preferred language
 *
 * @param {number} countdownSeconds - Seconds until ambulance arrives
 * @returns {Promise<string>} The alert message text
 */
export async function generateAlertMessage(countdownSeconds) {
    const language = USER_PREFERENCES.language;
    const strings = getStrings(language);

    // Derive minutes from countdown
    const minutes = Math.max(1, Math.ceil(countdownSeconds / 60));

    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.english;

    const userPrompt = `An ambulance is approaching. It will reach the driver in approximately ${minutes} minutes. Generate the safety instruction to move left. Do NOT mention any hospital name or destination.`;

    // If no API key, return fallback immediately
    if (!OPENAI_API_KEY) {
        console.warn('No OpenAI API key found, using fallback message');
        return strings.fallbackMessage;
    }

    try {
        // Race between API call and timeout
        const result = await Promise.race([
            callOpenAI(systemPrompt, userPrompt),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
            ),
        ]);

        return result || strings.fallbackMessage;
    } catch (error) {
        console.error('Alert generation failed:', error.message);
        return strings.fallbackMessage;
    }
}

/**
 * Call OpenAI Chat Completions API (non-streaming)
 *
 * @param {string} systemPrompt - System message for the AI
 * @param {string} userPrompt - User message for the AI
 * @returns {Promise<string>} AI response text
 */
async function callOpenAI(systemPrompt, userPrompt) {
    const response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 100,
            temperature: 0.3, // Low temperature for consistent, calm alerts
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
        throw new Error('No choices returned from OpenAI');
    }

    return data.choices[0].message.content.trim();
}
