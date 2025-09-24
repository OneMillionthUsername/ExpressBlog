/**
 * Universal SQL Query Builder
 *
 * Lightweight helper that produces parametrized SQL and parameter arrays
 * for simple CRUD operations. This helps centralize query construction
 * and keeps raw SQL usage minimal across the codebase.
 */
export default function queryBuilder(method, table, conditions = {}, options = {}) {
  switch (method.toLowerCase()) {
  case 'create':
    return buildInsertQuery(table, conditions);
  case 'get':
    return buildSelectQuery(table, conditions, options);
  case 'update':
    return buildUpdateQuery(table, conditions, options.conditions || {});
  case 'delete':
    return buildDeleteQuery(table, conditions);
  default:
    throw new Error(`Unsupported query method: ${method}`);
  }
}

function buildSelectQuery(table, conditions, options) {
  // Implement the logic to build a SELECT query
  let query = `SELECT * FROM ${table}`;
  const whereClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(conditions)) {
    if (typeof value === 'object' && value !== null && value.like) {
      whereClauses.push(`${key} LIKE ?`);
      params.push(value.like);
    } else {
      whereClauses.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  if (options.orderBy) {
    query += ` ORDER BY ${options.orderBy}`;
  }
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  return { query, params };
}

function buildInsertQuery(table, conditions) {
  const columns = Object.keys(conditions).map(key => `\`${key}\``).join(', ');
  const placeholders = Object.keys(conditions).map(() => '?').join(', ');
  const params = Object.values(conditions);
  const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
  return { query, params };
}

function buildUpdateQuery(table, data, conditions) {
  const setClauses = Object.entries(data).map(([key]) => `\`${key}\` = ?`).join(', ');
  const setParams = Object.values(data);
  const whereClauses = Object.entries(conditions).map(([key]) => `\`${key}\` = ?`).join(' AND ');
  const whereParams = Object.values(conditions);
  const query = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses}`;
  return { query, params: [...setParams, ...whereParams] };
}

function buildDeleteQuery(table, conditions) {
  const whereClauses = Object.entries(conditions).map(([key]) => `\`${key}\` = ?`).join(' AND ');
  const params = Object.values(conditions);
  const query = `DELETE FROM ${table} WHERE ${whereClauses}`;
  return { query, params };
}