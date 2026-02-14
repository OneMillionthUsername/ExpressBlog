/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
    await knex.schema.createTable('categories', (table) => {
        table.increments('id').primary();
        table.string('name', 100).notNullable();
        table.string('description', 500).nullable();
    });
    await knex.schema.alterTable('posts', function(table) {
    // FK
    table.integer('category_id').unsigned().references('id').inTable('categories').onDelete('SET NULL');
    table.index('category_id');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.alterTable('posts', (table) => {
    table.dropForeign(['category_id']);
    table.dropColumn('category_id');
  });
  await knex.schema.dropTableIfExists('categories');
}
