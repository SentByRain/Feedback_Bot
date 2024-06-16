const fs = require("fs");
const fs_async = require("fs").promises;

const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const { GoogleAuth } = require("google-auth-library");

// If modifying these scopes, delete token.json and then refresh
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]; //this scope for editing sheets. More scopes at https://developers.google.com/identity/protocols/oauth2/scopes#sheets

// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.

const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

const SHEET_ID_PATH = path.join(process.cwd(), "sheet-id.json");
const id_file_content = fs.readFileSync(SHEET_ID_PATH);
const sheet_ID = JSON.parse(id_file_content).sheet_id;

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs_async.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs_async.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs_async.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    access_type: "offline",
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    console.log(client.credentials);
    await saveCredentials(client);
  }
  return client;
}

const startColomn = "A";
const counterStartValue = 2; //2 row - in the 1 colums name - wtf??

async function getMessagesNumber(auth, sheetPage) {
  const sheets = google.sheets({ version: "v4", auth });

  const counterCell = sheetPage + "H3";

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: sheet_ID,
    range: counterCell,
  });

  const messageCounter = Number(result.data.values);
  return messageCounter;
}

async function writeFeedback(auth, values, cell) {
  const sheets = google.sheets({ version: "v4", auth });

  const resource = {
    values,
  };

  const range = cell;

  const result = await sheets.spreadsheets.values.update({
    spreadsheetId: sheet_ID,
    range,
    valueInputOption: "USER_ENTERED",
    resource,
  });

  console.log("%d cells updated.", result.data.updatedCells);
  return result;
}

module.exports.authorize = authorize;
module.exports.getMessagesNumber = getMessagesNumber;
module.exports.writeFeedback = writeFeedback;

exports.startColomn = startColomn;
exports.counterStartValue = counterStartValue;
