Feature: Course Search

  Scenario: Search the course list by title
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    When I search the course list for "Pandas"
    Then I should see the course "Data Science with Python and Pandas" in the course list
    And I should not see the course "Modern Web Development with React" in the course list
