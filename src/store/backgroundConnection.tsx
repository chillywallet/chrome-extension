import { BackgroundConnection } from '../shared/types/Connection';

let background: BackgroundConnection | null = null;

export const generateActionId = () => Date.now() + Math.random();

/**
 * Promise-style call to background method.
 *
 * @param method - name of the background method
 * @param [args] - arguments to that method, if any
 * @returns
 */
export function submitRequestToBackground<R>(method: string, args?: any[]): Promise<R> {
    return new Promise<R>((resolve, reject) => {
        background?.[method](...(args ?? []), (err: any, data: R) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Sets/replaces the background connection reference
 * Under MV3 it also triggers queue processing if the new background is connected
 *
 * @param backgroundConnection
 */
export async function setBackgroundConnection(backgroundConnection: typeof background) {
    background = backgroundConnection;
}
