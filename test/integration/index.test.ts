import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

import { execute, GraphQLSchema, parse } from 'graphql';
import { createSchema } from '../../src';

describe('JraphQL', () => {
    describe('synchronously', () => {
        const schema = createSchema((file) => readFileSync(join(__dirname, 'documents', file)).toString()) as GraphQLSchema;

        it('lets you query Query directly.', () => {
            const result = execute({
                schema,
                document: parse(`
                    query {
                        values
                    }
                `),
            });

            expect(result).toEqual({
                data: {
                    values: [1, 2, 3, 4],
                },
            });
        });
    });

    describe('asynchronously', () => {
        let schema: GraphQLSchema;

        beforeAll(async () => {
            schema = await createSchema(async (file) => (await readFile(join(__dirname, 'documents', file))).toString());
        });

        it('lets you query Query directly.', async () => {
            const result = execute({
                schema,
                document: parse(`
                    query {
                        values
                    }
                `),
            });

            await expect(result).resolves.toEqual({
                data: {
                    values: [1, 2, 3, 4],
                },
            });
        });
    });
});
