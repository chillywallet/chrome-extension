export const generateDeviceId = async () => {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    const vendor = window.navigator.vendor;

    const arrayBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${userAgent}${platform}${vendor}`));

    const hashArray = Array.from(new Uint8Array(arrayBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}