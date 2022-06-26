import {
    GraphQLFieldConfigMap,
    GraphQLID,
    GraphQLInterfaceType,
    GraphQLNonNull,
} from 'graphql';
import { Fetcher, KeyLookupFunction } from '../configTypes';
import { isObject, MaybePromise, maybeThen } from '../tsutil';

export function createQueryNodeFieldResolver(
    fetcher: Fetcher,
    keyLookupFunction: KeyLookupFunction,
) {
    return function queryNodeFieldResolver<TSource>(
        parent: TSource,
        { id }: { id: string },
    ): MaybePromise<Record<string, unknown> | null> {
        let parsedKey: unknown;
        try {
            parsedKey = JSON.parse(id);
        } catch {
            return null;
        }
        if (!isObject(parsedKey)) {
            return null;
        }
        const key: Record<string, unknown> = parsedKey;
        const filenameMaybePromise = keyLookupFunction(key, fetcher);
        return maybeThen(filenameMaybePromise, (data) => {
            if (!data) {
                return null;
            }
            return key;
        });
    };
}

export function createQueryNodeFieldAdder(
    fetcher: Fetcher,
    keyLookupFunction: KeyLookupFunction,
    nodeInterface: GraphQLInterfaceType,
) {
    return function addQueryNodeField<TSource, TContext>(
        fieldConfig: GraphQLFieldConfigMap<TSource, TContext>,
    ): GraphQLFieldConfigMap<TSource, TContext> {
        if (Object.prototype.hasOwnProperty.call(fieldConfig, 'node')) {
            throw new Error('Type already has a node field when trying to create Query.node');
        }
        return {
            ...fieldConfig,
            node: {
                args: {
                    id: {
                        type: new GraphQLNonNull(GraphQLID),
                    },
                },
                type: nodeInterface,
                resolve: createQueryNodeFieldResolver(
                    fetcher,
                    keyLookupFunction,
                ),
            },
        };
    };
}
