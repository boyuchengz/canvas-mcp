# Tool reference

All tools are annotated with `readOnlyHint: true`. IDs are Canvas numeric IDs; get them from the `list_*` tools.
Dates are ISO 8601 strings in UTC, exactly as Canvas returns them. Fields Canvas doesn't provide are omitted.

On failure a tool returns `isError: true` with the Canvas status code and the first 300 characters of the response, e.g. `Canvas API 401 Unauthorized: ...`.

- [Courses](#courses)
- [Coursework](#coursework)
- [Grades](#grades)
- [Files](#files)
- [Communication](#communication)

---

## Courses

### `list_courses`

Active courses for the token owner. Call this first to discover `course_id` values.

**Parameters:** none

**Returns:** `[{ id, name, code, term }]`

**Canvas endpoint:** `GET /api/v1/courses?enrollment_state=active&include[]=term`

### `get_syllabus`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |

**Returns:** `{ course, syllabus }`. `syllabus` is plain text, or a placeholder if the instructor didn't post one in Canvas.

### `get_front_page`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |

**Returns:** `{ title, updated_at, body, url }`

### `list_modules`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |

**Returns:** `[{ id, name, state, items: [{ title, type, page_url, content_id, url }] }]`

Use `page_url` with `get_page`, and `content_id` with `get_assignment`, `get_quiz`, `get_file` or `get_discussion` depending on `type`.

### `list_pages`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |

**Returns:** `[{ title, page_url, updated_at, front_page }]`, most recently updated first.

### `get_page`

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `course_id` | integer | yes | |
| `page_url` | string | yes | Page slug, e.g. `week-3-notes` |

**Returns:** `{ title, updated_at, body, url }`

### `list_course_staff`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |

**Returns:** `[{ name, role, email, bio }]`. `email` depends on the institution's privacy settings.

### `list_groups`

**Parameters:** none

**Returns:** `[{ id, name, course_id, members }]`

---

## Coursework

### `get_upcoming`

Everything with a date in the planner (assignments, quizzes, graded discussions, to-do items) across all courses. The best starting point for "what's due" questions.

| Parameter | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `days` | integer | no | `7` | 1–60 |

**Returns:** `[{ course, course_id, type, title, due_at, points, submitted, graded, missing, url }]`, sorted by date.

**Canvas endpoint:** `GET /api/v1/planner/items`

### `get_todo`

The Canvas To Do sidebar: items that still need a submission.

**Returns:** `[{ type, course_id, title, due_at, points, url }]`

### `get_missing`

Past-due, submittable assignments with no submission, across all courses.

**Returns:** `[{ course, course_id, assignment_id, name, due_at, lock_at, points_possible, url }]`

### `list_assignments`

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `course_id` | integer | yes | |
| `bucket` | enum | no | `past`, `overdue`, `undated`, `ungraded`, `unsubmitted`, `upcoming`, `future` |

**Returns:** `[{ id, name, due_at, lock_at, points_possible, submission_types, state, submitted_at, score, grade, late, missing, url }]`

### `get_assignment`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |
| `assignment_id` | integer | yes |

**Returns:**

```jsonc
{
  "name": "...",
  "due_at": "...",
  "points_possible": 100,
  "submission_types": ["online_upload"],
  "allowed_attempts": -1,
  "instructions": "plain text",
  "rubric": [{ "criterion": "...", "points": 10 }],
  "submission": {
    "state": "graded",
    "submitted_at": "...",
    "score": 92,
    "grade": "92",
    "late": false,
    "comments": [{ "author": "...", "at": "...", "comment": "..." }]
  },
  "url": "..."
}
```

### `list_quizzes`

Classic Quizzes only. New Quizzes are listed by `list_assignments`.

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |

**Returns:** `[{ id, title, type, due_at, unlock_at, lock_at, time_limit_min, allowed_attempts, questions, points_possible, locked_for_user, url }]`

### `get_quiz`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |
| `quiz_id` | integer | yes |

**Returns:** quiz settings plus `my_attempts: [{ attempt, state, started_at, finished_at, score, kept_score, time_spent_sec }]`. Question content is not available to students through the API.

### `get_calendar_events`

Calendar events created by instructors (lectures, exams, office hours). Assignment due dates are not included; use `get_upcoming`.

| Parameter | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `days` | integer | no | `14` | 1–120 |
| `course_id` | integer | no | | Omit for all active courses (first 10) |

**Returns:** `[{ title, course, start_at, end_at, location, description, url }]`

---

## Grades

### `get_grades`

**Parameters:** none

**Returns:** `[{ course_id, course, current_score, current_grade, final_score, final_grade }]`

`current_*` counts graded work only; `final_*` treats ungraded work as zero.

### `get_grade_breakdown`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |

**Returns:**

```jsonc
{
  "course": "...",
  "weighted_groups": true,
  "current_score": 91.4,
  "current_grade": "A-",
  "groups": [
    {
      "name": "Exams",
      "weight_percent": 40,
      "drop_lowest": 0,
      "drop_highest": 0,
      "assignments": [
        { "id": 1, "name": "Midterm", "due_at": "...", "points_possible": 100,
          "score": 88, "state": "graded", "excused": false, "omit_from_final_grade": false }
      ]
    }
  ]
}
```

This contains everything needed to answer "what do I need on the final" questions.

---

## Files

### `list_files`

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `course_id` | integer | yes | |
| `search` | string | no | Partial file name, at least 2 characters |

**Returns:** `[{ id, name, folder, type, size_kb, updated_at }]`, most recently updated first.

Some courses hide the Files tab from students; Canvas then returns `401` or `403`.

### `get_file`

| Parameter | Type | Required |
| --- | --- | --- |
| `file_id` | integer | yes |

**Returns:** `{ id, name, type, size_kb, updated_at, download_url, content }`

`content` is included for text-based files (plain text, Markdown, HTML, CSV, JSON, XML, source code) up to 1 MB. PDFs, slides and Office documents are not parsed; the `download_url` is a short-lived pre-signed link.

---

## Communication

### `get_announcements`

| Parameter | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `course_id` | integer | no | | Omit for all active courses |
| `days` | integer | no | `14` | How far back, 1–120 |

**Returns:** `[{ course, title, posted_at, author, message, url }]`

### `list_discussions`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |

**Returns:** `[{ id, title, author, posted_at, last_reply_at, replies, unread, graded, due_at, locked, url }]`

### `get_discussion`

| Parameter | Type | Required |
| --- | --- | --- |
| `course_id` | integer | yes |
| `topic_id` | integer | yes |

**Returns:** `{ title, author, posted_at, require_initial_post, prompt, replies, replies_unavailable, url }`

`replies` is a nested tree of `{ author, at, message, replies }`, capped at 150 entries. If the topic requires an initial post before replies are visible, `replies_unavailable` explains why.

### `list_inbox`

| Parameter | Type | Required | Default |
| --- | --- | --- | --- |
| `scope` | enum | no | `inbox` (`unread`, `starred`, `sent`, `archived`) |

**Returns:** `[{ id, subject, course, participants, last_message_at, unread, preview }]`

### `get_inbox_message`

| Parameter | Type | Required |
| --- | --- | --- |
| `conversation_id` | integer | yes |

**Returns:** `{ subject, course, messages: [{ from, at, body, attachments }] }`

Requested with `auto_mark_as_read=false`, so reading a thread does not change its unread state.

### `get_recent_activity`

| Parameter | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `limit` | integer | no | `30` | 1–100 |

**Returns:** `[{ type, course_id, title, at, message, score, grade, url }]`
