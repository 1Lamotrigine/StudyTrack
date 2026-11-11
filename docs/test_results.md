# Результаты проверок StudyTrack

Проверки выполнены 29.10.2026 на чистой базе, созданной из `db/*.sql`
(`docker compose down -v && docker compose up -d --build`).
Команды запускаются из каталога `app/`.

| № | Проверка | Команда | Ожидаемый результат | Фактический результат |
|---|---|---|---|---|
| 1 | Успешная основная операция: сдача и оценка | `tests_10_cases.sql`, тест 1 | Создана версия, выставлена оценка 90 | `version_no=1`, `score=90.00`, `percent=90.00`; затем `ROLLBACK` |
| 2 | Допустимое исправление оценки | тест 2 | Оценка меняется 88 → 90, в истории есть UPDATE, итог не удваивается | `old_score=88.00`, `new_score=90.00`, `action=UPDATE`; `v_course_results.score=90.00` |
| 3 | Отказ FK | тест 3 | Вставка зачисления на несуществующий курс запрещена | `ERROR: violates foreign key constraint "enrollments_course_fk"` |
| 4 | Отказ UNIQUE и CHECK | тест 4 | Дубликат версии и `parent_id=id` запрещены | `duplicate key ... submission_versions_unique_version`; `violates check constraint course_categories_no_self_parent` |
| 5 | Отказ предметного правила | тест 5 | Повторная сдача при `allow_revision=false` и оценка «чужим» преподавателем запрещены | `Повторная сдача задания 3 запрещена`; `Преподаватель 2 не ведёт курс 2` |
| 6 | Два сеанса: блокировка | `sessions/session_a.sql` + `session_b.sql` | B ждёт освобождения строки, затем создаёт версию | B ожидал ~10 с (пока A спал 12 с), создана версия `version_no=2`, дубликата нет |
| 7 | Два сеанса: deadlock | `sessions/deadlock_a.sql` + `deadlock_b.sql` | Одна транзакция откатывается с `deadlock detected` | A: `ERROR: deadlock detected`; B: `COMMIT`, данные согласованы |
| 8 | Откат без частичного результата | тест 7 | Число версий до/внутри/после: 1 → 2 → 1 | `versions_before=1`, `versions_inside=2`, `versions_after=1` |
| 9 | Отчёт совпадает с ручным расчётом | тест 8 | Задание 3: среднее (19+18+15+18+17+16)/6 = 17.17; курс 2 = 85.33 | `graded_versions=6`, `avg_score=17.17`; `course_avg_percent=85.33` |
| 10 | Поиск и JSONB | тест 9 | Поиск «эссе» находит 1 задание; JSONB-формат `zip` читается; неверный тип отклоняется | `fts_found=1`; три строки с `zip`; `invalid input syntax for type integer: "abc"` |
| 11 | Роль чтения | тест 10 | SELECT из VIEW разрешён, UPDATE запрещён | `view_rows=46`; `ERROR: permission denied for table courses` |
| 12 | Восстановленная БД | `restore_verify.sql` | Объекты и данные на месте, новая операция работает | 12 заданий, 48 версий, 47 оценок; 2 VIEW, 5 процедур/функций, 2 триггера; новая версия оценена на 95.00 |
| 13 | Вход и разграничение доступа | веб-интерфейс, `/login/` | Верные учётные данные пускают, неверные — отклоняют; роли видят только разрешённое | `student`/`teacher`/`admin` вошли (302); неверный пароль — сообщение об ошибке; студент на `/reports/` и `/versions/*/grade/` получает 403 |
| 14 | Защита хеша пароля | `roles_demo.sql` | Прямой SELECT `password_hash` рабочей ролью запрещён, функция `fn_login_lookup` работает | `ERROR: permission denied for table users`; `fn_login_lookup('teacher')` вернул строку под `studytrack_app` |
| 15 | Админ-панель: доступ | веб-интерфейс, `/admin/` | Пускает только роль admin | admin → 200 на всех разделах; студент и преподаватель → 403 |
| 16 | Админ-панель: CRUD | веб-интерфейс | Создание пользователя, категории, курса, задания, зачисление проходят | Все операции вернули 302 и строки появились в БД; журнал зафиксировал 6 операций |
| 17 | Админ-панель: защита на уровне БД | `roles_demo.sql` | Прямые INSERT/UPDATE структуры запрещены; процедура проверяет роль | `permission denied for table courses`; `Операция доступна только администратору (у student)` |
| 18 | Пароль нового пользователя | веб-интерфейс | Показывается один раз и подходит для входа | Сгенерированный пароль принят входом; при повторном открытии страницы не отображается |

## Ключевые фрагменты вывода

### Успешная операция и текущий результат

```
 version_no | score | percent
------------+-------+---------
          1 | 90.00 |   90.00
```

### Исправление оценки

```
 old_score | new_score | action
-----------+-----------+--------
     88.00 |     90.00 | UPDATE
```

### Откат

```
 versions_before = 1
 versions_inside = 2
 versions_after  = 1
```

### Отчёты

```
 assignment_id | graded_versions | avg_score
---------------+-----------------+-----------
             3 |               6 |     17.17

 course_avg_percent
--------------------
              85.33
```

### Блокировка двух сеансов

Сеанс B (фрагмент `\timing`):

```
 p_version_id
--------------
         1053
Time: 9992.337 ms
```

Сеанс A удерживал строку задания 5 двенадцать секунд; B ожидал освобождения,
затем создал следующую версию. Итоговый `version_no=2`, дубликата нет.

### Взаимная блокировка

```
A: ERROR:  deadlock detected
DETAIL:  Process 747 waits for ShareLock on transaction 799; blocked by process 746.
B: UPDATE 1
B: COMMIT
```

### Восстановление

```
 assignments | versions | grades | history
-------------+----------+--------+---------
          12 |       48 |     47 |       1

 views | routines | triggers | assignments | versions
-------+----------+----------+-------------+----------
     2 |        5 |        2 |          12 |       48
```

## Как воспроизвести

```bash
cd app
cp .env.example .env
docker compose up -d --build

docker compose exec -T db psql -U studytrack -d studytrack -f /sql/tests_10_cases.sql
docker compose exec -T db psql -U studytrack -d studytrack -f /sql/scenario_main.sql
docker compose exec -T db psql -U studytrack -d studytrack -f /sql/queries_Q01_Q16.sql
docker compose exec -T db psql -U studytrack -d studytrack -f /sql/fts_jsonb_demo.sql
docker compose exec -T db psql -U studytrack -d studytrack -f /sql/isolation_levels_demo.sql
docker compose exec -T db psql -U studytrack -d studytrack -f /sql/roles_demo.sql
```

Аутентификация и роли проверяются в браузере: http://localhost:8000/login/
(учётные записи `student` / `teacher` / `admin`).

Два сеанса и deadlock запускаются в двух терминалах по инструкциям в
`sql/sessions/*.sql`. Резервная копия и восстановление — в
`backup/restore_commands.md`.
