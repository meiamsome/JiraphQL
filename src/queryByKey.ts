import {
    GraphQLFieldConfigArgumentMap,
    GraphQLFieldConfigMap,
    GraphQLInputObjectType,
    GraphQLNamedType,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLSchema,
    isInputType,
    isOutputType,
    Kind,
    SelectionSetNode,
    TypeInfo,
    visit,
    visitWithTypeInfo,
} from 'graphql';
import jsonStableStringify from 'json-stable-stringify';
import { v4 as uuidv4 } from 'uuid';
import { mapType, parseKeyFields } from './graphqlUtil';
import { getAllDirectives } from './schemaUtil';

export function createFieldName(typeName: string, selectionSet: SelectionSetNode) {
    let currentLayer: string | null = null;
    const names: string[] = [];
    visit(selectionSet, {
        [Kind.SELECTION_SET]: {
            enter: () => {
                names.push('');
            },
            leave: () => {
                const layer = names.pop();
                if (!layer) {
                    throw new Error('Unreachable: Cannot leave more than entered');
                }
                if (currentLayer) {
                    throw new Error('Unreachable: Expected currentSelections to be nulled out!');
                }

                currentLayer = layer;
            },
        },
        [Kind.FIELD]: {
            leave: (field) => {
                names[names.length - 1] += `${field.name.value[0].toUpperCase()}${field.name.value.slice(1)}`;
                if (currentLayer) {
                    names[names.length - 1] += `_${currentLayer}_`;
                    currentLayer = null;
                }
            },
        },
    });
    if (!currentLayer) {
        throw new Error('Unreachable: Should have left at the end.');
    }
    // Note: This `as string` is due to a TS inference bug:
    // https://github.com/microsoft/TypeScript/issues/49686
    return `${typeName[0].toLowerCase()}${typeName.slice(1)}By${currentLayer as string}`;
}

export function createInputArgs(
    schema: GraphQLSchema,
    parentType: GraphQLNamedType,
    selectionSet: SelectionSetNode,
    types: GraphQLNamedType[],
): [GraphQLInputObjectType[], GraphQLFieldConfigArgumentMap] {
    const inputs: GraphQLInputObjectType[] = [];
    let currentSelections:GraphQLFieldConfigArgumentMap | null = null;
    const fields: GraphQLFieldConfigArgumentMap[] = [];
    const inputTypeName = [parentType.name];
    const typeInfo = new TypeInfo(schema, parentType);
    visit(selectionSet, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET]: {
            enter() {
                fields.push({});
            },
            leave() {
                const layer = fields.pop();
                if (!layer) {
                    throw new Error('Unreachable: Cannot leave more than entered');
                }
                if (currentSelections) {
                    throw new Error('Unreachable: Expected currentSelections to be nulled out!');
                }
                currentSelections = layer;
            },
        },
        [Kind.FIELD]: {
            enter(field) {
                inputTypeName.push(`${inputTypeName[inputTypeName.length - 1]}${field.name.value[0].toUpperCase()}${field.name.value.slice(1)}`);
            },
            leave(field) {
                const name = inputTypeName.pop();
                if (!name) {
                    throw new Error('Unreachable: Cannot leave more than entered.');
                }
                if (currentSelections) {
                    const input = new GraphQLInputObjectType({
                        name: `${name}Input${uuidv4().replace(/-/g, '')}`,
                        description: 'This is a generated type and its name will change.',
                        fields: currentSelections,
                    });
                    inputs.push(input);
                    fields[fields.length - 1][field.name.value] = {
                        type: new GraphQLNonNull(input),
                    };
                    currentSelections = null;
                } else {
                    const type = typeInfo.getType();
                    if (!type) {
                        throw new Error(`Field ${field.name.value} type lookup failed.`);
                    }
                    const mappedType = mapType(type, types);
                    if (!isInputType(mappedType)) {
                        throw new Error('Unreachable: Expected scalars only.');
                    }
                    fields[fields.length - 1][field.name.value] = {
                        type: mappedType,
                    };
                }
            },
        },
    }));

    if (!currentSelections) {
        throw new Error('Unreachable: Should have entered and left equal amounts.');
    }

    return [inputs, currentSelections];
}

export function createQueryByKeyAdder(
    schema: GraphQLSchema,
    types: GraphQLNamedType[],
    primaryTypes: GraphQLObjectType[],
) {
    const queryType = schema.getQueryType();
    if (!queryType) {
        throw new Error('Unreachable: Schema has a Query type.');
    }

    return function addQueryByKeyFields<TSource, TContext>(
        fields: GraphQLFieldConfigMap<TSource, TContext>,
    ): GraphQLFieldConfigMap<TSource, TContext> {
        const newFields = { ...fields };

        const nodeFieldResolver = newFields.node?.resolve;
        if (!nodeFieldResolver) {
            throw new Error('Unreachable: Query.node is created by here.');
        }

        for (const primaryType of primaryTypes) {
            if (primaryType.name === queryType.name) {
                continue;
            }
            const directives = getAllDirectives(primaryType, schema);
            if (!directives) {
                throw new Error('Unreachable: PrimaryTypes have directives');
            }
            for (const directive of directives) {
                const valueNode = directive.arguments?.find(({ name }) => name.value === 'fields')?.value;
                if (!valueNode || valueNode.kind !== Kind.STRING) {
                    throw new Error('Unreachable: PrimaryTypes have valid directions');
                }
                const selectionSet = parseKeyFields(valueNode.value);

                const name = createFieldName(primaryType.name, selectionSet);
                if (Object.prototype.hasOwnProperty.call(newFields, name)) {
                    throw new Error(`Query already has a ${name} field.`);
                }

                const originalPrimaryType = schema.getTypeMap()[primaryType.name];
                if (!isOutputType(originalPrimaryType)) {
                    throw new Error('Unreachable: Result primary types correspond to input ones.');
                }

                const [inputs, args] = createInputArgs(
                    schema,
                    originalPrimaryType,
                    selectionSet,
                    types,
                );
                types.push(...inputs);
                newFields[name] = {
                    args,
                    type: primaryType,
                    resolve: (
                        parent,
                        resolveArgs: Record<string, unknown>,
                        context,
                        resolveInfo,
                    ) => {
                        const id = jsonStableStringify({
                            ...resolveArgs,
                            __typename: primaryType.name,
                        });

                        return nodeFieldResolver(
                            parent,
                            {
                                id,
                            },
                            context,
                            resolveInfo,
                        );
                    },
                };
            }
        }

        return newFields;
    };
}
