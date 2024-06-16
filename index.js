const { hydrate } = require("@grammyjs/hydrate");

const path = require("path");
const process = require("process");
const fs = require("fs");

// install required classes
const { Bot, GrammyError, HttpError, InlineKeyboard } = require("grammy");

const database = require("./sheets-database.js");

const BOT_TOKEN_PATH = path.join(process.cwd(), "bot-token.json");

const file_content = fs.readFileSync(BOT_TOKEN_PATH);
const bot_token = JSON.parse(file_content).bot_token;

process.env.BOT_TOKEN = bot_token;
const bot = new Bot(process.env.BOT_TOKEN);
bot.use(hydrate());

//error handler
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// menu

bot.api.setMyCommands([
  { command: "start", description: "Запуск бота" },
  { command: "topic", description: "Предложить тему" },
  { command: "project", description: "Рассказать о проекте" },
  { command: "improvements", description: "Оставить пожелания" },
]);

// keybord of starting message
const startKeyboard = new InlineKeyboard()
  .text("Предложить тему", "topic_btn")
  .row()
  .text("Рассказать о проекте", "project_btm")
  .row()
  .text("Оставить пожелания", "improve_btm");

const backKeyboard = new InlineKeyboard().text("< Назад", "back_btn");

const defaultSheetName = "Несортированные!";

let sheetName = defaultSheetName;

//
function getButtonMetaData(buttonName) {
  if (buttonName === "topic_btn") {
    sheetName = "Темы!";
    return;
  }

  if (buttonName === "project_btm") {
    sheetName = "Проекты!";
    return;
  }

  if (buttonName === "improve_btm") {
    sheetName = "Пожелания!";
    return;
  }

  if (buttonName === "back_btn") {
    sheetName = "Несортированные!";
    return;
  }
}

// message when a user starts conversation
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет, это бот «Цифровой истории»!\n\nСюда можно отправить любые предложения, новости и пожелания. \n\nО чем хотите написать?",
    { reply_markup: startKeyboard }
  );
});

//handlers for start keyboard buttons
bot.callbackQuery("topic_btn", async (ctx) => {
  await ctx.callbackQuery.message.editText("О чем нам рассказать?", {
    reply_markup: backKeyboard,
  });
  await ctx.api.editMessageText;
  await ctx.answerCallbackQuery();
  getButtonMetaData("topic_btn");
});

bot.callbackQuery("project_btm", async (ctx) => {
  await ctx.callbackQuery.message.editText(
    "Чем Вы занимаетесь?\n\nРасскажите в нескольких предложениях о проекте и оставьте контакт для связи.",
    { reply_markup: backKeyboard }
  );
  await ctx.api.editMessageText;
  await ctx.answerCallbackQuery();
  getButtonMetaData("project_btm");
});

bot.callbackQuery("improve_btm", async (ctx) => {
  await ctx.callbackQuery.message.editText(
    "Любые идеи и конструктивная критика приветствуются. Помогите нам стать лучше!",
    { reply_markup: backKeyboard }
  );
  await ctx.api.editMessageText;
  await ctx.answerCallbackQuery();
  getButtonMetaData("improve_btm");
});

bot.callbackQuery("back_btn", async (ctx) => {
  await ctx.callbackQuery.message.editText(
    "Привет, это бот «Цифровой истории»!\n\nСюда можно отправить любые предложения, новости и пожелания. \n\nО чем хотите написать?",
    { reply_markup: startKeyboard }
  );
  await ctx.api.editMessageText;
  await ctx.answerCallbackQuery();
  getButtonMetaData("back_btn");
});

//command handlers
bot.command("topic", async (ctx) => {
  await ctx.reply("О чем нам рассказать?", { reply_markup: backKeyboard });
  getButtonMetaData("topic_btn");
});

bot.command("project", async (ctx) => {
  await ctx.reply(
    "Чем Вы занимаетесь?\n \nРасскажите в нескольких предложениях о проекте и оставьте контакт для связи.",
    { reply_markup: backKeyboard }
  );
  getButtonMetaData("project_btm");
});

bot.command("improvements", async (ctx) => {
  await ctx.reply(
    "Любые идеи и конструктивная критика приветствуются. Помогите нам стать лучше!",
    { reply_markup: backKeyboard }
  );
  getButtonMetaData("improve_btm");
});

async function returnMenu(ctx) {
  await ctx.reply(
    "Спасибо, что нашли время и написали нам! \n \n Хотите еще что-нибудь написать?",
    { reply_markup: startKeyboard }
  );
}

bot.start();
console.log("Бот запущен");

bot.on("message", async (ctx) => {
  const message = ctx.message;
  const utcDate = new Date(message.date * 1000);
  const date = utcDate.toLocaleString();

  const mesInfo = [
    [
      message.chat.id,
      message.chat.username,
      message.chat.first_name,
      message.chat.last_name,
      date,
      message.text,
    ],
  ];

  (async () => {
    const auth = await database.authorize();
    try {
      const lastMessageNumber = await database.getMessagesNumber(
        auth,
        sheetName
      );
      const counter = database.counterStartValue + lastMessageNumber;
      const currentCell = sheetName + database.startColomn + counter;

      database.writeFeedback(auth, mesInfo, currentCell);

      returnMenu(ctx);

      sheetName = defaultSheetName;
    } catch (error) {
      console.log(error);
    }
  })();
});
