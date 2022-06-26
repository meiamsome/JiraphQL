import { MaybePromise } from './tsutil';

export type Fetcher = (path: string) => MaybePromise<string>;
export type KeyLookupFunction = (
    key: Record<string, unknown>,
    fetcher: Fetcher,
) => MaybePromise<string | null>;

export type CreateSchemaOptions = {
    keyLookupFunction?: KeyLookupFunction,
};
