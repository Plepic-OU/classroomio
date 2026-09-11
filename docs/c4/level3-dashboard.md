# Layer 3 — Dashboard Component Diagram

Derived from the codebase AST (ts-morph), not hand-authored. Regenerate after structural changes:

```bash
pnpm exec tsx .claude/skills/c4-model/scripts/extract-components.ts dashboard --depth=5
pnpm exec tsx .claude/skills/c4-model/scripts/render-mermaid.ts dashboard
```

Generated: 2026-09-11T08:07:08.027Z · depth: 5 · source: `apps/dashboard/src`

```mermaid
C4Component
title Dashboard — Component Diagram (Layer 3)

Container_Boundary(dashboard, "Dashboard", "SvelteKit (Svelte 4, TypeScript)") {
    Boundary(dashboard_b___mocks__, "__mocks__") {
      Component(dashboard___mocks____app, "$app", "TypeScript", "1 ts")
    }
    Boundary(dashboard_b_lib, "lib") {
      Component(dashboard_lib, "lib (files here)", "TypeScript", "1 ts")
      Boundary(dashboard_b_lib_components, "components") {
        Boundary(dashboard_b_lib_components_AI, "AI") {
          Component(dashboard_lib_components_AI_AIButton, "AIButton", "Svelte", "1 svelte")
        }
        Component(dashboard_lib_components_Analytics, "Analytics", "TS + Svelte", "1 ts, 3 svelte")
        Boundary(dashboard_b_lib_components_Apps, "Apps") {
          Component(dashboard_lib_components_Apps, "Apps (files here)", "TS + Svelte", "2 ts, 1 svelte")
          Boundary(dashboard_b_lib_components_Apps_components, "components") {
            Component(dashboard_lib_components_Apps_components_Notes, "Notes", "Svelte", "1 svelte")
            Component(dashboard_lib_components_Apps_components_Poll, "Poll", "TS + Svelte", "4 ts, 6 svelte")
            Component(dashboard_lib_components_Apps_components_QandA, "QandA", "Svelte", "1 svelte")
          }
        }
        Component(dashboard_lib_components_AuthUI, "AuthUI", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Avatar, "Avatar", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Backdrop, "Backdrop", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Box, "Box", "Svelte", "1 svelte")
        Boundary(dashboard_b_lib_components_Buttons, "Buttons") {
          Component(dashboard_lib_components_Buttons, "Buttons (files here)", "Svelte", "1 svelte")
          Component(dashboard_lib_components_Buttons_Close, "Close", "Svelte", "1 svelte")
          Component(dashboard_lib_components_Buttons_Delete, "Delete", "Svelte", "1 svelte")
          Component(dashboard_lib_components_Buttons_Send, "Send", "Svelte", "1 svelte")
        }
        Component(dashboard_lib_components_Chip, "Chip", "Svelte", "3 svelte")
        Component(dashboard_lib_components_CodeSnippet, "CodeSnippet", "Svelte", "1 svelte")
        Component(dashboard_lib_components_ComingSoon, "ComingSoon", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Confetti, "Confetti", "TS + Svelte", "1 ts, 1 svelte")
        Boundary(dashboard_b_lib_components_Course, "Course") {
          Component(dashboard_lib_components_Course, "Course (files here)", "TypeScript", "3 ts")
          Boundary(dashboard_b_lib_components_Course_components, "components") {
            Component(dashboard_lib_components_Course_components, "components (files here)", "TypeScript", "1 ts")
            Component(dashboard_lib_components_Course_components_Analytics, "Analytics", "Svelte", "9 svelte")
            Component(dashboard_lib_components_Course_components_Attendance, "Attendance", "Svelte", "1 svelte")
            Component(dashboard_lib_components_Course_components_Ceritficate, "Ceritficate", "TS + Svelte", "2 ts, 12 svelte")
            Component(dashboard_lib_components_Course_components_Lesson, "Lesson", "TS + Svelte", "12 ts, 34 svelte")
            Component(dashboard_lib_components_Course_components_Navigation, "Navigation", "TS + Svelte", "1 ts, 3 svelte")
            Component(dashboard_lib_components_Course_components_NewsFeed, "NewsFeed", "TS + Svelte", "1 ts, 4 svelte")
            Component(dashboard_lib_components_Course_components_People, "People", "TS + Svelte", "2 ts, 3 svelte")
            Component(dashboard_lib_components_Course_components_Settings, "Settings", "TS + Svelte", "1 ts, 2 svelte")
          }
        }
        Component(dashboard_lib_components_CourseContainer, "CourseContainer", "Svelte", "1 svelte")
        Boundary(dashboard_b_lib_components_CourseLandingPage, "CourseLandingPage") {
          Component(dashboard_lib_components_CourseLandingPage, "CourseLandingPage (files here)", "TS + Svelte", "3 ts, 1 svelte")
          Boundary(dashboard_b_lib_components_CourseLandingPage_components, "components") {
            Component(dashboard_lib_components_CourseLandingPage_components, "components (files here)", "TS + Svelte", "1 ts, 3 svelte")
            Component(dashboard_lib_components_CourseLandingPage_components_Editor, "Editor", "Svelte", "11 svelte")
          }
        }
        Boundary(dashboard_b_lib_components_Courses, "Courses") {
          Component(dashboard_lib_components_Courses, "Courses (files here)", "TS + Svelte", "3 ts, 1 svelte")
          Boundary(dashboard_b_lib_components_Courses_components, "components") {
            Component(dashboard_lib_components_Courses_components_Card, "Card", "Svelte", "2 svelte")
            Component(dashboard_lib_components_Courses_components_CopyCourseModal, "CopyCourseModal", "Svelte", "1 svelte")
            Component(dashboard_lib_components_Courses_components_List, "List", "Svelte", "2 svelte")
            Component(dashboard_lib_components_Courses_components_NewCourseModal, "NewCourseModal", "Svelte", "1 svelte")
          }
        }
        Component(dashboard_lib_components_Dropdown, "Dropdown", "Svelte", "1 svelte")
        Component(dashboard_lib_components_ErrorMessage, "ErrorMessage", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Expandable, "Expandable", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Footer, "Footer", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Form, "Form", "Svelte", "8 svelte")
        Component(dashboard_lib_components_HashTags, "HashTags", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Hoverable, "Hoverable", "Svelte", "1 svelte")
        Component(dashboard_lib_components_HTMLRender, "HTMLRender", "Svelte", "1 svelte")
        Component(dashboard_lib_components_IconButton, "IconButton", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Icons, "Icons", "Svelte", "18 svelte")
        Boundary(dashboard_b_lib_components_LMS, "LMS") {
          Component(dashboard_lib_components_LMS, "LMS (files here)", "Svelte", "1 svelte")
          Component(dashboard_lib_components_LMS_components, "components", "Svelte", "2 svelte")
        }
        Component(dashboard_lib_components_MarkdownEditor, "MarkdownEditor", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Modal, "Modal", "Svelte", "2 svelte")
        Component(dashboard_lib_components_Navigation, "Navigation", "TS + Svelte", "1 ts, 7 svelte")
        Boundary(dashboard_b_lib_components_Org, "Org") {
          Component(dashboard_lib_components_Org, "Org (files here)", "TS + Svelte", "1 ts, 3 svelte")
          Component(dashboard_lib_components_Org_AddOrgModal, "AddOrgModal", "Svelte", "1 svelte")
          Component(dashboard_lib_components_Org_Audience, "Audience", "Svelte", "2 svelte")
          Component(dashboard_lib_components_Org_Community, "Community", "Svelte", "3 svelte")
          Component(dashboard_lib_components_Org_LandingPage, "LandingPage", "Svelte", "3 svelte")
          Component(dashboard_lib_components_Org_ProfileMenu, "ProfileMenu", "Svelte", "2 svelte")
          Boundary(dashboard_b_lib_components_Org_Quiz, "Quiz") {
            Component(dashboard_lib_components_Org_Quiz, "Quiz (files here)", "Svelte", "6 svelte")
            Component(dashboard_lib_components_Org_Quiz_Play, "Play", "Svelte", "12 svelte")
          }
          Component(dashboard_lib_components_Org_Settings, "Settings", "TS + Svelte", "1 ts, 11 svelte")
          Component(dashboard_lib_components_Org_VerifyEmail, "VerifyEmail", "Svelte", "1 svelte")
        }
        Component(dashboard_lib_components_OrgSelector, "OrgSelector", "Svelte", "2 svelte")
        Component(dashboard_lib_components_Page, "Page", "TS + Svelte", "1 ts, 5 svelte")
        Component(dashboard_lib_components_PrimaryButton, "PrimaryButton", "TS + Svelte", "1 ts, 1 svelte")
        Component(dashboard_lib_components_Progress, "Progress", "Svelte", "2 svelte")
        Boundary(dashboard_b_lib_components_Question, "Question") {
          Component(dashboard_lib_components_Question, "Question (files here)", "TS + Svelte", "1 ts, 3 svelte")
          Component(dashboard_lib_components_Question_CheckboxQuestion, "CheckboxQuestion", "Svelte", "1 svelte")
          Component(dashboard_lib_components_Question_RadioQuestion, "RadioQuestion", "Svelte", "1 svelte")
          Component(dashboard_lib_components_Question_TextareaQuestion, "TextareaQuestion", "Svelte", "1 svelte")
        }
        Component(dashboard_lib_components_QuestionContainer, "QuestionContainer", "Svelte", "1 svelte")
        Component(dashboard_lib_components_RoleBasedSecurity, "RoleBasedSecurity", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Senja, "Senja", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Snackbar, "Snackbar", "TS + Svelte", "2 ts, 1 svelte")
        Component(dashboard_lib_components_TabContent, "TabContent", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Tabs, "Tabs", "Svelte", "1 svelte")
        Boundary(dashboard_b_lib_components_TextEditor, "TextEditor") {
          Component(dashboard_lib_components_TextEditor, "TextEditor (files here)", "Svelte", "1 svelte")
          Component(dashboard_lib_components_TextEditor_TinymceSvelte, "TinymceSvelte", "TS + Svelte", "1 ts, 1 svelte")
        }
        Component(dashboard_lib_components_ToolTip, "ToolTip", "Svelte", "1 svelte")
        Component(dashboard_lib_components_UnsavedChanges, "UnsavedChanges", "Svelte", "1 svelte")
        Component(dashboard_lib_components_Upgrade, "Upgrade", "Svelte", "3 svelte")
        Component(dashboard_lib_components_UploadImage, "UploadImage", "Svelte", "1 svelte")
        Component(dashboard_lib_components_UploadWidget, "UploadWidget", "TS + Svelte", "1 ts, 1 svelte")
        Component(dashboard_lib_components_Vote, "Vote", "Svelte", "1 svelte")
        Component(dashboard_lib_components_WelcomeModal, "WelcomeModal", "TS + Svelte", "1 ts, 1 svelte")
      }
      Boundary(dashboard_b_lib_mocks, "mocks") {
        Component(dashboard_lib_mocks, "mocks (files here)", "TypeScript", "2 ts")
        Component(dashboard_lib_mocks_css, "css", "TypeScript", "21 ts")
        Component(dashboard_lib_mocks_git, "git", "TypeScript", "21 ts")
        Component(dashboard_lib_mocks_html, "html", "TypeScript", "21 ts")
        Component(dashboard_lib_mocks_js, "js", "TypeScript", "21 ts")
        Component(dashboard_lib_mocks_node, "node", "TypeScript", "21 ts")
        Component(dashboard_lib_mocks_php, "php", "TypeScript", "21 ts")
        Component(dashboard_lib_mocks_python, "python", "TypeScript", "21 ts")
        Component(dashboard_lib_mocks_react, "react", "TypeScript", "34 ts")
        Component(dashboard_lib_mocks_typescript, "typescript", "TypeScript", "17 ts")
        Component(dashboard_lib_mocks_vue, "vue", "TypeScript", "21 ts")
      }
      Boundary(dashboard_b_lib_utils, "utils") {
        Component(dashboard_lib_utils_constants, "constants", "TypeScript", "9 ts")
        Boundary(dashboard_b_lib_utils_functions, "functions") {
          Component(dashboard_lib_utils_functions, "functions (files here)", "TypeScript", "47 ts")
          Component(dashboard_lib_utils_functions_routes, "routes", "TypeScript", "4 ts")
          Component(dashboard_lib_utils_functions_tinymce, "tinymce", "TypeScript", "1 ts")
        }
        Boundary(dashboard_b_lib_utils_services, "services") {
          Component(dashboard_lib_utils_services_api, "api", "TypeScript", "4 ts")
          Component(dashboard_lib_utils_services_attendance, "attendance", "TypeScript", "1 ts")
          Component(dashboard_lib_utils_services_courses, "courses", "TypeScript", "3 ts")
          Component(dashboard_lib_utils_services_dashboard, "dashboard", "TypeScript", "1 ts")
          Component(dashboard_lib_utils_services_lms, "lms", "TypeScript", "1 ts")
          Component(dashboard_lib_utils_services_marks, "marks", "TypeScript", "1 ts")
          Component(dashboard_lib_utils_services_middlewares, "middlewares", "TypeScript", "2 ts")
          Component(dashboard_lib_utils_services_newsfeed, "newsfeed", "TypeScript", "1 ts")
          Component(dashboard_lib_utils_services_notification, "notification", "TypeScript", "1 ts")
          Component(dashboard_lib_utils_services_org, "org", "TypeScript", "3 ts")
          Component(dashboard_lib_utils_services_posthog, "posthog", "TypeScript", "1 ts")
          Component(dashboard_lib_utils_services_sentry, "sentry", "TypeScript", "1 ts")
          Component(dashboard_lib_utils_services_submissions, "submissions", "TypeScript", "1 ts")
        }
        Component(dashboard_lib_utils_store, "store", "TypeScript", "5 ts")
        Component(dashboard_lib_utils_translations, "translations", "TypeScript", "0 files")
        Component(dashboard_lib_utils_types, "types", "TypeScript", "9 ts")
      }
    }
    Component(dashboard_mail, "mail", "TypeScript", "1 ts")
    Boundary(dashboard_b_routes, "routes") {
      Component(dashboard_routes, "routes (files here)", "TS + Svelte", "2 ts, 3 svelte")
      Component(dashboard_routes_404, "404", "Svelte", "1 svelte")
      Boundary(dashboard_b_routes_api, "api") {
        Boundary(dashboard_b_routes_api_admin, "admin") {
          Component(dashboard_routes_api_admin_cleanup_tokens, "cleanup-tokens", "TypeScript", "1 ts")
          Component(dashboard_routes_api_admin_security_monitor, "security-monitor", "TypeScript", "1 ts")
        }
        Boundary(dashboard_b_routes_api_analytics, "analytics") {
          Component(dashboard_routes_api_analytics_dash, "dash", "TypeScript", "1 ts")
          Component(dashboard_routes_api_analytics_user, "user", "TypeScript", "1 ts")
        }
        Boundary(dashboard_b_routes_api_completion, "completion") {
          Component(dashboard_routes_api_completion, "completion (files here)", "TypeScript", "1 ts")
          Component(dashboard_routes_api_completion_customprompt, "customprompt", "TypeScript", "1 ts")
          Component(dashboard_routes_api_completion_exerciseprompt, "exerciseprompt", "TypeScript", "1 ts")
          Component(dashboard_routes_api_completion_gradingprompt, "gradingprompt", "TypeScript", "1 ts")
        }
        Boundary(dashboard_b_routes_api_courses, "courses") {
          Component(dashboard_routes_api_courses_analytics, "analytics", "TypeScript", "1 ts")
          Component(dashboard_routes_api_courses_data, "data", "TypeScript", "1 ts")
          Component(dashboard_routes_api_courses_exercises, "exercises", "TypeScript", "1 ts")
          Component(dashboard_routes_api_courses_marks, "marks", "TypeScript", "1 ts")
          Component(dashboard_routes_api_courses_newsfeed, "newsfeed", "TypeScript", "1 ts")
          Component(dashboard_routes_api_courses_submission, "submission", "TypeScript", "1 ts")
          Component(dashboard_routes_api_courses_submissions, "submissions", "TypeScript", "1 ts")
        }
        Component(dashboard_routes_api_domain, "domain", "TypeScript", "1 ts")
        Boundary(dashboard_b_routes_api_email, "email") {
          Boundary(dashboard_b_routes_api_email_course, "course") {
            Component(dashboard_routes_api_email_course_exercise_submission_update, "exercise_submission_update", "TypeScript", "1 ts")
            Component(dashboard_routes_api_email_course_newsfeed, "newsfeed", "TypeScript", "1 ts")
            Component(dashboard_routes_api_email_course_student_prove_payment, "student_prove_payment", "TypeScript", "1 ts")
            Component(dashboard_routes_api_email_course_student_welcome, "student_welcome", "TypeScript", "1 ts")
            Component(dashboard_routes_api_email_course_submission_update, "submission_update", "TypeScript", "1 ts")
            Component(dashboard_routes_api_email_course_teacher_student_buycourse, "teacher_student_buycourse", "TypeScript", "1 ts")
            Component(dashboard_routes_api_email_course_teacher_student_joined, "teacher_student_joined", "TypeScript", "1 ts")
            Component(dashboard_routes_api_email_course_teacher_welcome, "teacher_welcome", "TypeScript", "1 ts")
          }
          Component(dashboard_routes_api_email_invite, "invite", "TypeScript", "1 ts")
          Component(dashboard_routes_api_email_verify_email, "verify_email", "TypeScript", "1 ts")
          Component(dashboard_routes_api_email_welcome, "welcome", "TypeScript", "1 ts")
        }
        Boundary(dashboard_b_routes_api_org, "org") {
          Component(dashboard_routes_api_org_audience, "audience", "TypeScript", "1 ts")
          Component(dashboard_routes_api_org_team, "team", "TypeScript", "1 ts")
        }
        Boundary(dashboard_b_routes_api_polar, "polar") {
          Component(dashboard_routes_api_polar_portal, "portal", "TypeScript", "1 ts")
          Component(dashboard_routes_api_polar_subscribe, "subscribe", "TypeScript", "1 ts")
          Component(dashboard_routes_api_polar_webhook, "webhook", "TypeScript", "1 ts")
        }
        Component(dashboard_routes_api_unsplash, "unsplash", "TypeScript", "1 ts")
        Component(dashboard_routes_api_verify, "verify", "TypeScript", "1 ts")
      }
      Boundary(dashboard_b_routes_course, "course") {
        Component(dashboard_routes_course__slug_, "[slug]", "TS + Svelte", "1 ts, 1 svelte")
      }
      Boundary(dashboard_b_routes_courses, "courses") {
        Boundary(dashboard_b_routes_courses__id_, "[id]") {
          Component(dashboard_routes_courses__id_, "[id] (files here)", "TS + Svelte", "1 ts, 2 svelte")
          Component(dashboard_routes_courses__id__analytics, "analytics", "TS + Svelte", "1 ts, 1 svelte")
          Component(dashboard_routes_courses__id__attendance, "attendance", "TS + Svelte", "1 ts, 1 svelte")
          Component(dashboard_routes_courses__id__certificates, "certificates", "TS + Svelte", "1 ts, 1 svelte")
          Component(dashboard_routes_courses__id__landingpage, "landingpage", "TS + Svelte", "1 ts, 1 svelte")
          Boundary(dashboard_b_routes_courses__id__lessons, "lessons") {
            Component(dashboard_routes_courses__id__lessons, "lessons (files here)", "TS + Svelte", "1 ts, 1 svelte")
            Component(dashboard_routes_courses__id__lessons_____lessonParams_, "[...lessonParams]", "TS + Svelte", "1 ts, 1 svelte")
          }
          Component(dashboard_routes_courses__id__marks, "marks", "TS + Svelte", "1 ts, 1 svelte")
          Boundary(dashboard_b_routes_courses__id__people, "people") {
            Component(dashboard_routes_courses__id__people, "people (files here)", "TS + Svelte", "2 ts, 2 svelte")
            Component(dashboard_routes_courses__id__people__personId_, "[personId]", "TS + Svelte", "1 ts, 1 svelte")
          }
          Component(dashboard_routes_courses__id__settings, "settings", "TS + Svelte", "1 ts, 1 svelte")
          Component(dashboard_routes_courses__id__submissions, "submissions", "TS + Svelte", "1 ts, 1 svelte")
        }
      }
      Component(dashboard_routes_csp_report, "csp-report", "TypeScript", "1 ts")
      Component(dashboard_routes_forgot, "forgot", "Svelte", "1 svelte")
      Component(dashboard_routes_home, "home", "Svelte", "1 svelte")
      Boundary(dashboard_b_routes_invite, "invite") {
        Boundary(dashboard_b_routes_invite_s, "s") {
          Component(dashboard_routes_invite_s__hash_, "[hash]", "TS + Svelte", "1 ts, 1 svelte")
        }
        Boundary(dashboard_b_routes_invite_t, "t") {
          Component(dashboard_routes_invite_t__hash_, "[hash]", "TS + Svelte", "1 ts, 1 svelte")
        }
      }
      Boundary(dashboard_b_routes_lms, "lms") {
        Component(dashboard_routes_lms, "lms (files here)", "Svelte", "2 svelte")
        Boundary(dashboard_b_routes_lms_community, "community") {
          Component(dashboard_routes_lms_community, "community (files here)", "Svelte", "1 svelte")
          Component(dashboard_routes_lms_community__slug_, "[slug]", "TS + Svelte", "1 ts, 1 svelte")
          Component(dashboard_routes_lms_community_ask, "ask", "Svelte", "1 svelte")
        }
        Component(dashboard_routes_lms_exercises, "exercises", "Svelte", "1 svelte")
        Component(dashboard_routes_lms_explore, "explore", "Svelte", "1 svelte")
        Component(dashboard_routes_lms_mylearning, "mylearning", "Svelte", "1 svelte")
        Component(dashboard_routes_lms_settings, "settings", "Svelte", "1 svelte")
      }
      Component(dashboard_routes_login, "login", "Svelte", "1 svelte")
      Component(dashboard_routes_logout, "logout", "Svelte", "1 svelte")
      Component(dashboard_routes_onboarding, "onboarding", "Svelte", "1 svelte")
      Boundary(dashboard_b_routes_org, "org") {
        Boundary(dashboard_b_routes_org__slug_, "[slug]") {
          Component(dashboard_routes_org__slug_, "[slug] (files here)", "TS + Svelte", "2 ts, 2 svelte")
          Boundary(dashboard_b_routes_org__slug__audience, "audience") {
            Component(dashboard_routes_org__slug__audience, "audience (files here)", "Svelte", "1 svelte")
            Component(dashboard_routes_org__slug__audience_____params_, "[...params]", "TS + Svelte", "1 ts, 1 svelte")
          }
          Boundary(dashboard_b_routes_org__slug__community, "community") {
            Component(dashboard_routes_org__slug__community, "community (files here)", "Svelte", "1 svelte")
            Component(dashboard_routes_org__slug__community__slug_, "[slug]", "TS + Svelte", "1 ts, 1 svelte")
            Component(dashboard_routes_org__slug__community_ask, "ask", "Svelte", "1 svelte")
          }
          Component(dashboard_routes_org__slug__courses, "courses", "TS + Svelte", "1 ts, 1 svelte")
          Boundary(dashboard_b_routes_org__slug__quiz, "quiz") {
            Component(dashboard_routes_org__slug__quiz, "quiz (files here)", "Svelte", "1 svelte")
            Component(dashboard_routes_org__slug__quiz__slug_, "[slug]", "TS + Svelte", "1 ts, 1 svelte")
          }
          Boundary(dashboard_b_routes_org__slug__settings, "settings") {
            Component(dashboard_routes_org__slug__settings, "settings (files here)", "Svelte", "1 svelte")
            Component(dashboard_routes_org__slug__settings_customize_lms, "customize-lms", "Svelte", "1 svelte")
            Component(dashboard_routes_org__slug__settings_domains, "domains", "Svelte", "1 svelte")
            Component(dashboard_routes_org__slug__settings_teams, "teams", "Svelte", "1 svelte")
          }
          Component(dashboard_routes_org__slug__setup, "setup", "TS + Svelte", "1 ts, 1 svelte")
        }
      }
      Boundary(dashboard_b_routes_profile, "profile") {
        Component(dashboard_routes_profile__id_, "[id]", "TS + Svelte", "1 ts, 1 svelte")
      }
      Component(dashboard_routes_reset, "reset", "Svelte", "1 svelte")
      Component(dashboard_routes_signup, "signup", "Svelte", "1 svelte")
      Component(dashboard_routes_upgrade, "upgrade", "Svelte", "1 svelte")
      Component(dashboard_routes_verify_email_error, "verify-email-error", "Svelte", "1 svelte")
    }
}

    Rel(dashboard_lib_mocks_react, dashboard_lib_mocks, "imports", "×33")
    Rel(dashboard_lib_mocks_react, dashboard_lib_utils_types, "imports", "×33")
    Rel(dashboard_lib_mocks_css, dashboard_lib_mocks, "imports", "×20")
    Rel(dashboard_lib_mocks_css, dashboard_lib_utils_types, "imports", "×20")
    Rel(dashboard_lib_mocks_git, dashboard_lib_mocks, "imports", "×20")
    Rel(dashboard_lib_mocks_git, dashboard_lib_utils_types, "imports", "×20")
    Rel(dashboard_lib_mocks_html, dashboard_lib_mocks, "imports", "×20")
    Rel(dashboard_lib_mocks_html, dashboard_lib_utils_types, "imports", "×20")
    Rel(dashboard_lib_mocks_js, dashboard_lib_mocks, "imports", "×20")
    Rel(dashboard_lib_mocks_js, dashboard_lib_utils_types, "imports", "×20")
    Rel(dashboard_lib_mocks_node, dashboard_lib_mocks, "imports", "×20")
    Rel(dashboard_lib_mocks_node, dashboard_lib_utils_types, "imports", "×20")
    Rel(dashboard_lib_mocks_php, dashboard_lib_mocks, "imports", "×20")
    Rel(dashboard_lib_mocks_php, dashboard_lib_utils_types, "imports", "×20")
    Rel(dashboard_lib_mocks_python, dashboard_lib_mocks, "imports", "×20")
    Rel(dashboard_lib_mocks_python, dashboard_lib_utils_types, "imports", "×20")
    Rel(dashboard_lib_mocks_vue, dashboard_lib_mocks, "imports", "×20")
    Rel(dashboard_lib_mocks_vue, dashboard_lib_utils_types, "imports", "×20")
    Rel(dashboard_lib_mocks_typescript, dashboard_lib_mocks, "imports", "×16")
    Rel(dashboard_lib_mocks_typescript, dashboard_lib_utils_types, "imports", "×16")
    Rel(dashboard_lib_utils_functions, dashboard_lib_utils_translations, "imports", "×10")
    Rel(dashboard_lib_components_Course_components_Lesson, dashboard_lib_utils_types, "imports", "×5")
    Rel(dashboard_lib_components_Course_components_Lesson, dashboard_lib_utils_functions, "imports", "×3")
    Rel(dashboard_lib_mocks, dashboard_lib_utils_types, "imports", "×3")
    Rel(dashboard_lib_utils_functions, dashboard_lib_utils_store, "imports", "×3")
    Rel(dashboard_lib_utils_services_org, dashboard_lib_utils_types, "imports", "×3")
    Rel(dashboard_lib_utils_store, dashboard_lib_utils_types, "imports", "×3")
    Rel(dashboard_lib_components_Course, dashboard_lib_utils_types, "imports", "×2")
    Rel(dashboard_lib_components_Course_components_Lesson, dashboard_lib_components_Question, "imports", "×2")
    Rel(dashboard_lib_utils_functions, dashboard_lib, "imports", "×2")
    Rel(dashboard_lib_utils_functions, dashboard_lib_utils_constants, "imports", "×2")
    Rel(dashboard_lib_utils_functions, dashboard_lib_utils_functions_routes, "imports", "×2")
    Rel(dashboard_lib_utils_functions, dashboard_lib_utils_services_posthog, "imports", "×2")
    Rel(dashboard_lib_utils_functions, dashboard_lib_utils_types, "imports", "×2")
    Rel(dashboard_lib_utils_functions_routes, dashboard_lib_utils_constants, "imports", "×2")
    Rel(dashboard_lib_utils_services_courses, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_lib_utils_services_courses, dashboard_lib_utils_types, "imports", "×2")
    Rel(dashboard_lib_utils_services_newsfeed, dashboard_lib_utils_types, "imports", "×2")
    Rel(dashboard_lib_utils_services_org, dashboard_lib_utils_store, "imports", "×2")
    Rel(dashboard_lib_utils_store, dashboard_lib_utils_constants, "imports", "×2")
    Rel(dashboard_routes, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_api_analytics_user, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_api_courses_analytics, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_api_courses_analytics, dashboard_lib_utils_types, "imports", "×2")
    Rel(dashboard_routes_api_courses_data, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_api_courses_exercises, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_api_courses_marks, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_api_courses_newsfeed, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_api_courses_submission, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_api_courses_submissions, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_routes_invite_t__hash_, dashboard_lib_utils_functions, "imports", "×2")
    Rel(dashboard_lib, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_lib_components_Apps_components_Poll, dashboard_lib_components_Snackbar, "imports", "×1")
    Rel(dashboard_lib_components_Apps_components_Poll, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_components_Course, dashboard_lib_components_Course_components_Lesson, "imports", "×1")
    Rel(dashboard_lib_components_Course, dashboard_lib_utils_constants, "imports", "×1")
    Rel(dashboard_lib_components_Course_components_Lesson, dashboard_lib_components_Confetti, "imports", "×1")
    Rel(dashboard_lib_components_Course_components_Lesson, dashboard_lib_components_Snackbar, "imports", "×1")
    Rel(dashboard_lib_components_Course_components_Lesson, dashboard_lib_utils_services_courses, "imports", "×1")
    Rel(dashboard_lib_components_Course_components_NewsFeed, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_lib_components_Course_components_Settings, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_lib_components_CourseLandingPage, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_lib_components_Courses, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_components_Courses, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_lib_components_UploadWidget, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_css, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_git, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_html, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_js, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_node, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_php, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_python, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_react, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_typescript, "imports", "×1")
    Rel(dashboard_lib_mocks, dashboard_lib_mocks_vue, "imports", "×1")
    Rel(dashboard_lib_utils_constants, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_lib_utils_functions, dashboard_lib_components_Course_components_People, "imports", "×1")
    Rel(dashboard_lib_utils_functions, dashboard_lib_utils_services_org, "imports", "×1")
    Rel(dashboard_lib_utils_functions, dashboard_lib_utils_services_sentry, "imports", "×1")
    Rel(dashboard_lib_utils_functions_routes, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_lib_utils_services_api, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_attendance, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_courses, dashboard_lib_components_Course_components_Lesson, "imports", "×1")
    Rel(dashboard_lib_utils_services_courses, dashboard_lib_components_Question, "imports", "×1")
    Rel(dashboard_lib_utils_services_courses, dashboard_lib_utils_constants, "imports", "×1")
    Rel(dashboard_lib_utils_services_courses, dashboard_lib_utils_services_api, "imports", "×1")
    Rel(dashboard_lib_utils_services_courses, dashboard_lib_utils_store, "imports", "×1")
    Rel(dashboard_lib_utils_services_dashboard, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_dashboard, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_lib_utils_services_lms, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_marks, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_middlewares, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_newsfeed, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_notification, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_org, dashboard_lib_utils_constants, "imports", "×1")
    Rel(dashboard_lib_utils_services_org, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_submissions, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_lib_utils_services_submissions, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_mail, dashboard_lib_utils_services_api, "imports", "×1")
    Rel(dashboard_routes, dashboard_lib_utils_constants, "imports", "×1")
    Rel(dashboard_routes, dashboard_lib_utils_services_org, "imports", "×1")
    Rel(dashboard_routes, dashboard_lib_utils_store, "imports", "×1")
    Rel(dashboard_routes, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_routes_api_admin_cleanup_tokens, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_api_admin_security_monitor, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_api_analytics_dash, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_api_analytics_dash, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_routes_api_analytics_user, dashboard_lib_utils_services_courses, "imports", "×1")
    Rel(dashboard_routes_api_analytics_user, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_routes_api_courses_analytics, dashboard_lib_utils_services_courses, "imports", "×1")
    Rel(dashboard_routes_api_courses_data, dashboard_lib_utils_constants, "imports", "×1")
    Rel(dashboard_routes_api_domain, dashboard_lib_utils_services_org, "imports", "×1")
    Rel(dashboard_routes_api_email_course_exercise_submission_update, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_course_newsfeed, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_api_email_course_newsfeed, dashboard_lib_utils_services_newsfeed, "imports", "×1")
    Rel(dashboard_routes_api_email_course_newsfeed, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_course_student_prove_payment, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_course_student_welcome, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_course_submission_update, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_course_teacher_student_buycourse, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_course_teacher_student_joined, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_course_teacher_welcome, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_invite, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_verify_email, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_api_email_verify_email, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_email_welcome, dashboard_mail, "imports", "×1")
    Rel(dashboard_routes_api_org_audience, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_api_org_team, dashboard_lib_utils_constants, "imports", "×1")
    Rel(dashboard_routes_api_org_team, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_api_polar_webhook, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_api_polar_webhook, dashboard_lib_utils_services_org, "imports", "×1")
    Rel(dashboard_routes_api_polar_webhook, dashboard_lib_utils_types, "imports", "×1")
    Rel(dashboard_routes_api_verify, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_course__slug_, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_course__slug_, dashboard_lib_utils_services_courses, "imports", "×1")
    Rel(dashboard_routes_invite_s__hash_, dashboard_lib_utils_functions, "imports", "×1")
    Rel(dashboard_routes_invite_s__hash_, dashboard_lib_utils_services_org, "imports", "×1")
    Rel(dashboard_routes_invite_t__hash_, dashboard_lib_utils_services_org, "imports", "×1")
    Rel(dashboard_routes_org__slug__setup, dashboard_lib_utils_functions, "imports", "×1")
```
