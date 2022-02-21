import {
    ConstDirectiveNode,
    GraphQLObjectType,
    GraphQLSchema,
    GraphQLType,
} from 'graphql';

export function isPrimaryType(type: GraphQLType, schema: GraphQLSchema): boolean {
    if (!(type instanceof GraphQLObjectType)) return false;

    if (schema.getQueryType() === type) return true;

    return !!type.astNode?.directives?.find((directive) => directive.name.value === 'key');
}

export function getAllDirectives(
    type: GraphQLType,
    schema: GraphQLSchema,
): null | ConstDirectiveNode[] {
    if (!(type instanceof GraphQLObjectType)) return null;

    if (!isPrimaryType(type, schema)) return null;

    return type.astNode?.directives?.filter((directive) => directive.name.value === 'key') || [];
}
