export function isObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object') return false;
    if (value === null) return false;

    return true;
}

export function isStringMap(value: unknown): value is Record<string, string> {
    if (!isObject(value)) return false;

    return Object.values(value).every((item) => typeof item === 'string');
}

export function isPromise(value: unknown): value is Promise<unknown> {
    if (!isObject(value)) return false;

    return typeof value?.then === 'function';
}

export type MaybePromise<T> = T | Promise<T>;

export function maybeThen<T, U>(
    value: MaybePromise<T>,
    fn: (arg: T) => MaybePromise<U>,
): MaybePromise<U> {
    if (isPromise(value)) return value.then(fn);

    return fn(value);
}
