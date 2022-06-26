import {
    GraphQLFieldConfig,
    GraphQLList,
    GraphQLNamedType,
    GraphQLNonNull,
    GraphQLType,
    isInputType,
    isOutputType,
} from 'graphql';

export function mapType(type: GraphQLType, types: GraphQLNamedType[]): GraphQLType {
    if (type instanceof GraphQLList) {
        return new GraphQLList(mapType(type.ofType, types));
    }

    if (type instanceof GraphQLNonNull) {
        return new GraphQLNonNull(mapType(type.ofType, types));
    }

    const mappedType = types.find(({ name }) => type.name === name);

    if (!mappedType) {
        throw new Error(`Failed to find mapped type by name: '${type.name}'`);
    }

    return mappedType;
}

export function mapFieldTypes<TSource, TContext, TArgs>(
    fieldConfig: GraphQLFieldConfig<TSource, TContext, TArgs>,
    types: GraphQLNamedType[],
): GraphQLFieldConfig<TSource, TContext, TArgs> {
    const args = fieldConfig.args && Object.fromEntries(
        Object.entries(fieldConfig.args)
            .map(([key, config]) => {
                const argType = mapType(config.type, types);
                if (!isInputType(argType)) {
                    throw new Error('Failed to map input type correctly');
                }
                return [key, {
                    ...config,
                    type: argType,
                }];
            }),
    );

    const type = mapType(fieldConfig.type, types);
    if (!isOutputType(type)) {
        throw new Error('Failed to map output type correctly');
    }

    return {
        ...fieldConfig,
        args,
        type,
    };
}
