"use strict";

const Generator = require("yeoman-generator");
const Yeoman = require("yeoman-environment");
const Handlebars = require("handlebars");
const FS = require("fs");
const Zlib = require("zlib");
const Chalk = require("chalk");
const yosay = require("yosay");
const request = require("request");

const env = Yeoman.createEnv();

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.initialize = function() {
      this.destinationRoot("./dist");
      var dataPath = this.destinationPath("data.json");

      if (FS.existsSync(dataPath)) {
        const json = FS.readFileSync(dataPath);
        this.props = JSON.parse(json);
        opts.data = this.props;

        this.menu = env.create("Menu", { options: opts });
      }
    };

    this.initialize();
  }

  async prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(`Welcome to ${Chalk.red("Service Definition Model")} generator!`)
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

    if (!this.props) {
      const props = await this.prompt(prompts);
      this.props = props;
      this.menu = env.create("Menu", { options: this.options });
    }

    // eslint-disable-next-line no-await-in-loop
    while ((await this.menu.showCurrent()) !== 0);
  }

  async writing() {
    var templatePath = this.templatePath("service-package.handlebars");
    const template = FS.readFileSync(templatePath).toLocaleString();
    const Handlebars = require("handlebars");
    const json = JSON.stringify(this.props);
    var compiled = Handlebars.compile(template, {
      data: json
    });
    const result = compiled(this.props);
    const query = await compress(result);
    const url = query;

    download(url, `${this.props.serviceContextName}.svg`, function() {
      console.log("done");
    });

    FS.writeFileSync(this.destinationPath("service-package.puml"), result);
    this.saveProps();
  }

  install() {
    this.installDependencies();
  }

  saveProps() {
    const json = JSON.stringify(this.props);
    FS.writeFileSync(this.destinationPath("data.json"), json);
  }
};

class Menu extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.initialize = function() {
      console.log(JSON.stringify(opts.data));
      this.props = opts.data;
      this.state = "main";
    };

    this.initialize();
  }

  async menu() {
    const prompts = [
      {
        type: "list",
        choices: [
          "List Services",
          "Add Service",
          "Manage Service",
          "Exit",
          "Help"
        ],
        name: "mnuMain",
        message: "What would you like to do?",
        default: "Help"
      }
    ];

    const selection = await this.prompt(prompts);
    console.log(`selection: ${selection.mnuMain}`);

    // eslint-disable-next-line default-case
    switch (selection.mnuMain) {
      case "Help":
        this.help(this.props);
        break;

      case "Exit":
        return 0;

      case "List Services":
        this.state = "listServices";
        this.listServices(this.props);
        break;

      case "Add Service":
        this.state = "addService";
        this.addService(this.props);
        break;

      case "Manage Service":
        this.state = "manageService";
        this.manageService(this.props);
        break;
    }
  }

  async addService(data) {
    if (!data) return;

    const prompts = [
      {
        type: "input",
        name: "serviceName",
        message: "What is the name of your service?",
        default: this.props.serviceName || "default"
      }
    ];

    var service = await this.prompt(prompts);

    let services = data.services ? data.services : [];

    if (!services.find(item => item.serviceName === service.serviceName)) {
      services.push(service);
    }

    this.props.services = services;

    this.saveProps();
    this.state = "main";
  }

  async showCurrent() {
    let result = null;
    switch (this.state) {
      case "main":
        result = await this.menu();
        break;

      default:
        this.help(this.props);
        break;
    }

    if (result === 0) return 0;
  }
}

env.registerStub(Menu, "Menu");

Handlebars.registerHelper("toUpperCase", function(item, _) {
  return item.type.toUpperCase();
});

Handlebars.registerHelper("stereotype", function(item, _) {
  if (item.stereotype) {
    return `class ${item.name} << ${item.stereotype} >>`;
  }
});

Handlebars.registerHelper("inherits", function(context, _) {
  if (!context.associations) return;

  const inherits = context.associations.filter(item => {
    return item.associationType === "extends";
  });

  let result = "";

  if (inherits.length > 0) {
    const inheritsString = inherits.map(item => item.type).join(", ");
    result = `class ${context.name} extends ${inheritsString}`;
  }

  return new Handlebars.SafeString(result);
});

// eslint-disable-next-line no-unused-vars
Handlebars.registerHelper("list", function(context, _options) {
  const dtObject = context;
  let result = "";
  if (dtObject.associations) {
    for (let i = 0; i < dtObject.associations.length; ++i) {
      const assoc = context.associations[i];

      switch (assoc.associationType) {
        case "directed":
          result += new Handlebars.SafeString(
            `${dtObject.name} -r-> ${assoc.type} : ${assoc.text}\n`
          );
          break;

        case "contains":
          result += new Handlebars.SafeString(
            `${dtObject.name} -r-* ${assoc.type}\n`
          );
          break;

        case "aggregation":
          result += new Handlebars.SafeString(
            `${dtObject.name} "${assoc.localMultiplicity}" -r-o "${assoc.remoteMultiplicity}" ${assoc.type} : ${assoc.text}\n`
          );
          break;

        case "implements":
          result += new Handlebars.SafeString(
            `${dtObject.name} --() ${assoc.type}\n`
          );
          break;

        case "extends":
          result += new Handlebars.SafeString(
            `${dtObject.name} -[hidden]r> ${assoc.type}\n`
          );
          break;

        default:
          break;
      }
    }
  }

  return result;
});

var download = function(uri, filename, callback) {
  request.head(uri, function(err) {
    if (err) throw err;

    request(uri)
      .pipe(FS.createWriteStream(filename))
      .on("close", callback);
  });
};

async function compress(s, change) {
  let str = unescape(s);
  str = str.replace(/&lt;/g, "<");
  str = str.replace(/&gt;/g, ">");
  str = str.replace(/&quot;/g, '"');
  str = str.replace(/&amp;/g, "&");
  var result = await zipDeflate(str, change, 9);

  return result;
}

async function zipDeflate(s, change, options) {
  const result = await new Promise((resolve, reject) => {
    Zlib.deflate(s, options, (error, deflated) => {
      if (error) reject(error);

      let dest = "http://www.plantuml.com/plantuml/svg/~1";

      if (change) dest = "http://www.plantuml.com/plantuml/umla/~1";

      dest += encode64(deflated);

      resolve(dest);
    });
  })
    .then()
    .catch(error => {
      throw error;
    });

  return result;
}

function encode64(data) {
  let r = "";
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      r += append3bytes(data[i], data[i + 1], 0);
    } else if (i + 1 === data.length) {
      r += append3bytes(data[i], 0, 0);
    } else {
      r += append3bytes(data[i], data[i + 1], data[i + 2]);
    }
  }

  return r;
}

function append3bytes(b1, b2, b3) {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  let r = "";
  r += encode6bit(c1 & 0x3f);
  r += encode6bit(c2 & 0x3f);
  r += encode6bit(c3 & 0x3f);
  r += encode6bit(c4 & 0x3f);
  return r;
}

function encode6bit(b) {
  if (b < 10) {
    return String.fromCharCode(48 + b);
  }

  b -= 10;
  if (b < 26) {
    return String.fromCharCode(65 + b);
  }

  b -= 26;
  if (b < 26) {
    return String.fromCharCode(97 + b);
  }

  b -= 26;
  if (b === 0) {
    return "-";
  }

  if (b === 1) {
    return "_";
  }

  return "?";
}
