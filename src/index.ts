import { buildSchema, GraphQLSchema } from 'graphql';
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
    return maybeThen(lookupTableMaybePromise, (lookupTable) => lookupTable[JSON.stringify(key)]);
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
        const type = schema.getQueryType();
        if (!type) {
            throw new Error('Schema does not declare a query type.');
        }
        for (const [fieldName, fieldDefinition] of Object.entries(type.getFields())) {
            fieldDefinition.resolve = () => {
                const key = {
                    __typename: 'Query',
                };
                const filenameMaybePromise = keyLookupFunction(key, fetcher);
                const fileFetch = maybeThen(filenameMaybePromise, fetcher);
                const dataMaybePromise = maybeThen(fileFetch, (file) => {
                    const data: unknown = JSON.parse(file);
                    if (!isObject(data)) throw new Error('File did not include expected data.');
                    return data;
                });
                return maybeThen(dataMaybePromise, (data) => data[fieldName]);
            };
        }

        return schema;
    });
}

export default createSchema;
