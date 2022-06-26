import {
    execute,
    GraphQLFieldConfigMap,
    GraphQLID,
    GraphQLNonNull,
    GraphQLResolveInfo,
    Kind,
    parse,
} from 'graphql';
import jsonStableStringify from 'json-stable-stringify';
import { getAllDirectives } from '../schemaUtil';
import { MaybePromise, maybeThen } from '../tsutil';

export function nodeIdFieldResolver<TSource, TContext, TArgs>(
    parent: TSource,
    args: TArgs,
    context: TContext,
    {
        parentType,
        schema,
    }: GraphQLResolveInfo,
): MaybePromise<string> {
    const currentKey = {
        ...parent,
        __typename: parentType.name,
    };
    const directives = getAllDirectives(parentType, schema);
    if (!directives?.length) {
        throw new Error('Trying to resolve id for type without @key directive.');
    }
    const fields = directives[0].arguments?.find(({ name }) => name.value === 'fields');
    if (!fields || fields.value.kind !== Kind.STRING) {
        throw new Error('Cannot find fields argument in @key directive.');
    }

    const maybeExecutePromise = execute({
        schema,
        document: parse(`
            query selfIdLookup($id: ID!) {
                node(id: $id) {
                    __typename
                    ... on ${parentType.name} {
                        ${fields.value.value}
                    }
                }
            }
        `),
        contextValue: context,
        variableValues: {
            id: jsonStableStringify(currentKey),
        },
    });

    return maybeThen(maybeExecutePromise, (result) => {
        if (result.errors) {
            throw new Error(`Failed to self look up ID!\n\n${result.errors.toString()}`);
        }
        if (!result.data?.node) {
            throw new Error('Failed to self look up ID: returned no data');
        }
        return `${jsonStableStringify(result.data.node)}`;
    });
}

export function addNodeIdField<TSource, TContext>(
    fieldConfig: GraphQLFieldConfigMap<TSource, TContext>,
): GraphQLFieldConfigMap<TSource, TContext> {
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'id')) {
        throw new Error('Type already has an id field when trying to create Node.id');
    }
    return {
        ...fieldConfig,
        id: {
            type: new GraphQLNonNull(GraphQLID),
            resolve: nodeIdFieldResolver,
        },
    };
}
