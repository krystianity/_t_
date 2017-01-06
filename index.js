const App = require("./lib/App.js");
const config = require("./config.json");
const app = new App(config);
app.run();