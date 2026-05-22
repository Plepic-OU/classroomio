Feature: Edit Course Title

  @auth-admin
  Scenario: edit-course-title
    Given I am on the org dashboard
    And I create a course named "Course_edit-course-title"
    When I navigate to the course settings
    And I update the course title to "Course_edit-course-title_updated"
    And I save the course settings
    Then the course title should be "Course_edit-course-title_updated"
