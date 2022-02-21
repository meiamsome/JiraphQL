import { buildSchema, GraphQLObjectType, GraphQLSchema } from 'graphql';
import jsonStableStringify from 'json-stable-stringify';
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

export function createSchema(
    fetcher: Fetcher,
    {
        keyLookupFunction = defaultKeyLookupFunction,
    }: CreateSchemaOptions = {},
): MaybePromise<GraphQLSchema> {
    const schemaDocumentFetch = fetcher('schema.graphql');

    const schemaMaybe = maybeThen(schemaDocumentFetch, buildSchema);

    return maybeThen(schemaMaybe, (schema) => {
        for (const type of Object.values(schema.getTypeMap())) {
            if (!(type instanceof GraphQLObjectType)) continue;

            if (!isPrimaryType(type, schema)) continue;

            for (const [fieldName, fieldDefinition] of Object.entries(type.getFields())) {
                fieldDefinition.resolve = (parent: Record<string, unknown>) => {
                    const key = {
                        ...parent,
                        __typename: type.name,
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
        }

        return schema;
    });
}

export default createSchema;
