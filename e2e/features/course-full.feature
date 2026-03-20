Feature: Course invite page capacity enforcement

  @course-full
  Scenario: Student sees "course full" message when course is at capacity
    Given I am logged in as "student@test.com"
    When I visit the invite link for the full course
    Then I should see the course is full message

  @course-full-waitlist
  Scenario: Student joins the waitlist when course is full with waitlist enabled
    Given I am logged in as "student@test.com"
    When I visit the invite link for the full course with waitlist
    Then I should see the join waitlist button
    When I click the join waitlist button
    Then I should see the waitlisted confirmation message
    And the student should be waitlisted in the database
