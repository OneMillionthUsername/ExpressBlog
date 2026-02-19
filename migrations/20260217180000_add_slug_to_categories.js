/**
 * Migration: Add slug to categories table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  const hasTable = await knex.schema.hasTable('categories');
  if (!hasTable) return;
  const hasSlug = await knex.schema.hasColumn('categories', 'slug');
  if (hasSlug) return;

  await knex.schema.alterTable('categories', (table) => {
    table.string('slug', 100).notNullable().unique().after('name');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  const hasTable = await knex.schema.hasTable('categories');
  if (!hasTable) return;
  const hasSlug = await knex.schema.hasColumn('categories', 'slug');
  if (!hasSlug) return;

  await knex.schema.alterTable('categories', (table) => {
    table.dropColumn('slug');
  });
};
