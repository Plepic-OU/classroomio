# ClassroomIO Architecture Reference

## System Context (Layer 1)
- **ClassroomIO** - Open-source LMS for course management, grading, certificates
- **Users**: Students, Instructors, Org Admins
- **External Systems**: SMTP providers, Cloudflare R2/S3, Supabase Auth

## Containers (Layer 2)
| Container | Tech | Port | Description |
|-----------|------|------|-------------|
| Dashboard | SvelteKit | 5173 | Main LMS web app |
| API | Hono | 3002 | Backend for files, PDFs, emails |
| Marketing Site | SvelteKit | 5174 | classroomio.com |
| Docs | SvelteKit | 3000 | Documentation |
| Supabase | PostgreSQL | 54321 | Database + Auth + Edge Functions |
| Cloudflare R2 | S3-compatible | - | File storage |

## Data Flow
1. Dashboard <-> Supabase (auth, CRUD via client SDK)
2. Dashboard -> API (file uploads, PDF generation, emails)
3. API -> Supabase (service role queries)
4. API -> R2/S3 (presigned URLs, file storage)
5. API -> SMTP (email delivery)

## Key Database Tables
profile, course, lesson, group, groupmember, organization, exercise, question, submission, lesson_completion

## Path Aliases
- Dashboard: `$lib` -> `src/lib`, `$mail` -> `src/mail`
- API: `$src` -> `src`
