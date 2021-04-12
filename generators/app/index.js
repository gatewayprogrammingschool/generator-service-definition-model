"use strict";
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const yosay = require("yosay");
const fs = require("fs");

module.exports = class extends Generator {
  constructor(args, opts) {
    // Calling the super constructor is important so our generator is correctly set up
    super(args, opts);

    this.initialize = function() {
      this.destinationRoot("./dist");
      var dataPath = this.destinationPath("data.json");

      if (fs.existsSync(dataPath)) {
        const json = fs.readFileSync(dataPath);
        this.props = JSON.parse(json);
      }
    };

    this.initialize();
  }

  prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(`Welcome to ${chalk.red("Service Definition Model")} generator!`)
    );

    const prompts = [
      {
        type: "input",
        name: "serviceContextName",
        message: "What is the name of your service context?",
        default: this.props.serviceContextName || "default"
      },
      {
        type: "list",
        choices: ["gRPC", "REST", "WCF", "Custom"],
        name: "serviceContextFramework",
        message: "What is the Framework for your Service?",
        default: this.props.serviceContextFramework || "gRPC"
      }
    ];

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
    });
  }

  writing() {
    var templatePath = this.templatePath("service-package.handlebars");
    const template = fs.readFileSync(templatePath).toLocaleString();
    const Handlebars = require("handlebars");
    const json = JSON.stringify(this.props);
    var compiled = Handlebars.compile(template, {
      data: json
    });
    const result = compiled(this.props);
    console.log(`compiled: ${result}`);
    fs.writeFileSync(this.destinationPath("service-package.puml"), result);
    fs.writeFileSync(this.destinationPath("data.json"), json);
  }

  install() {
    this.installDependencies();
  }
};
