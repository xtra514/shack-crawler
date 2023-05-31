require("dotenv").config();

import { Collection, MongoClient, MongoClientOptions } from "mongodb";
import axios from "axios";
import { load } from "cheerio";

import { logger, colors, animelistSuffixes } from "./utils/utils";
import { BASE_URL, connectToDB, getCollection } from "./helpers/";
import { validateDB } from "./resolvers/validate-db";
import { validateGogoanime } from "./resolvers/validate-gogoanime";
import { Gogoanime } from "./models";

let mongoClient: MongoClient;

// for testing purposes
let startTime: number, endTime: number;
global.config = {
  animesAdded: 0,
  animesUpdated: 0,
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

const startCrawler = async () => {
  logger.info(`\nStarting crawler... PID: ${process.pid}`, colors.blue);

  const gogoanimeColl = getCollection<Gogoanime>(mongoClient, process.env.DB_NAME!, "gogoanime")!;

  try {
    const tasks = animelistSuffixes.map((suffix) => handlePages(suffix, 1, gogoanimeColl));

    await Promise.all(tasks);

    logger.info("\nFinished crawling.", colors.green);
    await mongoClient.close();
    process.exit(0);
  } catch (err) {
    logger.error(`An error occurred: ${(err as Error).message}`);
    process.exit(1);
  }
};

const handlePages = async (suffix: string, page: number, gogoanimeColl: Collection<Gogoanime>): Promise<void> => {
  const url = `${BASE_URL}anime-list${suffix}?page=${page}`;

  logger.info(`\nScraping anime-list${suffix} page = ${page}...`, colors.blue);

  try {
    const html = await axios.get(url);
    const $ = load(html.data);

    const hasNextPage = $("div.anime_name.anime_list > div > div > ul > li.selected").next().length > 0;

    const animeList = $("section.content_left > div > div.anime_list_body > ul").children();

    const tasks = [];
    for (const anime of animeList) {
      const animeId = $(anime).find("a").attr("href")?.split("/")[2];

      if (animeId) {
        tasks.push(validateGogoanime(animeId, gogoanimeColl));
      }
    }

    await Promise.all(tasks);

    endTime = performance.now();
    logger.info(
      `Anime-list page = ${page} scraped. ${global.config.animesAdded} anime(s) added, ${
        global.config.animesUpdated
      } anime(s) updated.  ${((endTime - startTime) / 1000 / 60).toFixed(3)} minutes elapsed.`,
      colors.green
    );

    if (hasNextPage) {
      await handlePages(suffix, page + 1, gogoanimeColl);
    }
  } catch (err) {
    logger.error(`Error while scraping anime-list${suffix} page = ${page}: ${(err as Error).message}`);
  }
};

(async () => {
  validateEnviromentVariables();

  try {
    await connectToDB(mongoClient!);
    await validateDB(mongoClient!, process.env.DB_NAME!);

    startTime = performance.now();
    await startCrawler();
  } catch (err) {
    logger.error(`An error occurred: ${(err as Error).message}`);
    process.exit(1);
  }
})();
