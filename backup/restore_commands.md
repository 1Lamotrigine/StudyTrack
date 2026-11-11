# Резервное копирование и восстановление StudyTrack

Проверено: 29.10.2026.

## Версии

| Компонент | Версия |
|---|---|
| Сервер PostgreSQL | `PostgreSQL 16.15` |
| `pg_dump` / `pg_restore` | `16.15 (Debian 16.15-1.pgdg13+2)` |
| Формат дампа | custom (`-Fc`) |
| Размер дампа | около 56 КБ (малая демонстрационная выборка) |

## Создание резервной копии

Из каталога `app/`:

```bash
docker compose exec -T db pg_dump -U studytrack -Fc studytrack > backup/studytrack.dump
```

Файл: `backup/studytrack.dump`.

## Восстановление в отдельную пустую БД

```bash
docker compose exec -T db psql -U studytrack -d postgres \
  -c "DROP DATABASE IF EXISTS studytrack_restored;"

docker compose exec -T db createdb -U studytrack studytrack_restored

docker compose exec -T db pg_restore -U studytrack -d studytrack_restored < backup/studytrack.dump
```

Роли PostgreSQL (`studytrack_app`, `report_reader`) являются объектами кластера,
а не отдельной базы. Они уже созданы скриптом `db/04_roles.sql`; при восстановлении
на другой кластер сначала выполните `db/04_roles.sql`, затем `pg_restore`
(права на объекты входят в дамп).

## Проверка восстановленной базы

```bash
docker compose exec db psql -U studytrack -d studytrack_restored -c "
SELECT (SELECT count(*) FROM assignments)          AS assignments,
       (SELECT count(*) FROM submission_versions) AS versions,
       (SELECT count(*) FROM grades)              AS grades;"

docker compose exec db psql -U studytrack -d studytrack_restored -c "
SELECT count(*) FROM v_course_results;"

docker compose exec db psql -U studytrack -d studytrack_restored -c "
SELECT proname, prokind FROM pg_proc
WHERE pronamespace = 'public'::regnamespace ORDER BY proname;"

docker compose exec db psql -U studytrack -d studytrack_restored -c "
SELECT tgname FROM pg_trigger WHERE NOT tgisinternal;"
```

Фактический результат после восстановления:

| Проверка | Результат |
|---|---|
| `assignments` | 12 |
| `submission_versions` | 48 |
| `grades` | 47 |
| `grade_history` | 1 |
| строк в `v_course_results` | 46 |
| функция/процедуры | `fn_grades_history`, `fn_grades_validate`, `fn_student_course_result`, `grade_version`, `submit_version` |
| триггеры | `trg_grades_history`, `trg_grades_validate` |

## Проверка новой операции в восстановленной БД

```bash
docker compose exec -T db psql -U studytrack -d studytrack_restored -f /sql/restore_verify.sql
```

Скрипт сам передаёт id созданной версии в процедуру оценки (psql `\gset`).

Результат: создана версия, выставлена оценка `95.00`, представление вернуло строку
с `percent = 95.00`; триггер добавил запись в `grade_history` (стало 2 строки).
Это подтверждает, что восстановленная база не только содержит данные, но и принимает
новые операции.

## Примечание

После этого демонстрационная база `studytrack` не изменялась (новая операция
выполнялась в `studytrack_restored`). Для повторной чистой инициализации:

```bash
docker compose down -v
docker compose up -d --build
```
