require("dotenv").config();

import { load } from "cheerio";

  const hasNextPage = page < 10;

  const animeList = (await scrapeRecentRelease($))!;

  for (const anime of animeList) {
    if (!(await validateGogoanimeV2(anime, gogoanimeColl))) {
      logger.error(`\nCould not validate animeId = ${anime.id}\n`);
    }
  }
  endTime = performance.now();
  logger.info(
    `type ${type} page = ${page} refreshed. ${global.config.animesAdded} anime(s) added, ${
      global.config.animesUpdated
    } anime(s) updated.  ${((endTime - startTime) / 1000 / 60).toFixed(3)} minutes elapsed.`,
    colors.green
  );

  if (hasNextPage) {
    await handlePages(type, page + 1);
  }
};

const validateEnviromentVariables = () => {
  logger.info("Checking enviroment variables...", colors.blue);
  if (!process.env.MONGO_URI || !process.env.DB_NAME) {
    throw new Error(
      `${colors.red}Missing environment variables. Please check the README.md file for more information.${colors.reset}`
    );
  }

  const mongoOptions: MongoClientOptions = {
    keepAlive: true,
  };

  mongoClient = new MongoClient(process.env.MONGO_URI!, mongoOptions);

  logger.info("Enviroment variables checked.", colors.green);
};

(async () => {
  logger.info
