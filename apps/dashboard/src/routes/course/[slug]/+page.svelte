<script lang="ts">
  import CourseLandingPage from '$lib/components/CourseLandingPage/index.svelte';
  import type { Course } from '$lib/utils/types';

  interface Data {
    course: Course;
    enrollmentCount: number;
    isOnWaitlist: boolean;
  }

  export let data: Data;

  let courseData: Course;

  function setCourseData(course: Course | null) {
    if (!course) return;

    courseData = { ...course };
  }

  $: setCourseData(data.course);
</script>

<CourseLandingPage {courseData} enrollmentCount={data.enrollmentCount} isOnWaitlist={data.isOnWaitlist} />
