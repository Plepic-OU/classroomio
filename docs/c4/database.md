# Database Schema

Source: local Supabase Postgres. Generated: 2026-05-15T07:42:37Z

## Schema: _realtime

### _realtime.extensions

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| type | text | YES |  |
| settings | jsonb | YES |  |
| tenant_external_id | text | YES |  |
| inserted_at | timestamp | NO |  |
| updated_at | timestamp | NO |  |

~-1 rows

### _realtime.schema_migrations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| version | int8 | NO |  |
| inserted_at | timestamp | YES |  |

~-1 rows

### _realtime.tenants

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| name | text | YES |  |
| external_id | text | YES |  |
| jwt_secret | text | YES |  |
| max_concurrent_users | int4 | NO | 200 |
| inserted_at | timestamp | NO |  |
| updated_at | timestamp | NO |  |
| max_events_per_second | int4 | NO | 100 |
| postgres_cdc_default | text | YES | 'postgres_cdc_rls'::text |
| max_bytes_per_second | int4 | NO | 100000 |
| max_channels_per_client | int4 | NO | 100 |
| max_joins_per_second | int4 | NO | 500 |
| suspend | bool | YES | false |
| jwt_jwks | jsonb | YES |  |
| notify_private_alpha | bool | YES | false |
| private_only | bool | NO | false |
| migrations_ran | int4 | YES | 0 |
| broadcast_adapter | varchar | YES | 'gen_rpc'::character varying |
| max_presence_events_per_second | int4 | YES | 1000 |
| max_payload_size_in_kb | int4 | YES | 3000 |

~-1 rows

## Schema: auth

### auth.audit_log_entries

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| instance_id | uuid | YES |  |
| id | uuid | NO |  |
| payload | json | YES |  |
| created_at | timestamptz | YES |  |
| ip_address | varchar | NO | ''::character varying |

PK: `id`

~-1 rows

### auth.flow_state

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| user_id | uuid | YES |  |
| auth_code | text | YES |  |
| code_challenge_method | code_challenge_method | YES |  |
| code_challenge | text | YES |  |
| provider_type | text | NO |  |
| provider_access_token | text | YES |  |
| provider_refresh_token | text | YES |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |
| authentication_method | text | NO |  |
| auth_code_issued_at | timestamptz | YES |  |
| invite_token | text | YES |  |
| referrer | text | YES |  |
| oauth_client_state_id | uuid | YES |  |
| linking_target_id | uuid | YES |  |
| email_optional | bool | NO | false |

PK: `id`

~-1 rows

### auth.identities

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| provider_id | text | NO |  |
| user_id | uuid | NO |  |
| identity_data | jsonb | NO |  |
| provider | text | NO |  |
| last_sign_in_at | timestamptz | YES |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |
| email | text | YES |  |
| id | uuid | NO | gen_random_uuid() |

PK: `id`

~-1 rows

### auth.instances

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| uuid | uuid | YES |  |
| raw_base_config | text | YES |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |

PK: `id`

~-1 rows

### auth.mfa_amr_claims

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| session_id | uuid | NO |  |
| created_at | timestamptz | NO |  |
| updated_at | timestamptz | NO |  |
| authentication_method | text | NO |  |
| id | uuid | NO |  |

PK: `id`

~-1 rows

### auth.mfa_challenges

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| factor_id | uuid | NO |  |
| created_at | timestamptz | NO |  |
| verified_at | timestamptz | YES |  |
| ip_address | inet | NO |  |
| otp_code | text | YES |  |
| web_authn_session_data | jsonb | YES |  |

PK: `id`

~-1 rows

### auth.mfa_factors

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| user_id | uuid | NO |  |
| friendly_name | text | YES |  |
| factor_type | factor_type | NO |  |
| status | factor_status | NO |  |
| created_at | timestamptz | NO |  |
| updated_at | timestamptz | NO |  |
| secret | text | YES |  |
| phone | text | YES |  |
| last_challenged_at | timestamptz | YES |  |
| web_authn_credential | jsonb | YES |  |
| web_authn_aaguid | uuid | YES |  |
| last_webauthn_challenge_data | jsonb | YES |  |

PK: `id`

~-1 rows

### auth.oauth_authorizations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| authorization_id | text | NO |  |
| client_id | uuid | NO |  |
| user_id | uuid | YES |  |
| redirect_uri | text | NO |  |
| scope | text | NO |  |
| state | text | YES |  |
| resource | text | YES |  |
| code_challenge | text | YES |  |
| code_challenge_method | code_challenge_method | YES |  |
| response_type | oauth_response_type | NO | 'code'::auth.oauth_response_type |
| status | oauth_authorization_status | NO | 'pending'::auth.oauth_authorization_status |
| authorization_code | text | YES |  |
| created_at | timestamptz | NO | now() |
| expires_at | timestamptz | NO | (now() + '00:03:00'::interval) |
| approved_at | timestamptz | YES |  |
| nonce | text | YES |  |

PK: `id`

~-1 rows

### auth.oauth_client_states

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| provider_type | text | NO |  |
| code_verifier | text | YES |  |
| created_at | timestamptz | NO |  |

PK: `id`

~-1 rows

### auth.oauth_clients

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| client_secret_hash | text | YES |  |
| registration_type | oauth_registration_type | NO |  |
| redirect_uris | text | NO |  |
| grant_types | text | NO |  |
| client_name | text | YES |  |
| client_uri | text | YES |  |
| logo_uri | text | YES |  |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| deleted_at | timestamptz | YES |  |
| client_type | oauth_client_type | NO | 'confidential'::auth.oauth_client_type |
| token_endpoint_auth_method | text | NO |  |

PK: `id`

~-1 rows

### auth.oauth_consents

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| user_id | uuid | NO |  |
| client_id | uuid | NO |  |
| scopes | text | NO |  |
| granted_at | timestamptz | NO | now() |
| revoked_at | timestamptz | YES |  |

PK: `id`

~-1 rows

### auth.one_time_tokens

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| user_id | uuid | NO |  |
| token_type | one_time_token_type | NO |  |
| token_hash | text | NO |  |
| relates_to | text | NO |  |
| created_at | timestamp | NO | now() |
| updated_at | timestamp | NO | now() |

PK: `id`

~-1 rows

### auth.refresh_tokens

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| instance_id | uuid | YES |  |
| id | int8 | NO | nextval('auth.refresh_tokens_id_seq'::regclass) |
| token | varchar | YES |  |
| user_id | varchar | YES |  |
| revoked | bool | YES |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |
| parent | varchar | YES |  |
| session_id | uuid | YES |  |

PK: `id`

~-1 rows

### auth.saml_providers

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| sso_provider_id | uuid | NO |  |
| entity_id | text | NO |  |
| metadata_xml | text | NO |  |
| metadata_url | text | YES |  |
| attribute_mapping | jsonb | YES |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |
| name_id_format | text | YES |  |

PK: `id`

~-1 rows

### auth.saml_relay_states

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| sso_provider_id | uuid | NO |  |
| request_id | text | NO |  |
| for_email | text | YES |  |
| redirect_to | text | YES |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |
| flow_state_id | uuid | YES |  |

PK: `id`

~-1 rows

### auth.schema_migrations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| version | varchar | NO |  |

~74 rows

### auth.sessions

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| user_id | uuid | NO |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |
| factor_id | uuid | YES |  |
| aal | aal_level | YES |  |
| not_after | timestamptz | YES |  |
| refreshed_at | timestamp | YES |  |
| user_agent | text | YES |  |
| ip | inet | YES |  |
| tag | text | YES |  |
| oauth_client_id | uuid | YES |  |
| refresh_token_hmac_key | text | YES |  |
| refresh_token_counter | int8 | YES |  |
| scopes | text | YES |  |

PK: `id`

~-1 rows

### auth.sso_domains

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| sso_provider_id | uuid | NO |  |
| domain | text | NO |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |

PK: `id`

~-1 rows

### auth.sso_providers

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| resource_id | text | YES |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |
| disabled | bool | YES |  |

PK: `id`

~-1 rows

### auth.users

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| instance_id | uuid | YES |  |
| id | uuid | NO |  |
| aud | varchar | YES |  |
| role | varchar | YES |  |
| email | varchar | YES |  |
| encrypted_password | varchar | YES |  |
| email_confirmed_at | timestamptz | YES |  |
| invited_at | timestamptz | YES |  |
| confirmation_token | varchar | YES |  |
| confirmation_sent_at | timestamptz | YES |  |
| recovery_token | varchar | YES |  |
| recovery_sent_at | timestamptz | YES |  |
| email_change_token_new | varchar | YES |  |
| email_change | varchar | YES |  |
| email_change_sent_at | timestamptz | YES |  |
| last_sign_in_at | timestamptz | YES |  |
| raw_app_meta_data | jsonb | YES |  |
| raw_user_meta_data | jsonb | YES |  |
| is_super_admin | bool | YES |  |
| created_at | timestamptz | YES |  |
| updated_at | timestamptz | YES |  |
| phone | text | YES | NULL::character varying |
| phone_confirmed_at | timestamptz | YES |  |
| phone_change | text | YES | ''::character varying |
| phone_change_token | varchar | YES | ''::character varying |
| phone_change_sent_at | timestamptz | YES |  |
| confirmed_at | timestamptz | YES |  |
| email_change_token_current | varchar | YES | ''::character varying |
| email_change_confirm_status | int2 | YES | 0 |
| banned_until | timestamptz | YES |  |
| reauthentication_token | varchar | YES | ''::character varying |
| reauthentication_sent_at | timestamptz | YES |  |
| is_sso_user | bool | NO | false |
| deleted_at | timestamptz | YES |  |
| is_anonymous | bool | NO | false |

PK: `id`

~-1 rows

## Schema: extensions

_No tables_

## Schema: graphql

_No tables_

## Schema: graphql_public

_No tables_

## Schema: net

### net._http_response

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | YES |  |
| status_code | int4 | YES |  |
| content_type | text | YES |  |
| headers | jsonb | YES |  |
| content | text | YES |  |
| timed_out | bool | YES |  |
| error_msg | text | YES |  |
| created | timestamptz | NO | now() |

~-1 rows

### net.http_request_queue

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO | nextval('net.http_request_queue_id_seq'::regclass) |
| method | text | NO |  |
| url | text | NO |  |
| headers | jsonb | NO |  |
| body | bytea | YES |  |
| timeout_milliseconds | int4 | NO |  |

~-1 rows

## Schema: pgbouncer

_No tables_

## Schema: public

### public.analytics_login_events

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO |  |
| logged_in_at | timestamptz | YES | now() |

PK: `id`

~-1 rows

### public.apps_poll

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | YES | now() |
| question | text | YES |  |
| authorId | uuid | YES |  |
| isPublic | bool | YES |  |
| status | varchar | YES | 'draft'::character varying |
| expiration | timestamptz | YES |  |
| courseId | uuid | YES |  |

PK: `id`

FK:
- `authorId` → public.groupmember(id)
- `courseId` → public.course(id)

~-1 rows

### public.apps_poll_option

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | YES |  |
| poll_id | uuid | YES |  |
| label | varchar | YES |  |

PK: `id`

FK:
- `poll_id` → public.apps_poll(id)

~-1 rows

### public.apps_poll_submission

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | NO | now() |
| poll_option_id | int8 | YES |  |
| selected_by_id | uuid | YES |  |
| poll_id | uuid | YES |  |

PK: `id`

FK:
- `poll_id` → public.apps_poll(id)
- `poll_option_id` → public.apps_poll_option(id)
- `selected_by_id` → public.groupmember(id)

~-1 rows

### public.community_answer

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | extensions.gen_random_uuid() |
| created_at | timestamptz | YES | now() |
| question_id | int8 | YES |  |
| body | varchar | YES |  |
| author_id | int8 | YES |  |
| votes | int8 | YES |  |
| author_profile_id | uuid | YES |  |

PK: `id`

FK:
- `author_id` → public.organizationmember(id)
- `author_profile_id` → public.profile(id)
- `question_id` → public.community_question(id)

~-1 rows

### public.community_question

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | YES | now() |
| title | varchar | YES |  |
| body | text | YES |  |
| author_id | int8 | YES |  |
| votes | int8 | YES | '0'::bigint |
| organization_id | uuid | YES |  |
| slug | text | YES |  |
| author_profile_id | uuid | YES |  |
| course_id | uuid | NO |  |

PK: `id`

FK:
- `author_id` → public.organizationmember(id)
- `author_profile_id` → public.profile(id)
- `course_id` → public.course(id)
- `organization_id` → public.organization(id)

~-1 rows

### public.course

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| title | varchar | NO |  |
| description | varchar | NO |  |
| overview | varchar | YES | 'Welcome to this amazing course 🚀 '::character varying |
| id | uuid | NO | uuid_generate_v4() |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| group_id | uuid | YES |  |
| is_template | bool | YES | true |
| logo | text | NO | ''::text |
| slug | varchar | YES |  |
| metadata | jsonb | NO | '{"goals": "", "description": "", "requirements": ""}'::jsonb |
| cost | int8 | YES | '0'::bigint |
| currency | varchar | NO | 'USD'::character varying |
| banner_image | text | YES |  |
| is_published | bool | YES | false |
| is_certificate_downloadable | bool | YES | false |
| certificate_theme | text | YES |  |
| status | text | NO | 'ACTIVE'::text |
| type | COURSE_TYPE | YES | 'LIVE_CLASS'::"COURSE_TYPE" |
| version | COURSE_VERSION | NO | 'V1'::"COURSE_VERSION" |

PK: `id`

FK:
- `group_id` → public.group(id)

~-1 rows

### public.course_newsfeed

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| created_at | timestamptz | NO | now() |
| author_id | uuid | YES |  |
| content | text | YES |  |
| id | uuid | NO | gen_random_uuid() |
| course_id | uuid | YES |  |
| reaction | jsonb | YES | '{"clap": [], "smile": [], "thumbsup": [], "thumbsdown": []}'::jsonb |
| is_pinned | bool | NO | false |

PK: `id`

FK:
- `author_id` → public.groupmember(id)
- `course_id` → public.course(id)

~-1 rows

### public.course_newsfeed_comment

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| created_at | timestamptz | NO | now() |
| author_id | uuid | YES |  |
| content | text | YES |  |
| id | int8 | NO |  |
| course_newsfeed_id | uuid | YES |  |

PK: `id`

FK:
- `author_id` → public.groupmember(id)
- `course_newsfeed_id` → public.course_newsfeed(id)

~-1 rows

### public.currency

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | YES | now() |
| name | varchar | YES |  |

PK: `id`

~-1 rows

### public.email_verification_tokens

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| profile_id | uuid | YES |  |
| token | text | NO |  |
| email | text | NO |  |
| created_at | timestamptz | YES | timezone('utc'::text, now()) |
| expires_at | timestamptz | NO |  |
| used_at | timestamptz | YES |  |
| created_by_ip | inet | YES |  |
| used_by_ip | inet | YES |  |

PK: `id`

FK:
- `profile_id` → public.profile(id)

~-1 rows

### public.exercise

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| title | varchar | NO |  |
| description | varchar | YES |  |
| lesson_id | uuid | YES |  |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| id | uuid | NO | uuid_generate_v4() |
| due_by | timestamp | YES |  |

PK: `id`

FK:
- `lesson_id` → public.lesson(id)

~-1 rows

### public.group

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| name | varchar | NO |  |
| description | text | YES |  |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| organization_id | uuid | YES |  |

PK: `id`

FK:
- `organization_id` → public.organization(id)

~-1 rows

### public.group_attendance

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| course_id | uuid | YES |  |
| student_id | uuid | YES |  |
| is_present | bool | YES | false |
| lesson_id | uuid | NO |  |

PK: `id`

FK:
- `course_id` → public.course(id)
- `student_id` → public.groupmember(id)

~-1 rows

### public.groupmember

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| group_id | uuid | NO |  |
| role_id | int8 | NO |  |
| profile_id | uuid | YES |  |
| email | varchar | YES |  |
| created_at | timestamptz | YES | now() |
| assigned_student_id | varchar | YES |  |

PK: `id`

FK:
- `group_id` → public.group(id)
- `profile_id` → public.profile(id)
- `role_id` → public.role(id)

~-1 rows

### public.lesson

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| note | varchar | YES |  |
| video_url | varchar | YES |  |
| slide_url | varchar | YES |  |
| course_id | uuid | NO |  |
| id | uuid | NO | uuid_generate_v4() |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| title | varchar | NO |  |
| public | bool | YES | false |
| lesson_at | timestamptz | YES | now() |
| teacher_id | uuid | YES |  |
| is_complete | bool | YES | false |
| call_url | text | YES |  |
| order | int8 | YES |  |
| is_unlocked | bool | YES | false |
| videos | jsonb | YES | '[]'::jsonb |
| section_id | uuid | YES |  |
| documents | jsonb | YES | '[]'::jsonb |

PK: `id`

FK:
- `course_id` → public.course(id)
- `teacher_id` → public.profile(id)
- `section_id` → public.lesson_section(id)

~-1 rows

### public.lesson_comment

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | YES | now() |
| lesson_id | uuid | YES |  |
| groupmember_id | uuid | YES |  |
| comment | text | YES |  |

PK: `id`

FK:
- `groupmember_id` → public.groupmember(id)
- `lesson_id` → public.lesson(id)

~-1 rows

### public.lesson_completion

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | NO | now() |
| lesson_id | uuid | YES |  |
| profile_id | uuid | YES |  |
| is_complete | bool | YES | false |
| updated_at | timestamptz | YES | now() |

PK: `id`

FK:
- `lesson_id` → public.lesson(id)
- `profile_id` → public.profile(id)

~-1 rows

### public.lesson_language

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| content | text | YES |  |
| lesson_id | uuid | YES | gen_random_uuid() |
| locale | LOCALE | YES | 'en'::"LOCALE" |

PK: `id`

FK:
- `lesson_id` → public.lesson(id)

~-1 rows

### public.lesson_language_history

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int4 | NO | nextval('lesson_language_history_id_seq'::regclass) |
| lesson_language_id | int4 | YES |  |
| old_content | text | YES |  |
| new_content | text | YES |  |
| timestamp | timestamp | NO | CURRENT_TIMESTAMP |

PK: `id`

FK:
- `lesson_language_id` → public.lesson_language(id)

~-1 rows

### public.lesson_section

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | YES | now() |
| title | varchar | YES |  |
| order | int8 | YES | '0'::bigint |
| course_id | uuid | YES |  |

PK: `id`

FK:
- `course_id` → public.course(id)

~-1 rows

### public.option

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| label | varchar | NO |  |
| is_correct | bool | NO | false |
| question_id | int8 | NO |  |
| value | uuid | YES | extensions.gen_random_uuid() |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

PK: `id`

FK:
- `question_id` → public.question(id)

~-1 rows

### public.organization

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| name | varchar | NO |  |
| siteName | text | YES |  |
| avatar_url | text | YES |  |
| settings | jsonb | YES | '{}'::jsonb |
| landingpage | jsonb | YES | '{}'::jsonb |
| theme | text | YES |  |
| created_at | timestamptz | NO | timezone('utc'::text, now()) |
| customization | json | NO | '{"apps":{"poll":true,"comments":true},"course":{"grading":true,"newsfeed":true},"dashboard":{"exercise":true,"community":true,"bannerText":"","bannerImage":""}}'::json |
| is_restricted | bool | NO | false |
| customCode | text | YES |  |
| customDomain | text | YES |  |
| favicon | text | YES |  |
| isCustomDomainVerified | bool | YES | false |

PK: `id`

~-1 rows

### public.organization_contacts

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | NO | now() |
| email | text | YES |  |
| phone | text | YES |  |
| name | text | YES |  |
| message | text | YES |  |
| organization_id | uuid | YES |  |

PK: `id`

FK:
- `organization_id` → public.organization(id)

~-1 rows

### public.organization_emaillist

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | NO | now() |
| email | text | YES |  |
| organization_id | uuid | YES |  |

PK: `id`

FK:
- `organization_id` → public.organization(id)

~-1 rows

### public.organization_plan

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| activated_at | timestamptz | NO | now() |
| org_id | uuid | YES |  |
| plan_name | PLAN | YES |  |
| is_active | bool | YES |  |
| deactivated_at | timestamptz | YES |  |
| updated_at | timestamptz | YES | now() |
| payload | jsonb | YES |  |
| triggered_by | int8 | YES |  |
| provider | text | YES | 'lmz'::text |
| subscription_id | text | YES |  |

PK: `id`

FK:
- `org_id` → public.organization(id)
- `triggered_by` → public.organizationmember(id)

~-1 rows

### public.organizationmember

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| organization_id | uuid | NO |  |
| role_id | int8 | NO |  |
| profile_id | uuid | YES |  |
| email | text | YES |  |
| verified | bool | YES | false |
| created_at | timestamptz | NO | timezone('utc'::text, now()) |

PK: `id`

FK:
- `organization_id` → public.organization(id)
- `profile_id` → public.profile(id)
- `role_id` → public.role(id)

~-1 rows

### public.profile

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO |  |
| fullname | text | NO |  |
| username | text | NO |  |
| avatar_url | text | YES | 'https://pgrest.classroomio.com/storage/v1/object/public/avatars/avatar.png'::text |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| email | varchar | YES |  |
| can_add_course | bool | YES | true |
| role | varchar | YES |  |
| goal | varchar | YES |  |
| source | varchar | YES |  |
| metadata | json | YES |  |
| telegram_chat_id | int8 | YES |  |
| is_email_verified | bool | YES | false |
| verified_at | timestamptz | YES |  |
| locale | LOCALE | YES | 'en'::"LOCALE" |
| is_restricted | bool | NO | false |

PK: `id`

~-1 rows

### public.question

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| question_type_id | int8 | NO |  |
| title | varchar | NO |  |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| exercise_id | uuid | NO |  |
| name | uuid | YES | extensions.gen_random_uuid() |
| points | float8 | YES |  |
| order | int8 | YES |  |

PK: `id`

FK:
- `exercise_id` → public.exercise(id)
- `question_type_id` → public.question_type(id)

~-1 rows

### public.question_answer

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| answers | _varchar | YES |  |
| question_id | int8 | NO |  |
| open_answer | text | YES |  |
| group_member_id | uuid | NO |  |
| submission_id | uuid | YES |  |
| point | int8 | YES | '0'::bigint |

PK: `id`

FK:
- `group_member_id` → public.groupmember(id)
- `question_id` → public.question(id)
- `submission_id` → public.submission(id)

~-1 rows

### public.question_type

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| label | varchar | NO |  |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| typename | varchar | YES |  |

PK: `id`

~-1 rows

### public.quiz

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | extensions.gen_random_uuid() |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| title | text | YES |  |
| questions | json | YES |  |
| timelimit | varchar | YES | '10s'::character varying |
| theme | varchar | YES | 'standard'::character varying |
| organization_id | uuid | NO |  |

PK: `id`

FK:
- `organization_id` → public.organization(id)

~-1 rows

### public.quiz_play

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| quiz_id | uuid | YES |  |
| players | json | YES | '[]'::json |
| started | bool | YES | false |
| currentQuestionId | int8 | YES | '0'::bigint |
| showCurrentQuestionAnswer | bool | YES | false |
| isLastQuestion | bool | YES |  |
| step | text | YES | 'CONNECT_TO_PLAY'::text |
| studentStep | text | YES | 'PIN_SETUP'::text |
| pin | text | YES |  |

PK: `id`

FK:
- `quiz_id` → public.quiz(id)

~-1 rows

### public.role

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| type | varchar | NO |  |
| description | varchar | YES |  |
| id | int8 | NO |  |
| updated_at | timestamptz | YES | now() |
| created_at | timestamptz | YES | now() |

PK: `id`

~-1 rows

### public.submission

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| reviewer_id | int8 | YES |  |
| status_id | int8 | YES | '1'::bigint |
| total | int8 | YES | '0'::bigint |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| exercise_id | uuid | NO |  |
| submitted_by | uuid | YES |  |
| course_id | uuid | YES |  |
| feedback | text | YES |  |

PK: `id`

FK:
- `course_id` → public.course(id)
- `exercise_id` → public.exercise(id)
- `status_id` → public.submissionstatus(id)
- `submitted_by` → public.groupmember(id)

~-1 rows

### public.submissionstatus

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| label | varchar | NO |  |
| updated_at | timestamptz | YES | now() |

PK: `id`

~-1 rows

### public.test_tenant

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int4 | NO | nextval('test_tenant_id_seq'::regclass) |
| details | text | YES |  |

PK: `id`

~-1 rows

### public.video_transcripts

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| created_at | timestamptz | NO | now() |
| muse_svid | text | YES |  |
| transcript | text | YES |  |
| downloaded | bool | YES | false |
| link | text | YES |  |

PK: `id`

~-1 rows

### public.waitinglist

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| email | varchar | NO |  |
| created_at | timestamptz | YES | now() |

PK: `id`

~-1 rows

## Schema: realtime

### realtime.messages

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| topic | text | NO |  |
| extension | text | NO |  |
| payload | jsonb | YES |  |
| event | text | YES |  |
| private | bool | YES | false |
| updated_at | timestamp | NO | now() |
| inserted_at | timestamp | NO | now() |
| id | uuid | NO | gen_random_uuid() |

PK: `id,inserted_at`

~-1 rows

### realtime.messages_2026_05_14

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| topic | text | NO |  |
| extension | text | NO |  |
| payload | jsonb | YES |  |
| event | text | YES |  |
| private | bool | YES | false |
| updated_at | timestamp | NO | now() |
| inserted_at | timestamp | NO | now() |
| id | uuid | NO | gen_random_uuid() |

PK: `id,inserted_at`

~-1 rows

### realtime.messages_2026_05_15

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| topic | text | NO |  |
| extension | text | NO |  |
| payload | jsonb | YES |  |
| event | text | YES |  |
| private | bool | YES | false |
| updated_at | timestamp | NO | now() |
| inserted_at | timestamp | NO | now() |
| id | uuid | NO | gen_random_uuid() |

PK: `id,inserted_at`

~-1 rows

### realtime.messages_2026_05_16

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| topic | text | NO |  |
| extension | text | NO |  |
| payload | jsonb | YES |  |
| event | text | YES |  |
| private | bool | YES | false |
| updated_at | timestamp | NO | now() |
| inserted_at | timestamp | NO | now() |
| id | uuid | NO | gen_random_uuid() |

PK: `id,inserted_at`

~-1 rows

### realtime.messages_2026_05_17

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| topic | text | NO |  |
| extension | text | NO |  |
| payload | jsonb | YES |  |
| event | text | YES |  |
| private | bool | YES | false |
| updated_at | timestamp | NO | now() |
| inserted_at | timestamp | NO | now() |
| id | uuid | NO | gen_random_uuid() |

PK: `id,inserted_at`

~-1 rows

### realtime.messages_2026_05_18

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| topic | text | NO |  |
| extension | text | NO |  |
| payload | jsonb | YES |  |
| event | text | YES |  |
| private | bool | YES | false |
| updated_at | timestamp | NO | now() |
| inserted_at | timestamp | NO | now() |
| id | uuid | NO | gen_random_uuid() |

PK: `id,inserted_at`

~-1 rows

### realtime.schema_migrations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| version | int8 | NO |  |
| inserted_at | timestamp | YES |  |

PK: `version`

~65 rows

### realtime.subscription

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO |  |
| subscription_id | uuid | NO |  |
| entity | regclass | NO |  |
| filters | _user_defined_filter | NO | '{}'::realtime.user_defined_filter[] |
| claims | jsonb | NO |  |
| claims_role | regrole | NO |  |
| created_at | timestamp | NO | timezone('utc'::text, now()) |

PK: `id`

~-1 rows

## Schema: storage

### storage.buckets

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text | NO |  |
| name | text | NO |  |
| owner | uuid | YES |  |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| public | bool | YES | false |
| avif_autodetection | bool | YES | false |
| file_size_limit | int8 | YES |  |
| allowed_mime_types | _text | YES |  |
| owner_id | text | YES |  |
| type | buckettype | NO | 'STANDARD'::storage.buckettype |

PK: `id`

~-1 rows

### storage.buckets_analytics

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| name | text | NO |  |
| type | buckettype | NO | 'ANALYTICS'::storage.buckettype |
| format | text | NO | 'ICEBERG'::text |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| id | uuid | NO | gen_random_uuid() |
| deleted_at | timestamptz | YES |  |

PK: `id`

~-1 rows

### storage.buckets_vectors

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text | NO |  |
| type | buckettype | NO | 'VECTOR'::storage.buckettype |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

~-1 rows

### storage.iceberg_namespaces

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| bucket_name | text | NO |  |
| name | text | NO |  |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| metadata | jsonb | NO | '{}'::jsonb |
| catalog_id | uuid | NO |  |

PK: `id`

~-1 rows

### storage.iceberg_tables

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| namespace_id | uuid | NO |  |
| bucket_name | text | NO |  |
| name | text | NO |  |
| location | text | NO |  |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| remote_table_id | text | YES |  |
| shard_key | text | YES |  |
| shard_id | text | YES |  |
| catalog_id | uuid | NO |  |

PK: `id`

~-1 rows

### storage.migrations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int4 | NO |  |
| name | varchar | NO |  |
| hash | varchar | NO |  |
| executed_at | timestamp | YES | CURRENT_TIMESTAMP |

~56 rows

### storage.objects

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| bucket_id | text | YES |  |
| name | text | YES |  |
| owner | uuid | YES |  |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| last_accessed_at | timestamptz | YES | now() |
| metadata | jsonb | YES |  |
| path_tokens | _text | YES |  |
| version | text | YES |  |
| owner_id | text | YES |  |
| user_metadata | jsonb | YES |  |

PK: `id`

~-1 rows

### storage.s3_multipart_uploads

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text | NO |  |
| in_progress_size | int8 | NO | 0 |
| upload_signature | text | NO |  |
| bucket_id | text | NO |  |
| key | text | NO |  |
| version | text | NO |  |
| owner_id | text | YES |  |
| created_at | timestamptz | NO | now() |
| user_metadata | jsonb | YES |  |

PK: `id`

~-1 rows

### storage.s3_multipart_uploads_parts

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| upload_id | text | NO |  |
| size | int8 | NO | 0 |
| part_number | int4 | NO |  |
| bucket_id | text | NO |  |
| key | text | NO |  |
| etag | text | NO |  |
| owner_id | text | YES |  |
| version | text | NO |  |
| created_at | timestamptz | NO | now() |

PK: `id`

~-1 rows

### storage.vector_indexes

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text | NO | gen_random_uuid() |
| name | text | NO |  |
| bucket_id | text | NO |  |
| data_type | text | NO |  |
| dimension | int4 | NO |  |
| distance_metric | text | NO |  |
| metadata_configuration | jsonb | YES |  |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

~-1 rows

## Schema: supabase_functions

### supabase_functions.hooks

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int8 | NO | nextval('supabase_functions.hooks_id_seq'::regclass) |
| hook_table_id | int4 | NO |  |
| hook_name | text | NO |  |
| created_at | timestamptz | NO | now() |
| request_id | int8 | YES |  |

PK: `id`

~-1 rows

### supabase_functions.migrations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| version | text | NO |  |
| inserted_at | timestamptz | NO | now() |

PK: `version`

~-1 rows

## Schema: supabase_migrations

### supabase_migrations.schema_migrations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| version | text | NO |  |
| statements | _text | YES |  |
| name | text | YES |  |

PK: `version`

~-1 rows

### supabase_migrations.seed_files

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| path | text | NO |  |
| hash | text | NO |  |

PK: `path`

~-1 rows

## Schema: vault

### vault.secrets

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | YES |  |
| description | text | NO | ''::text |
| secret | text | NO |  |
| key_id | uuid | YES |  |
| nonce | bytea | YES | vault._crypto_aead_det_noncegen() |
| created_at | timestamptz | NO | CURRENT_TIMESTAMP |
| updated_at | timestamptz | NO | CURRENT_TIMESTAMP |

PK: `id`

~-1 rows

