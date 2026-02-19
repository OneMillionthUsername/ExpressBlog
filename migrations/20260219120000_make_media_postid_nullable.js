/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // MariaDB requires dropping FK before altering nullability
  const hasTable = await knex.schema.hasTable('media');
  if (!hasTable) return;
  const hasPostId = await knex.schema.hasColumn('media', 'postId');

  // Drop FK if it exists (ignore if missing)
  if (hasPostId) {
    try {
      await knex.schema.alterTable('media', (table) => {
        table.dropForeign(['postId']);
      });
    } catch { /* ignore if FK missing */ }
  }

  // Some older schemas may not have postId at all
  if (!hasPostId) {
    await knex.schema.alterTable('media', (table) => {
      table.bigInteger('postId').nullable();
    });
  } else {
    await knex.schema.alterTable('media', (table) => {
      table.bigInteger('postId').nullable().alter();
    });
  }

  // Re-add FK with SET NULL semantics
  try {
    await knex.schema.alterTable('media', (table) => {
      table.foreign('postId').references('posts.id').onDelete('SET NULL').onUpdate('CASCADE');
      table.index('postId');
    });
  } catch { /* ignore */ }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  const hasTable = await knex.schema.hasTable('media');
  if (!hasTable) return;
  const hasPostId = await knex.schema.hasColumn('media', 'postId');
  if (!hasPostId) return;

  try {
    await knex.schema.alterTable('media', (table) => {
      table.dropForeign(['postId']);
    });
  } catch { /* ignore */ }

  await knex.schema.alterTable('media', (table) => {
    table.bigInteger('postId').notNullable().alter();
  });

  try {
    await knex.schema.alterTable('media', (table) => {
      table.foreign('postId').references('posts.id').onDelete('CASCADE').onUpdate('CASCADE');
      table.index('postId');
    });
  } catch { /* ignore */ }
};

