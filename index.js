/**
 * index.js
 * * Main entry point for the application.
 * Imports and starts the server defined in the 'lib' directory.
 * * As per package.json, this is the main file executed by 'npm start'.
 */
// The path assumes you have moved server.js into a new 'lib' folder.
require('./lib/server');

// No need for any other code here, as the server.js file handles the setup
// and the 'app.listen' call, which keeps the process running.
console.log("Server module loaded and starting...");