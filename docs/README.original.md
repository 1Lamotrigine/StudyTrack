# StudyTrack — учёт учебных заданий и результатов

Индивидуальный проект по дисциплине «Системы управления базами данных» (ТЗ №06).
СУБД: PostgreSQL. Минимальное приложение: Django (тонкий слой без ORM, все расчёты в SQL-объектах БД). Запуск: Docker.

> Данные в проекте вымышленные. Реальные персональные данные не используются.

## 1. Версии

Заполнить фактическими значениями после первого запуска (команды в разделе 8).

| Компонент | Версия |
|---|---|
| PostgreSQL (сервер, образ) | `[postgres:16 — уточнить SELECT version();]` |
| psql / pg_dump / pg_restore (клиент в контейнере) | `[psql --version]` |
| Docker / Docker Compose | `[docker --version]` |
| Python | `[версия из образа web]` |
| Django | `[версия из requirements.txt]` |
| psycopg | `[версия из requirements.txt]` |
| ОС, на которой выполнялась демонстрация | macOS `[версия]` |

## 2. Структура проекта

```
studytrack/
├── docker-compose.yml
├── .env.example              # шаблон; реальный .env в репозиторий не добавляется
├── README.md
├── db/                       # выполняется автоматически при первом создании тома, в алфавитном порядке
│   ├── 01_schema.sql         # DDL: таблицы, PK/FK/UNIQUE/CHECK, GENERATED-столбец, индексы
│   ├── 02_seed.sql           # заполнение учебными данными
│   ├── 03_objects.sql        # VIEW, функция, процедура, триггер
│   ├── 04_roles.sql          # роли PostgreSQL, GRANT/REVOKE
│   └── 05_indexes.sql        # индексы (в т.ч. GIN, составной)
├── sql/                      # запускается вручную через psql
│   ├── queries_Q01-Q16.sql
│   ├── cursor_demo.sql
│   ├── dml_update_delete_demo.sql
│   ├── explain_before_after.sql
│   ├── fts_jsonb_demo.sql
│   ├── transactions_demo.sql
│   ├── isolation_levels_demo.sql
│   ├── tests_10_cases.sql
│   └── sessions/
│       ├── session_a.sql
│       ├── session_b.sql
│       ├── deadlock_a.sql
│       └── deadlock_b.sql
├── app/                      # Django: консольное меню или простая форма
├── docs/
│   ├── er_diagram.(png|pdf)
│   ├── data_dictionary.md
│   ├── normalization.md
│   ├── explanatory_note.pdf  # 5–8 страниц
│   ├── test_results.md       # таблица проверочных случаев
│   └── presentation.(pdf|pptx)  # 7–9 слайдов
└── backup/
    ├── studytrack.dump       # результат pg_dump -Fc
    └── restore_commands.md
```

> Названия файлов `sql/` и `docs/` ориентировочные. После создания проекта привести список в соответствие с реальным.

## 3. Запуск с нуля

### 3.1. Подготовка

```bash
git clone <адрес репозитория> studytrack
cd studytrack
cp .env.example .env
# отредактировать .env: задать DB_PASSWORD и остальные параметры
```

Пример `.env.example`:

```
DB_NAME=studytrack
DB_USER=studytrack
DB_PASSWORD=change_me
DB_HOST=db
DB_PORT=5432
DJANGO_SECRET_KEY=change_me
```

### 3.2. Создание базы и заполнение

```bash
docker compose up -d --build
```

SQL-файлы из `db/` выполняются автоматически при **первом** создании тома `pgdata`.
Если схему нужно пересоздать с нуля:

```bash
docker compose down -v
docker compose up -d --build
```

Проверка:

```bash
docker compose exec db psql -U studytrack -d studytrack -c "\dt"
docker compose exec db psql -U studytrack -d studytrack -c "SELECT version();"
```

### 3.3. Запуск приложения

```bash
docker compose up web
# приложение: http://localhost:8000   (для консольного варианта: docker compose run --rm web python app/cli.py)
```

Приложение работает с готовой схемой (миграции Django не используются: `makemigrations` и `migrate` не запускать).
Запросы выполняются через курсор с параметрами, например:

```python
cur.execute("SELECT * FROM v_course_results WHERE course_id = %s", [course_id])
cur.execute("CALL submit_version(%s, %s, %s)", [student_id, assignment_id, text])
```

## 4. Подключение к базе

Порт контейнера проброшен на хост как `5433` (чтобы не конфликтовать с локальным Postgres, если он есть).

```bash
# psql на хосте
psql -h localhost -p 5433 -U studytrack studytrack

# psql внутри контейнера
docker compose exec db psql -U studytrack -d studytrack
```

pgAdmin (локальная установка): хост `localhost`, порт `5433`, база `studytrack`, пользователь и пароль из `.env`.

Полезные команды psql: `\dt`, `\d table`, `\dv`, `\df`, `\di`, `\du`, `\x`, `\timing`, `\i file.sql`.

## 5. Модель данных (кратко)

Сущности: `users`, `course_categories` (self-FK `parent_id`), `courses`, `enrollments`, `assignments`, `submission_versions`, `grades`.

Ключевые правила:

- номер версии работы уникален в паре «студент — задание» (`UNIQUE`);
- оценка от 0 до максимального балла задания (проверка на уровне функции/процедуры и триггера, так как правило затрагивает две таблицы);
- сдавать работу может только зачисленный студент;
- текущий результат — последняя оценённая версия, прежние оценки сохраняются;
- просроченная сдача помечается явно;
- `parent_id <> id` в категориях (`CHECK`);
- дополнительные параметры задания хранятся в `JSONB`: `submission_format`, `expected_minutes`, `allow_revision`; `expected_minutes` вынесен в вычисляемый индексируемый столбец.

Полное описание: `docs/er_diagram`, `docs/data_dictionary.md`, `docs/normalization.md`.

## 6. Демонстрационные данные

Данные из `db/02_seed.sql`:

- `[N]` пользователей (преподаватели и студенты), `[N]` категорий курсов в иерархии из 3 уровней, `[N]` курсов, `[N]` заданий;
- пустая категория (без курсов), равные оценки для проверки `RANK`/`DENSE_RANK`;
- просроченные сдачи, несколько версий одной работы, исправленные оценки;
- не менее 1000 строк для сравнения планов запросов (`[файл или скрипт генерации]`), малая демонстрационная выборка хранится отдельно;
- ошибочные примеры для проверки ограничений: `[файл]`.

Все значения вымышленные.

## 7. Соответствие ТЗ (чек-лист)

Отмечать только после реальной проверки запуском.

| Раздел ТЗ | Что требуется | Где |
|---|---|---|
| 3 | ER-диаграмма, словарь данных, нормализация | `docs/` |
| 3 | DDL с PK/FK/UNIQUE/CHECK, поведение удаления FK | `db/01_schema.sql` |
| 3 | ≥5 записей справочников, ≥30 операционных, ошибочные примеры | `db/02_seed.sql` |
| 3 | Скрипты изменения и удаления на тестовой записи | `sql/dml_update_delete_demo.sql` |
| 4 | Сдача версии, оценка, исправление, просрочка | `db/03_objects.sql` |
| 5 | VIEW, функция, процедура, триггер | `db/03_objects.sql` |
| 5 | Курсор и обычный SELECT рядом | `sql/cursor_demo.sql` |
| 6 | Q01–Q16 | `sql/queries_Q01-Q16.sql` |
| 7 | Рекурсивный CTE по `parent_id` | Q08 |
| 8 | Полнотекстовый поиск, JSONB, `jsonb_set`, GENERATED-столбец | `sql/fts_jsonb_demo.sql`, `db/05_indexes.sql` |
| 9 | EXPLAIN до и после индекса, составной индекс | `sql/explain_before_after.sql` |
| 9 | BEGIN/COMMIT/ROLLBACK | `sql/transactions_demo.sql` |
| 9 | Два сеанса, блокировка | `sql/sessions/session_a.sql`, `session_b.sql` |
| 9 | READ COMMITTED и REPEATABLE READ | `sql/isolation_levels_demo.sql` |
| 9 | Взаимная блокировка | `sql/sessions/deadlock_a.sql`, `deadlock_b.sql` |
| 10 | Роли, GRANT/REVOKE, проверка `SET ROLE` | `db/04_roles.sql` |
| 10 | pg_dump / pg_restore, проверка восстановленной БД | `backup/restore_commands.md` |
| 10 | Приложение с параметризованными запросами | `app/` |
| 11 | ≥10 проверочных случаев | `sql/tests_10_cases.sql`, `docs/test_results.md` |
| 13 | Записка 5–8 стр., презентация 7–9 слайдов | `docs/` |

## 8. Порядок демонстрации

### 8.1. Основной сценарий

Курс → зачисление → задание → две версии одной работы → оценка версии → выборка текущего результата.

```bash
docker compose exec -T db psql -U studytrack -d studytrack -f /sql/scenario_main.sql
```

Один успешный и один запрещённый вызов (например, оценка выше максимального балла) показываются в `psql` напрямую.

### 8.2. Конфликт двух сеансов

Открыть два терминала.

```bash
# терминал 1
docker compose exec db psql -U studytrack -d studytrack -f /sql/sessions/session_a.sql
# терминал 2 (запустить во время паузы первого скрипта)
docker compose exec db psql -U studytrack -d studytrack -f /sql/sessions/session_b.sql
```

Порядок шагов и ожидаемый результат указаны в комментариях внутри файлов.

### 8.3. Роли

```sql
SET ROLE report_reader;
SELECT * FROM v_course_results LIMIT 5;    -- разрешено
UPDATE courses SET title = 'x' WHERE id = 1; -- ожидается: permission denied
RESET ROLE;
```

> Имена ролей и VIEW заменить фактическими.

### 8.4. Резервная копия и восстановление

```bash
docker compose exec db pg_dump -U studytrack -Fc studytrack > backup/studytrack.dump

docker compose exec db createdb -U studytrack studytrack_restored
docker compose exec -T db pg_restore -U studytrack -d studytrack_restored < backup/studytrack.dump
```

Проверка восстановленной базы:

```bash
docker compose exec db psql -U studytrack -d studytrack_restored -c "SELECT count(*) FROM courses;"
# затем: наличие VIEW/функции/процедуры/триггера, один отчёт, новая операция
```

Если роли создаются отдельным скриптом, выполнить `db/04_roles.sql` до `pg_restore` и проверить права после.

Версии клиента и сервера:

```bash
docker compose exec db pg_dump --version
docker compose exec db psql -U studytrack -d studytrack -c "SELECT version();"
```

## 9. Безопасность

Роль PostgreSQL и запись пользователя в таблице `users` — разные сущности.
В приложении учебный пользователь выбирается явно; параметр `user_id` сам по себе не доказывает личность.
Это учебная демонстрация, а не промышленная защита.
Пароли хранятся в локальном `.env`; в репозитории только `.env.example`.

## 10. Ограничения и допущения

- Django используется как оболочка: без ORM-моделей, без миграций, без `django.contrib.auth` и admin.
- Правила, затрагивающие несколько строк, реализованы в функции/процедуре с блокировкой (`SELECT ... FOR UPDATE`), а не через `CHECK`, читающий другую таблицу.
- Отдельный механизм автоповторов при deadlock не разрабатывался (не требуется ТЗ).
