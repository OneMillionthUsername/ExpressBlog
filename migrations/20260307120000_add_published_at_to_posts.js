/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.alterTable('posts', (table) => {
    table.timestamp('published_at').nullable().defaultTo(null);
  });
  // Backfill: posts that are currently published get published_at = updated_at (best approximation)
  await knex.raw('UPDATE posts SET published_at = updated_at WHERE published = 1');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.alterTable('posts', (table) => {
    table.dropColumn('published_at');
  });
};
