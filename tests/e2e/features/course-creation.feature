Feature: Course Creation

  # No Background needed — storageState injects auth session from global-setup.ts

  Scenario: Create a new course
    Given I am on the courses page
    When I open the create course modal
    And I select the course type "Self Paced"
    And I fill in the title "[TEST] My Test Course" and description "A test course description"
    And I submit the form
    Then the course "[TEST] My Test Course" should be visible in the list
