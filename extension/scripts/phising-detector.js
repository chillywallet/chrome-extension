/* eslint-disable no-undef */
window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    const { type, domain } = event.data;
    if (type === "bypass-domain") {
        chrome.runtime.sendMessage({ type: "bypass-domain", domain });
    }
});