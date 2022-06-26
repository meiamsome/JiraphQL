import {
    GraphQLID,
    GraphQLInputObjectType,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLSchema,
    Kind,
} from 'graphql';
import { parseKeyFields } from './graphqlUtil';
import { createFieldName, createInputArgs } from './queryByKey';

describe('createFieldName', () => {
    it('generates a single field name', () => {
        expect(createFieldName(
            'TestType',
            {
                kind: Kind.SELECTION_SET,
                selections: [
                    {
                        kind: Kind.FIELD,
                        name: {
                            kind: Kind.NAME,
                            value: 'uuid',
                        },
                    },
                ],
            },
        ))
            .toEqual('testTypeByUuid');
    });

    it('generates a complex field name', () => {
        expect(createFieldName(
            'TestType',
            {
                kind: Kind.SELECTION_SET,
                selections: [
                    {
                        kind: Kind.FIELD,
                        name: {
                            kind: Kind.NAME,
                            value: 'uuid',
                        },
                    },
                    {
                        kind: Kind.FIELD,
                        name: {
                            kind: Kind.NAME,
                            value: 'nested',
                        },
                        selectionSet: {
                            kind: Kind.SELECTION_SET,
                            selections: [
                                {
                                    kind: Kind.FIELD,
                                    name: {
                                        kind: Kind.NAME,
                                        value: 'value1',
                                    },
                                },
                                {
                                    kind: Kind.FIELD,
                                    name: {
                                        kind: Kind.NAME,
                                        value: 'value2',
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        ))
            .toEqual('testTypeByUuidNested_Value1Value2_');
    });
});

describe('createInputArgs', () => {
    it('works for a single field', () => {
        const type = new GraphQLObjectType({
            name: 'TestType',
            fields: {
                uuid: {
                    type: new GraphQLNonNull(GraphQLID),
                },
            },
        });
        const schema = new GraphQLSchema({
            types: [type],
            query: type,
        });

        const [inputs, args] = createInputArgs(
            schema,
            type,
            parseKeyFields('uuid'),
            [type, GraphQLID],
        );

        expect(inputs).toEqual([]);
        expect(args).toEqual({
            uuid: {
                type: new GraphQLNonNull(GraphQLID),
            },
        });
    });

    it('works for nested field', () => {
        const type = new GraphQLObjectType({
            name: 'TestType',
            fields: {
                uuid: {
                    type: new GraphQLNonNull(GraphQLID),
                },
            },
        });
        const type2 = new GraphQLObjectType({
            name: 'TestType2',
            fields: {
                uuid: {
                    type: new GraphQLNonNull(GraphQLID),
                },
                type2: {
                    type: new GraphQLNonNull(type),
                },
            },
        });
        const schema = new GraphQLSchema({
            types: [type, type2],
            query: type,
        });

        const [inputs, args] = createInputArgs(
            schema,
            type2,
            parseKeyFields('uuid type2 { uuid }'),
            [type, type2, GraphQLID],
        );

        expect(inputs).toHaveLength(1);
        expect(inputs[0]).toBeInstanceOf(GraphQLInputObjectType);
        expect(inputs[0].name).toEqual(expect.stringMatching(/^TestType2Type2Input[a-z0-9]{32}$/));
        expect(args).toEqual({
            uuid: {
                type: new GraphQLNonNull(GraphQLID),
            },
            type2: {
                type: new GraphQLNonNull(inputs[0]),
            },
        });
    });
});
