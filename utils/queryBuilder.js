export default function queryBuilder(method, table, data = {}, options = {}) {
  switch (method.toLowerCase()) {
    case 'create':
      return buildInsertQuery(table, data);
    case 'read':
      return buildSelectQuery(table, data, options);
    case 'update':
      return buildUpdateQuery(table, data, options.conditions || {});
    case 'delete':
      return buildDeleteQuery(table, data);
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
    whereClauses.push(`${key} = ?`);
    params.push(value);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  if (options.orderBy) {
    query += ` ORDER BY ${options.orderBy}`;
  }
  if (options.limit) {
    query += ` LIMIT ?`;
    params.push(options.limit);
  }

  if (options.offset) {
    query += ` OFFSET ?`;
    params.push(options.offset);
  }

  return { query, params };
}

function buildInsertQuery(table, data) {
  const columns = Object.keys(data).map(key => `\`${key}\``).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const params = Object.values(data);
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