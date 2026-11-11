export type DbObject = {
  oid: number;
  schema: string;
  name: string;
  kind:
    | 'table'
    | 'view'
    | 'materialized_view'
    | 'sequence'
    | 'function'
    | 'procedure'
    | 'index'
    | 'trigger';
  owner: string;
  comment: string | null;
  rows?: number;
  size?: string;
  parent?: string;
  args?: string;
};
export type DbColumn = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  identity: string;
  generated: string;
  primary: boolean;
  position: number;
};
export type DbConstraint = {
  name: string;
  type: string;
  definition: string;
  reference_oid: number | null;
};
export type ObjectDetails = {
  object: DbObject;
  columns: DbColumn[];
  constraints: DbConstraint[];
  indexes: { name: string; definition: string }[];
  definition: string;
};
export type Catalog = {
  database: {
    name: string;
    user: string;
    version: string;
    size: string;
    tables: number;
    views: number;
    functions: number;
  };
  schemas: string[];
  objects: DbObject[];
  types: Record<string, string>;
  columns: { oid: number; name: string; type: string; primary: boolean }[];
  relations: { from: number; to: number; name: string; definition: string }[];
};
export type SqlField = { name: string; dataTypeID: number; tableID: number; columnID: number };
export type SqlResult = {
  fields: SqlField[];
  rows: (string | null)[][];
  rowCount: number;
  command: string;
  truncated: boolean;
};
export type SqlError = {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  position?: number;
  line?: number;
  column?: number;
  constraint?: string;
};
export type SqlResponse = {
  results: SqlResult[];
  messages: string[];
  error?: SqlError;
  duration: number;
  rolledBack: boolean;
  mode: 'execute' | 'preview' | 'explain' | 'analyze';
};
export type QueryTab = { id: string; name: string; sql: string };
export type HistoryEntry = {
  id: string;
  sql: string;
  at: string;
  duration: number;
  rows: number;
  success: boolean;
  mode: string;
};
export type Snippet = {
  id: string;
  title: string;
  category: string;
  description: string;
  sql: string;
};
