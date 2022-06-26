import {
    execute,
    GraphQLError,
    GraphQLID,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLResolveInfo,
    GraphQLSchema,
    Kind,
    parse,
    print,
} from 'graphql';
import { addNodeIdField, nodeIdFieldResolver } from './nodeIdFieldResolver';

jest.mock('graphql', () => ({
    ...jest.requireActual('graphql'),
    execute: jest.fn(),
}));

const executeMock = execute as jest.Mock<ReturnType<typeof execute>, Parameters<typeof execute>>;

describe('nodeIdFieldResolver', () => {
    const inputKey = {
        field1: 'a',
        field2: 10,
    };

    const context = Symbol('context');

    it('throws an error for missing directive', () => {
        const type = new GraphQLObjectType({
            name: 'TestType',
            fields: {},
        });

        const schema = new GraphQLSchema({
            types: [type],
            query: type,
        });

        const resolveInfo = {
            parentType: type,
            schema,
        } as GraphQLResolveInfo;

        expect(() => nodeIdFieldResolver(inputKey, {}, context, resolveInfo))
            .toThrowError('Trying to resolve id for type without @key directive.');
    });

    it('throws an error for malformed directive', () => {
        const type = new GraphQLObjectType({
            astNode: {
                kind: Kind.OBJECT_TYPE_DEFINITION,
                name: {
                    kind: Kind.NAME,
                    value: 'TestType',
                },
                directives: [{
                    kind: Kind.DIRECTIVE,
                    name: {
                        kind: Kind.NAME,
                        value: 'key',
                    },
                    arguments: [{
                        kind: Kind.ARGUMENT,
                        name: {
                            kind: Kind.NAME,
                            value: 'notFields',
                        },
                        value: {
                            kind: Kind.STRING,
                            value: 'field3 field4 { subField1 subField2 }',
                        },
                    }],
                }],
            },
            name: 'TestType',
            fields: {},
        });

        const schema = new GraphQLSchema({
            types: [type],
            query: type,
        });

        const resolveInfo = {
            parentType: type,
            schema,
        } as GraphQLResolveInfo;

        expect(() => nodeIdFieldResolver(inputKey, {}, context, resolveInfo))
            .toThrowError('Cannot find fields argument in @key directive.');
    });

    describe('for a valid type', () => {
        const type = new GraphQLObjectType({
            astNode: {
                kind: Kind.OBJECT_TYPE_DEFINITION,
                name: {
                    kind: Kind.NAME,
                    value: 'TestType',
                },
                directives: [{
                    kind: Kind.DIRECTIVE,
                    name: {
                        kind: Kind.NAME,
                        value: 'key',
                    },
                    arguments: [{
                        kind: Kind.ARGUMENT,
                        name: {
                            kind: Kind.NAME,
                            value: 'fields',
                        },
                        value: {
                            kind: Kind.STRING,
                            value: 'field3 field4 { subField1 subField2 }',
                        },
                    }],
                }],
            },
            name: 'TestType',
            fields: {},
        });

        const schema = new GraphQLSchema({
            types: [type],
            query: type,
        });

        const resolveInfo = {
            parentType: type,
            schema,
        } as GraphQLResolveInfo;

        it('forwards execution errors', () => {
            executeMock.mockReturnValue({
                errors: [new GraphQLError('Internal error', {})],
            });

            expect(() => nodeIdFieldResolver(inputKey, {}, context, resolveInfo))
                .toThrowError('Failed to self look up ID!\n\nInternal error');
        });

        it('errors on null value', () => {
            executeMock.mockReturnValue({
                data: {
                    node: null,
                },
            });

            expect(() => nodeIdFieldResolver(inputKey, {}, context, resolveInfo))
                .toThrowError('Failed to self look up ID: returned no data');
        });

        it('works synchronously', () => {
            executeMock.mockReturnValue({
                data: {
                    node: {
                        __typename: 'TestType',
                        field3: 999,
                        field4: {
                            subField1: 'test',
                            subField2: 10,
                        },
                    },
                },
            });

            expect(nodeIdFieldResolver(inputKey, {}, context, resolveInfo))
                .toEqual('{"__typename":"TestType","field3":999,"field4":{"subField1":"test","subField2":10}}');

            expect(executeMock)
                .toHaveBeenCalledWith({
                    contextValue: context,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    document: expect.anything(),
                    schema,
                    variableValues: {
                        id: '{"__typename":"TestType","field1":"a","field2":10}',
                    },
                });

            expect(print(executeMock.mock.calls[0]?.[0].document))
                .toEqual(
                    print(parse(`
                        query selfIdLookup($id: ID!) {
                            node(id: $id) {
                                __typename
                                ... on TestType {
                                    field3
                                    field4 {
                                        subField1
                                        subField2
                                    }
                                }
                            }
                        }
                    `)),
                );
        });

        it('works asynchronously', async () => {
            executeMock.mockResolvedValue({
                data: {
                    node: {
                        __typename: 'TestType',
                        field3: 999,
                        field4: {
                            subField1: 'test',
                            subField2: 10,
                        },
                    },
                },
            });

            await expect(nodeIdFieldResolver(inputKey, {}, context, resolveInfo))
                .resolves
                .toEqual('{"__typename":"TestType","field3":999,"field4":{"subField1":"test","subField2":10}}');

            expect(executeMock)
                .toHaveBeenCalledWith({
                    contextValue: context,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    document: expect.anything(),
                    schema,
                    variableValues: {
                        id: '{"__typename":"TestType","field1":"a","field2":10}',
                    },
                });
        });
    });
});

describe('addNodeIdField', () => {
    it('errors if the id field exists', () => {
        expect(() => addNodeIdField({
            id: {
                type: GraphQLID,
            },
        })).toThrow('Type already has an id field when trying to create Node.id');
    });

    it('adds an id field with resolver', () => {
        expect(addNodeIdField({
            existingField: {
                type: GraphQLID,
            },
        })).toEqual({
            existingField: {
                type: GraphQLID,
            },
            id: {
                type: new GraphQLNonNull(GraphQLID),
                resolve: nodeIdFieldResolver,
            },
        });
    });
});
