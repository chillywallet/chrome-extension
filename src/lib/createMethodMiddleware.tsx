import { permissionRpcMethods } from '@metamask/permission-controller';
import { ethErrors } from 'eth-rpc-errors';
import { flatten } from 'lodash';
import { UNSUPPORTED_RPC_METHODS } from '../shared/constants/network';
import localHandlers from './rpc-method-middleware';

const allHandlers = [...localHandlers, ...permissionRpcMethods.handlers];

const handlerMap = allHandlers.reduce((map, handler) => {
    for (const methodName of handler.methodNames) {
        map.set(methodName, handler);
    }
    return map;
}, new Map());

const expectedHookNames = Array.from(
    //@ts-ignore
    new Set(flatten(allHandlers.map(({ hookNames }) => Object.keys(hookNames)))).values(),
);

/**
 * Returns the subset of the specified `hooks` that are included in the
 * `hookNames` object. This is a Principle of Least Authority (POLA) measure
 * to ensure that each RPC method implementation only has access to the
 * API "hooks" it needs to do its job.
 *
 * @param hooks - The hooks to select from.
 * @param hookNames - The names of the hooks to select.
 * @returns The selected hooks.
 * @template Hooks - The hooks to select from.
 * @template HookName - The names of the hooks to select.
 */
export function selectHooks<Hooks extends Record<string, unknown>, HookName extends keyof Hooks>(
    hooks: Hooks,
    hookNames?: Record<HookName, boolean>,
): Pick<Hooks, HookName> | undefined {
    if (hookNames) {
        return Object.keys(hookNames).reduce<Partial<Pick<Hooks, HookName>>>(
            (hookSubset, _hookName) => {
                const hookName = _hookName as HookName;
                hookSubset[hookName] = hooks[hookName];
                return hookSubset;
            },
            {},
        ) as Pick<Hooks, HookName>;
    }
    return undefined;
}

/**
 * Creates a json-rpc-engine middleware of RPC method implementations.
 *
 * Handlers consume functions that hook into the background, and only depend
 * on their signatures, not e.g. controller internals.
 *
 * @param {Record<string, unknown>} hooks - Required "hooks" into our
 * controllers.
 * @returns {(req: object, res: object, next: Function, end: Function) => void}
 */
export function createMethodMiddleware(hooks: Record<string, unknown>) {
    // Fail immediately if we forgot to provide any expected hooks.
    const missingHookNames = expectedHookNames.filter(
        hookName => !Object.hasOwnProperty.call(hooks, hookName),
    );
    if (missingHookNames.length > 0) {
        throw new Error(`Missing expected hooks:\n\n${missingHookNames.join('\n')}\n`);
    }

    return async function methodMiddleware(req: any, res: any, next: Function, end: Function) {
        // Reject unsupported methods.
        if (UNSUPPORTED_RPC_METHODS.has(req.method)) {
            return end(ethErrors.rpc.methodNotSupported());
        }

        const handler = handlerMap.get(req.method);
        if (handler) {
            const { implementation, hookNames } = handler;
            try {
                // Implementations may or may not be async, so we must await them.
                return await implementation(req, res, next, end, selectHooks(hooks, hookNames));
            } catch (error) {
                return end(error);
            }
        }

        return next();
    };
}
