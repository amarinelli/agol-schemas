var writeFile = require('fs-writefile-promise');
var readFile = require('fs-readfile-promise');
var readFiles = require('read-files-promise');
var path = require('path');
var config = require('../config/config');
var util = require('../util');
var documentation = require('documentation');
var RSVP = require('rsvp');

/**
 * Takes a block of text and wraps URL into a Markdown link.
 * For example: this text "Search using http://google.com"
 * is turned into "Search using [http://google.com](http://google.com)"
 * An optional linkText can be display text for the URL
 * The above example would be: "Search using [Google](http://google.com)"
 * @param {string} paragraph Block of text to be searched into for URLs
 * @param {string} [linkText=""] Text to be displayed for the URL. If this is missing, the URL is used as text.
 * @return {string} Block of text with all URLs turned into Markdown links.
 */
function markdownLinks(paragraph, linkText) {
  var urlRegex = /(https?:\/\/[^\s]+)/g;
  return paragraph.replace(urlRegex, function (url) {
    if (!linkText) {
      linkText = url;
    }
    return "[" + linkText + "](" + url + ")";
  })
}

/**
 * Extract Description from Schema and correctly markdown URLs in it.
 * @param {object} schema The schema who's name and description will be extracted.
 * @returns {string} Schema description with URLs markdowned.
 */
function getSchemaDescription(schema) {
  for (var prop in schema) {
    if (prop === "description" && typeof (schema[prop]) == "string") {
      return markdownLinks(schema[prop], "source");
    }
  }
}

/**
 * Collect descriptions of all schemas.
 * @returns {object} Promise. The resolve function has no parameters.
 */
function collectDescriptions() {
  return new RSVP.Promise(function (resolve, reject) {
    var schemasWithDesc = "";
    var schemaFiles = util.getAllFilesFromFolder(config.schemasFolder);

    // Get path of schema file
    var schemas = schemaFiles.map(function (sf) {
      return path.basename(sf, ".json");
    });

    // Read schema file
    readFiles(schemaFiles, { encoding: 'utf8' }).then(function (contentsBuffers) {

      var contents = contentsBuffers.map(function (buffer) { return buffer.toString(); });
      contents.forEach(function (schemaFileContent, index) {
        var schema = JSON.parse(schemaFileContent);
        var schemaDesc = getSchemaDescription(schema);
        schemasWithDesc += "* **" + schemas[index] + "**: " + schemaDesc + "  \n";
      });

      // Write to file
      writeFile(path.resolve(__dirname, '..', config.docFolder + "/" + config.schemasDocFile), schemasWithDesc).then(function () {
        resolve();
      });
    });
  });
}

/**
 * Generate documentation for code files. It reads the JSDoc comments and generate markdown files for them. One markdown file is generated for each code file.
 * @returns {object} Promise. The resolve function has no parameters.
 */
function generateCodeDocs() {
  return new RSVP.Promise(function (resolve, reject) {
    var promises = config.codeFiles.map(function (jsFile) {
      return path.resolve(__dirname, '..', jsFile);
    })
    .map(function (jsFile) {
      return new RSVP.Promise(function (resolve, reject) {
        var jf = [jsFile];
        documentation(jf, { shallow: true }, function (err, result) {
          documentation.formats.md(result, {}, function (err, md) {
            // Write to file
            writeFile(path.resolve(__dirname, '..', config.docFolder + "/" + jsFile.replace(/^.*[\\\/]/, '') + ".md"), md).then(resolve);
          });
        });
      });
    });
    RSVP.all(promises).then(resolve);
  });
}

module.exports = {
  collectDescriptions: collectDescriptions,
  generateCodeDocs: generateCodeDocs
};
