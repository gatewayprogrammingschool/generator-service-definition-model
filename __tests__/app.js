"use strict";
const path = require("path");
const assert = require("yeoman-assert");
const helpers = require("yeoman-test");

describe("generator-service-definition-model:app", () => {
  beforeAll(() => {
    console.log(__dirname);
    return helpers
      .run(path.join(__dirname, "../generators/app"))
      .withPrompts(/* { someAnswer: true } */);
  });

  it("creates files", () => {
    assert.file(["service-package.tmpl.js"]);
  });
});
