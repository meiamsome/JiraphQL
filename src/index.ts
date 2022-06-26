import {
    buildSchema,
    GraphQLFieldConfig,
    GraphQLID,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLSchema,
    GraphQLUnionType,
    isInterfaceType,
    isObjectType,
} from 'graphql';
import jsonStableStringify from 'json-stable-stringify';
import { CreateSchemaOptions, Fetcher, KeyLookupFunction } from './configTypes';
import { addNodeIdField } from './globalObjectIdentification/nodeIdFieldResolver';
import { createQueryNodeFieldAdder } from './globalObjectIdentification/queryNodeFieldResolver';
import { mapFieldTypes, mapType } from './graphqlUtil';
import { createQueryByKeyAdder } from './queryByKey';
import { isPrimaryType } from './schemaUtil';
import {
    isObject,
    isStringMap,
    MaybePromise,
    maybeThen,
} from './tsutil';

function defaultKeyLookupFunction(
    key: Record<string, unknown>,
    fetcher: Fetcher,
): MaybePromise<string | null> {
    const lookupTableFetch = fetcher('index.json');

    const lookupTableMaybePromise = maybeThen(lookupTableFetch, (lookupTableString) => {
        const data: unknown = JSON.parse(lookupTableString);
        if (!isStringMap(data)) throw new Error('Failed to lookup index - returned value was not a map.');

        return data;
    });
    const encodedKey = jsonStableStringify(key);
    return maybeThen(lookupTableMaybePromise, (lookupTable) => lookupTable[encodedKey] ?? null);
}

function thunkMap<T, U>(thunk: () => T, map: (arg: T) => U): () => U {
    return () => map(thunk());
}

function addResolveDefinition<TSource, TContext, TArgs>(
    fieldConfig: GraphQLFieldConfig<TSource, TContext, TArgs>,
    fetcher: Fetcher,
    keyLookupFunction: KeyLookupFunction,
): GraphQLFieldConfig<TSource, TContext, TArgs> {
    return {
        ...fieldConfig,
        resolve(parent, _args, _context, { fieldName, parentType }) {
            const key = {
                ...parent,
                __typename: parentType.name,
            };
            const filenameMaybePromise = keyLookupFunction(key, fetcher);
            const requireExistenceMaybePromise = maybeThen(filenameMaybePromise, (res) => {
                if (!res) {
                    throw new Error('Failed to find key in index!');
                }
                return res;
            });
            const fileFetch = maybeThen(requireExistenceMaybePromise, fetcher);
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
        const primaryTypes: GraphQLObjectType[] = [];

        const nodeInterface = new GraphQLInterfaceType({
            name: 'Node',
            fields: {
                id: {
                    type: new GraphQLNonNull(GraphQLID),
                },
            },
        });
        types.push(nodeInterface);

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
            let interfacesThunk = () => config.interfaces;

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

            interfacesThunk = thunkMap(
                interfacesThunk,
                (interfaces) => interfaces.map((interfaceType) => {
                    const mappedType = mapType(interfaceType, types);
                    if (!isInterfaceType(mappedType)) {
                        throw new Error('Failed to map interface to interface');
                    }
                    return mappedType;
                }),
            );

            if (isPrimaryType(type, schema)) {
                fieldThunk = thunkMap(fieldThunk, (fields) => ({
                    ...Object.fromEntries(
                        Object.entries(fields)
                            .map(([key, value]) => [
                                key,
                                addResolveDefinition(
                                    value,
                                    fetcher,
                                    keyLookupFunction,
                                ),
                            ]),
                    ),
                }));

                fieldThunk = thunkMap(fieldThunk, addNodeIdField);

                interfacesThunk = thunkMap(interfacesThunk, (interfaces) => [
                    ...interfaces,
                    nodeInterface,
                ]);
            }

            if (schema.getQueryType() === type) {
                fieldThunk = thunkMap(
                    fieldThunk,
                    createQueryNodeFieldAdder(
                        fetcher,
                        keyLookupFunction,
                        nodeInterface,
                    ),
                );

                fieldThunk = thunkMap(
                    fieldThunk,
                    createQueryByKeyAdder(
                        schema,
                        types,
                        primaryTypes,
                    ),
                );
            }

            const newType = new GraphQLObjectType({
                ...config,
                fields: fieldThunk,
                interfaces: interfacesThunk,
            });

            types.push(newType);
            if (isPrimaryType(type, schema)) {
                primaryTypes.push(newType);
            }
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
