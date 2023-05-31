require("dotenv").config();

import { load } from "cheerio";
import axios from "axios";
import { Collection, MongoClient, MongoClientOptions } from "mongodb";

import { logger, colors } from "./utils/utils";
import { scrapeRecentRelease, recent_release_url, getCollection, connectToDB } from "./helpers";
import { Types, Gogoanime } from "./models";
import { validateGogoanimeV2 } from "./resolvers/validate-gogoanime";

let mongoClient: MongoClient;
let gogoanimeColl: Collection<Gogoanime>;

let startTime: number, endTime: number;
global.config = {
  animesAdded: 0,
  animesUpdated: 0,
};

const startRefresh = async () => {
  logger.info(`\nStarting refreshing crawler... PID:${process.pid}`, colors.blue);

  gogoanimeColl = getCollection<Gogoanime>(mongoClient, process.env.DB_NAME!, "gogoanime")!;

  try {
    const tasks = [];
    for (const type of [Types.SUB, Types.DUB, Types.CHINESE]) {
      let page = 1;

      tasks.push(handlePages(type, page));
    }

    await Promise.all(tasks);

    logger.info(
      `\nFinished refreshing process. PID:${process.pid}, will start refreshing again right now.`,
      colors.green
    );
  } catch (err) {
    logger.error(`An error occurred: ${(err as Error).message}`);
    process.exit(1);
  }
};

const handlePages = async (type: number, page: number) => {
  const url = `${recent_release_url}?page=${page}&type=${type}`;

  logger.info(`\nScraping type ${type}, page ${page}...`, colors.blue);

  try {
    const html = await axios.get(url);
    const $ = load(html.data);

    const hasNextPage = page < 10;

    const animeList = (await scrapeRecentRelease($))!;

    const tasks = animeList.map((anime) => validateGogoanimeV2(anime, gogoanimeColl));
    await Promise.all(tasks);

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
  } catch (err) {
    logger.error(`Error while scraping type ${type}, page ${page}: ${(err as Error).message}`);
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
  logger.info(`\nStarting refreshing process...`, colors.blue);

  validateEnviromentVariables();
  startTime = performance.now();

  try {
    await connectToDB(mongoClient!);
    while (true) {
      await startRefresh();
    }
  } catch (err) {
    logger.error(`An error occurred: ${(err as Error).message}`);
    process.exit(1);
  }
})();
