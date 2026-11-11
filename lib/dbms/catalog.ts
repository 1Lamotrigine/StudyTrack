import type { PGlite } from '@electric-sql/pglite';
import type {
  Catalog,
  DbObject,
  ObjectDetails,
  DbColumn,
  DbConstraint,
} from '@/features/dbms/types';
import { qualified, quoteIdentifier } from './sql';
export async function readCatalog(db: PGlite): Promise<Catalog> {
  const database = (
    await db.query<
      Catalog['database']
    >(`SELECT current_database() name,current_user "user",version() version,pg_size_pretty(pg_database_size(current_database())) size,
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND relkind IN ('r','p')) tables,
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND relkind IN ('v','m')) views,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') functions`)
  ).rows[0];
  const objects = (
    await db.query<DbObject>(`SELECT c.oid::int,n.nspname schema,c.relname name,CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' WHEN 'S' THEN 'sequence' ELSE 'index' END kind,pg_get_userbyid(c.relowner) owner,obj_description(c.oid,'pg_class') comment,
 CASE WHEN c.relkind IN ('r','p','m') THEN greatest(c.reltuples,0)::int ELSE NULL END rows,
 CASE WHEN c.relkind IN ('r','p','m','i') THEN pg_size_pretty(pg_total_relation_size(c.oid)) ELSE NULL END size,NULL::text parent,NULL::text args
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','S','i')
 UNION ALL SELECT p.oid::int,n.nspname,p.proname,CASE WHEN p.prokind='p' THEN 'procedure' ELSE 'function' END,pg_get_userbyid(p.proowner),obj_description(p.oid,'pg_proc'),NULL,NULL,NULL,pg_get_function_identity_arguments(p.oid)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND p.prokind IN ('f','p')
 UNION ALL SELECT t.oid::int,n.nspname,t.tgname,'trigger',pg_get_userbyid(c.relowner),obj_description(t.oid,'pg_trigger'),NULL,NULL,c.relname,NULL
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 ORDER BY schema,kind,name`)
  ).rows;
  const schemas = (
    await db.query<{ name: string }>(
      "SELECT nspname name FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema' ORDER BY nspname",
    )
  ).rows.map((r) => r.name);
  const types = Object.fromEntries(
    (
      await db.query<{ oid: number; name: string }>(
        'SELECT oid::int,format_type(oid,NULL) name FROM pg_type',
      )
    ).rows.map((r) => [String(r.oid), r.name]),
  );
  const relations = (
    await db.query<Catalog['relations'][number]>(
      'SELECT conrelid::int "from",confrelid::int "to",conname name,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE contype=\'f\'',
    )
  ).rows;
  const columns = (
    await db.query<Catalog['columns'][number]>(
      `SELECT a.attrelid::int oid,a.attname name,format_type(a.atttypid,a.atttypmod) type,EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=a.attrelid AND i.indisprimary AND a.attnum=ANY(i.indkey)) "primary" FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY a.attrelid,a.attnum`,
    )
  ).rows;
  return { database, objects, schemas, types, relations, columns };
}
export async function readObject(db: PGlite, oid: number, kind?: string): Promise<ObjectDetails> {
  const catalog = await readCatalog(db);
  const object = catalog.objects.find((o) => o.oid === oid && (!kind || o.kind === kind));
  if (!object) throw new Error('Объект не найден. Обновите дерево объектов.');
  let columns: DbColumn[] = [],
    constraints: DbConstraint[] = [],
    indexes: { name: string; definition: string }[] = [],
    definition = '';
  const full = qualified(object.schema, object.name);
  if (['table', 'view', 'materialized_view'].includes(object.kind)) {
    columns = (
      await db.query<DbColumn>(
        `SELECT a.attname name,format_type(a.atttypid,a.atttypmod) type,NOT a.attnotnull nullable,pg_get_expr(d.adbin,d.adrelid) "default",a.attidentity identity,a.attgenerated generated,a.attnum position,
 EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=a.attrelid AND i.indisprimary AND a.attnum=ANY(i.indkey)) "primary"
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,
        [oid],
      )
    ).rows;
    constraints = (
      await db.query<DbConstraint>(
        'SELECT conname name,contype type,pg_get_constraintdef(oid,true) definition,NULLIF(confrelid,0)::int reference_oid FROM pg_constraint WHERE conrelid=$1 ORDER BY contype,conname',
        [oid],
      )
    ).rows;
    indexes = (
      await db.query<{ name: string; definition: string }>(
        'SELECT c.relname name,pg_get_indexdef(c.oid) definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid=$1 ORDER BY c.relname',
        [oid],
      )
    ).rows;
    if (object.kind === 'table')
      definition = `-- DDL для ${full}\nCREATE TABLE ${full} (\n${[...columns.map((c) => `    ${quoteIdentifier(c.name)} ${c.type}${c.generated ? ` GENERATED ALWAYS AS (${c.default}) STORED` : c.identity ? ` GENERATED ${c.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY` : c.default ? ` DEFAULT ${c.default}` : ''}${!c.nullable ? ' NOT NULL' : ''}`), ...constraints.filter((c) => c.type !== 'n').map((c) => `    CONSTRAINT ${quoteIdentifier(c.name)} ${c.definition}`)].join(',\n')}\n);\n\n${indexes
        .filter((i) => !constraints.some((c) => c.name === i.name))
        .map((i) => i.definition + ';')
        .join('\n')}`;
    else
      definition = `CREATE OR REPLACE ${object.kind === 'materialized_view' ? 'MATERIALIZED VIEW' : 'VIEW'} ${full} AS\n${(await db.query<{ definition: string }>('SELECT pg_get_viewdef($1,true) definition', [oid])).rows[0].definition}`;
  } else if (object.kind === 'function' || object.kind === 'procedure')
    definition = (
      await db.query<{ definition: string }>('SELECT pg_get_functiondef($1) definition', [oid])
    ).rows[0].definition;
  else if (object.kind === 'index')
    definition =
      (await db.query<{ definition: string }>('SELECT pg_get_indexdef($1) definition', [oid]))
        .rows[0].definition + ';';
  else if (object.kind === 'trigger')
    definition =
      (
        await db.query<{ definition: string }>('SELECT pg_get_triggerdef($1,true) definition', [
          oid,
        ])
      ).rows[0].definition + ';';
  else if (object.kind === 'sequence') {
    const seq = (
      await db.query<{
        seqstart: string;
        seqincrement: string;
        seqmin: string;
        seqmax: string;
        seqcache: string;
        seqcycle: boolean;
      }>('SELECT * FROM pg_sequence WHERE seqrelid=$1', [oid])
    ).rows[0];
    definition = `CREATE SEQUENCE ${full}\n    START WITH ${seq.seqstart} INCREMENT BY ${seq.seqincrement}\n    MINVALUE ${seq.seqmin} MAXVALUE ${seq.seqmax}\n    CACHE ${seq.seqcache} ${seq.seqcycle ? 'CYCLE' : 'NO CYCLE'};`;
  }
  return { object, columns, constraints, indexes, definition };
}
