// Generated from: features/course-creation.feature
import { test } from "../../steps/fixtures.ts";

test.describe('Course Creation', () => {

  test.beforeEach('Background', async ({ Given, And, page }, testInfo) => { if (testInfo.error) return;
    await Given('I am logged in as "admin@test.com" with password "123456"', null, { page }); 
    await And('I am on the courses page', null, { page }); 
  });
  
  test('Create a new course', async ({ When, Then, And, page }) => { 
    await When('I click the "Create Course" button', null, { page }); 
    await And('the course creation modal opens', null, { page }); 
    await And('I click the "Next" button', null, { page }); 
    await And('I fill in the course title "Test Course"', null, { page }); 
    await And('I fill in the course description "A test description for the course"', null, { page }); 
    await And('I submit the course form', null, { page }); 
    await Then('I should see "Test Course" in the courses list', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/course-creation.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":11,"pickleLine":7,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given I am logged in as \"admin@test.com\" with password \"123456\"","isBg":true,"stepMatchArguments":[{"group":{"start":18,"value":"\"admin@test.com\"","children":[{"start":19,"value":"admin@test.com","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"},{"group":{"start":49,"value":"\"123456\"","children":[{"start":50,"value":"123456","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"And I am on the courses page","isBg":true,"stepMatchArguments":[]},{"pwStepLine":12,"gherkinStepLine":8,"keywordType":"Action","textWithKeyword":"When I click the \"Create Course\" button","stepMatchArguments":[{"group":{"start":12,"value":"\"Create Course\"","children":[{"start":13,"value":"Create Course","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":13,"gherkinStepLine":9,"keywordType":"Action","textWithKeyword":"And the course creation modal opens","stepMatchArguments":[]},{"pwStepLine":14,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"And I click the \"Next\" button","stepMatchArguments":[{"group":{"start":12,"value":"\"Next\"","children":[{"start":13,"value":"Next","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":15,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"And I fill in the course title \"Test Course\"","stepMatchArguments":[{"group":{"start":27,"value":"\"Test Course\"","children":[{"start":28,"value":"Test Course","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":16,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"And I fill in the course description \"A test description for the course\"","stepMatchArguments":[{"group":{"start":33,"value":"\"A test description for the course\"","children":[{"start":34,"value":"A test description for the course","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":17,"gherkinStepLine":13,"keywordType":"Action","textWithKeyword":"And I submit the course form","stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":14,"keywordType":"Outcome","textWithKeyword":"Then I should see \"Test Course\" in the courses list","stepMatchArguments":[{"group":{"start":13,"value":"\"Test Course\"","children":[{"start":14,"value":"Test Course","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end