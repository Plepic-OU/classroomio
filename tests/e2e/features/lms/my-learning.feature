Feature: My Learning

  @student
  Scenario: Page shows heading, search box, and tabs
    Given I am on the My Learning page
    Then I should see the My Learning heading
    And I should see the In Progress tab
    And I should see the Complete tab
    And I should see the course search box

  @student
  Scenario: Empty state when student has no enrolled courses
    Given I am on the My Learning page
    Then I should see the no in-progress courses message

  @student
  Scenario: Enrolled course with lessons appears in In Progress tab
    Given I am enrolled in a course with lessons
    And I am on the My Learning page
    Then I should see the enrolled course in the In Progress tab

  @student
  Scenario: Switching to Complete tab shows empty state
    Given I am on the My Learning page
    When I click the Complete tab
    Then I should see the no completed courses message
