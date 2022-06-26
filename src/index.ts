import {
    buildSchema,
    GraphQLFieldConfig,
    GraphQLNamedType,
    GraphQLObjectType,
    GraphQLSchema,
    GraphQLUnionType,
    isObjectType,
} from 'graphql';
import jsonStableStringify from 'json-stable-stringify';
import { mapFieldTypes } from './graphqlUtil';
import { isPrimaryType } from './schemaUtil';
import {
    isObject,
    isStringMap,
    MaybePromise,
    maybeThen,
} from './tsutil';

type Fetcher = (path: string) => MaybePromise<string>;
type CreateSchemaOptions = {
    keyLookupFunction?: (key: Record<string, unknown>, fetcher: Fetcher) => MaybePromise<string>,
};

function defaultKeyLookupFunction(
    key: Record<string, unknown>,
    fetcher: Fetcher,
): MaybePromise<string> {
    const lookupTableFetch = fetcher('index.json');

    const lookupTableMaybePromise = maybeThen(lookupTableFetch, (lookupTableString) => {
        const data: unknown = JSON.parse(lookupTableString);
        if (!isStringMap(data)) throw new Error('Failed to lookup index - returned value was not a map.');

        return data;
    });
    const encodedKey = jsonStableStringify(key);
    return maybeThen(lookupTableMaybePromise, (lookupTable) => {
        if (!Object.prototype.hasOwnProperty.call(lookupTable, encodedKey)) {
            throw new Error(`Failed to find a key in the index: '${encodedKey}'.`);
        }
        return lookupTable[encodedKey];
    });
}

function thunkMap<T, U>(thunk: () => T, map: (arg: T) => U): () => U {
    return () => map(thunk());
}

function addResolveDefinition<TSource, TContext, TArgs>(
    fieldConfig: GraphQLFieldConfig<TSource, TContext, TArgs>,
    fetcher: Fetcher,
    keyLookupFunction: (key: Record<string, unknown>, fetcher: Fetcher) => MaybePromise<string>,
): GraphQLFieldConfig<TSource, TContext, TArgs> {
    return {
        ...fieldConfig,
        resolve(parent, _args, _context, { fieldName, parentType }) {
            const key = {
                ...parent,
                __typename: parentType.name,
            };
            const filenameMaybePromise = keyLookupFunction(key, fetcher);
            const fileFetch = maybeThen(filenameMaybePromise, fetcher);
            const dataMaybePromise = maybeThen(fileFetch, (file) => {
                const data: unknown = JSON.parse(file);
                if (!isObject(data)) throw new Error('File did not include expected data.');
                return data;
            });
            return maybeThen(dataMaybePromise, (data) => data[fieldName]);
        },
    };
}

export function createSchema(
    fetcher: Fetcher,
    {
        keyLookupFunction = defaultKeyLookupFunction,
    }: CreateSchemaOptions = {},
): MaybePromise<GraphQLSchema> {
    const schemaDocumentFetch = fetcher('schema.graphql');

    const schemaMaybe = maybeThen(schemaDocumentFetch, buildSchema);

    return maybeThen(schemaMaybe, (schema) => {
        let queryType = null;
        const types: GraphQLNamedType[] = [];
        for (const type of Object.values(schema.getTypeMap())) {
            if (type.name.startsWith('__')) {
                continue;
            }

            if (type instanceof GraphQLUnionType) {
                const config = type.toConfig();
                const newType = new GraphQLUnionType({
                    ...config,
                    types: () => config.types.map((subType) => {
                        const foundType = types.find(({ name }) => name === subType.name);
                        if (!foundType || !isObjectType(foundType)) {
                            throw new Error('Failed to construct new schema!');
                        }
                        return foundType;
                    }),
                });
                types.push(newType);
                continue;
            }

            if (!(type instanceof GraphQLObjectType)) {
                types.push(type);
                continue;
            }

            const config = type.toConfig();

            let fieldThunk = () => config.fields;

            fieldThunk = thunkMap(fieldThunk, (fields) => Object.fromEntries(
                Object.entries(fields)
                    .map(([key, value]) => [
                        key,
                        mapFieldTypes(
                            value,
                            types,
                        ),
                    ]),
            ));

            if (isPrimaryType(type, schema)) {
                fieldThunk = thunkMap(fieldThunk, (fields) => Object.fromEntries(
                    Object.entries(fields)
                        .map(([key, value]) => [
                            key,
                            addResolveDefinition(
                                value,
                                fetcher,
                                keyLookupFunction,
                            ),
                        ]),
                ));
            }

            const newType = new GraphQLObjectType({
                ...config,
                fields: fieldThunk,
            });

            types.push(newType);
            if (schema.getQueryType() === type) {
                queryType = newType;
            }
        }

        return new GraphQLSchema({
            types,
            query: queryType,
        });
    });
}

export default createSchema;
