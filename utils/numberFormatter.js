const normalizePhone = (phoneInput) => {
    if (!phoneInput || phoneInput === 'N/A') return 'N/A';

    // Spaces, dashes, aur + signs remove karna
    const digitsOnly = phoneInput.toString().replace(/[^0-9]/g, '');

    if (!digitsOnly || digitsOnly.length < 10) return 'N/A';

    // Last 10 digits extract karke +92 attach karna
    const core10Digits = digitsOnly.slice(-10);

    return `+92${core10Digits}`;
};

export default normalizePhone;