Feature: Course Waitlist

  Scenario: Teacher configures max capacity and waitlist in course settings
    Given the course "Getting started with MVC" has no capacity limit
    And I am logged in as "admin@test.com"
    And I am on the courses page
    When I open the course "Getting started with MVC"
    And I navigate to the settings tab
    And I set the max capacity to 50
    And I enable the waitlist toggle
    And I save the course settings
    Then I should see a success notification

  Scenario: Student sees Join Waitlist when course is full with waitlist enabled
    Given the course "Getting started with MVC" is full with waitlist enabled
    And the student is not on the waitlist for "Getting started with MVC"
    When I visit the course landing page for "Getting started with MVC"
    Then I should see a "Join Waitlist" button

  Scenario: Student sees Course Full when waitlist is disabled
    Given the course "Getting started with MVC" is full with waitlist disabled
    When I visit the course landing page for "Getting started with MVC"
    Then I should see a disabled "Course Full" button

  Scenario: Teacher approves a waitlisted student
    Given the course "Getting started with MVC" is full with waitlist enabled
    And the student is on the waitlist for "Getting started with MVC"
    And the student is not enrolled in "Getting started with MVC"
    And I am logged in as "admin@test.com"
    When I open the course "Getting started with MVC"
    And I navigate to the people tab
    And I select the "Waitlist" filter
    Then I should see "John Doe" in the waitlist
    When I click the approve button for "John Doe"
    Then I should see a student approved notification
    # Cleanup: restore course to unlimited capacity for other tests
    Given the course "Getting started with MVC" has no capacity limit
