// eslint-disable-next-line import/no-anonymous-default-export
const createLogger = () => {
    const result: Record<string, (...data: any[]) => void> = {};
    const funcNames = ['log', 'warn', 'error', 'debug', 'info', 'trace'];
    funcNames.forEach(_name => {
        result[_name] = (message?: any, ...optionalParams: any[]) => {
            if (process.env.BUILD_TYPE !== 'Prod') {
                if (optionalParams && optionalParams.length) {
                    //@ts-ignore
                    console[_name](message + ':', ...optionalParams);
                } else {
                    //@ts-ignore
                    console[_name](message);
                }
            }
        };
    });

    return result;
};

export default createLogger();
