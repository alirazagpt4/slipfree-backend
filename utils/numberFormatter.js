/**
 * Normalizes a Pakistani phone number into standard format: +923XXXXXXXXX
 * Handles raw inputs, spaces, dashes, leading zeros, and pre-existing country codes.
 * 
 * @param {string|number|null|undefined} input - The raw phone number
 * @returns {string|null} Cleaned E.164 formatted string (e.g., '+923144965144') or null if invalid.
 */
export const formatPakistaniPhoneNumber = (input) => {
    if (!input) return null;

    // 1. Convert to string and strip all non-numeric characters except leading '+'
    let cleaned = String(input).trim().replace(/[^\d+]/g, '');

    if (!cleaned) return null;

    // 2. Handle numbers starting with leading zero (e.g., "03144965144" -> "3144965144")
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.replace(/^0+/, '');
    }

    // 3. Handle cases with existing country code formats
    if (cleaned.startsWith('+92')) {
        cleaned = cleaned.slice(1); // Remove leading '+' for processing
    } else if (cleaned.startsWith('92')) {
        // Already starts with 92, leave as is
    } else if (cleaned.length === 10 && cleaned.startsWith('3')) {
        // Valid local 10-digit number without country code (e.g., "3144965144")
        cleaned = `92${cleaned}`;
    } else {
        // Invalid length or unexpected starting digit
        return null;
    }

    // 4. Validate exact length for Pakistan (92 + 10 digits = 12 digits total)
    if (cleaned.length !== 12 || !cleaned.startsWith('923')) {
        return null;
    }

    return `+${cleaned}`;
};