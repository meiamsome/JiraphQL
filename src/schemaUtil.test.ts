import { buildSchema } from 'graphql';
import { getAllDirectives, isPrimaryType } from './schemaUtil';

describe('schemaUtil', () => {
    const schema = buildSchema(`
        scalar _FieldSet
        directive @key(fields: _FieldSet!) repeatable on OBJECT | INTERFACE

        type Query {
            a: Int!
        }

        type PrimaryType @key(fields: "a") {
            a: Int!
        }

        type PrimaryTypeMultiKey @key(fields: "a") @key(fields: "b") {
            a: Int!
            b: String!
        }

        type ValueType {
            a: Int
        }
    `);

    describe('isPrimaryType', () => {
        it('is true for Query', () => {
            expect(isPrimaryType(schema.getTypeMap().Query, schema)).toBe(true);
        });

        it('is true for PrimaryType', () => {
            expect(isPrimaryType(schema.getTypeMap().PrimaryType, schema)).toBe(true);
        });

        it('is true for PrimaryTypeMultiKey', () => {
            expect(isPrimaryType(schema.getTypeMap().PrimaryTypeMultiKey, schema)).toBe(true);
        });

        it('is false for ValueType', () => {
            expect(isPrimaryType(schema.getTypeMap().ValueType, schema)).toBe(false);
        });
    });

    describe('getAllDirectives', () => {
        it('is empty for Query', () => {
            expect(getAllDirectives(schema.getTypeMap().Query, schema)).toEqual([]);
        });

        it('has one directive for PrimaryType', () => {
            expect(getAllDirectives(schema.getTypeMap().PrimaryType, schema)).toHaveLength(1);
        });

        it('has both directives for PrimaryTypeMultiKey', () => {
            expect(getAllDirectives(schema.getTypeMap().PrimaryTypeMultiKey, schema))
                .toHaveLength(2);
        });

        it('is null for ValueType', () => {
            expect(getAllDirectives(schema.getTypeMap().ValueType, schema)).toBe(null);
        });
    });
});
