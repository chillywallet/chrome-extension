// eslint-disable-next-line import/unambiguous

setTimeout(() => {
    // eslint-disable-next-line spaced-comment
    const scriptsToLoad = ['../scripts/ui.js', '../scripts/echarts.js'];

    const loadScript = src => {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.onload = loadNext;
        script.src = src;
        document.body.appendChild(script);
    };

    loadNext();

    function loadNext() {
        if (scriptsToLoad.length) {
            loadScript(scriptsToLoad.shift());
        } else {
            document.documentElement.classList.add('chilly-loaded');
        }
    }
}, 10);
