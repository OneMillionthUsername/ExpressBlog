/**
 * Universal SQL Query Builder
 *
 * @param {string} method - SQL-Operation: 'create', 'get', 'update', 'delete'
 * @param {string} table - Name der Tabelle
 * @param {Object} conditions -
 *   Für 'get' und 'delete': Objekt mit Spaltennamen als Keys und gesuchten Werten als Values (z.B. { id: 5, author: 'admin' })
 *   Für 'create' und 'update': Objekt mit Spaltennamen als Keys und zu setzenden Werten als Values (z.B. { title: 'foo', content: 'bar' })
 * @param {Object} options -
 *   Für 'get':
 *     - orderBy: (string) SQL ORDER BY-Klausel, z.B. 'created_at DESC'
 *     - limit: (number) maximale Anzahl der Ergebnisse
 *     - offset: (number) Offset für die Ergebnisse
 *   Für 'update':
 *     - conditions: Objekt mit WHERE-Bedingungen (z.B. { id: 5 })
 *
 * @returns {{ query: string, params: any[] }} SQL-Query und Parameter-Array
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