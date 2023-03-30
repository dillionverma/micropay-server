import axios from "axios";
import { bech32 } from "bech32";
import { Job } from "bullmq";
import ConnectRedis from "connect-redis";
import cookieParser from "cookie-parser";
import cors from "cors";
import crypto, { randomBytes } from "crypto";
import express, { Request } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import createError from "http-errors";
import { StatusCodes } from "http-status-codes";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import { OAuth2Strategy as GoogleStrategy } from "passport-google-oauth";
import LnurlAuth from "passport-lnurl-auth";
import RedisStore from "rate-limit-redis";
import secp256k1 from "secp256k1";
import { Config, config } from "./config";
import { prisma } from "./db/prisma.service";
import { checkInvoiceQueue } from "./jobs/checkInvoice.job";
import { generationQueue } from "./jobs/dalle2.job";
import { stableDiffusionQueue } from "./jobs/stableDiffusion.job";
import { generateQueue, TaskParams } from "./jobs/task.job";
import AWS from "./services/aws.service";
import Dalle2 from "./services/dalle2.service";
import Lightning from "./services/lightning.service";
import OpenAI from "./services/openai.service";
import Pricing from "./services/pricing.service";
import { connection } from "./services/redis.service";
import Sentry from "./services/sentry.service";
import Stability from "./services/stableDiffusion.service";
import { Order, supabase } from "./services/supabase.service";
import { TelegramBot } from "./services/telegram.service";
import Twitter from "./services/twitter.service";
import { exclude, getHost, sleep } from "./utils";

export const lightning = new Lightning(
  config.lndMacaroonInvoice,
  config.lndHost,
  config.lndPort
);

export const twitter = new Twitter(
  config.twitterAppKey,
  config.twitterAppSecret,
  config.twitterAccessToken,
  config.twitterAccessSecret
);

export const openai = new OpenAI(config.openaiApiKey);

const hostURL = () => {
  if (process.env.NODE_ENV === "production") {
    return "https://micropay.ai";
  } else {
    return "http://localhost:3000";
  }
};

export const pricing = new Pricing();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const BUCKET_NAME = "dalle2-lightning";
// create a sha256 hash function
const sha256 = (data: string | Buffer) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

const sdLimiter = rateLimit({
  windowMs: 12 * 60 * 60 * 1000, // 12 hour window
  max: 9, // Limit each IP to 9 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Redis store configuration
  store: new RedisStore({
    sendCommand: (...args: string[]) => connection.call(...args),
  }),
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 60 * 1000, // 1 hour window
  max: 300, // Limit each IP to 300 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Redis store configuration
  store: new RedisStore({
    sendCommand: (...args: string[]) => connection.call(...args),
  }),
});

export const aws = new AWS(
  config.cloudflareAccountId,
  config.awsAccessKey,
  config.awsSecretKey
);

export const dalle2 = new Dalle2(config.dalleApiKey, config.dalleSecretKey);
export const stability = new Stability(config.stabilityApiKey);

export const telegramBot = new TelegramBot(
  config.telegramPrivateNotifierBotToken,
  config.telegramGenerationsBotToken,
  [config.telegramUserIdDillion, config.telegramUserIdHaseab],
  config.telegramGroupIdMicropay
);

const DEFAULT_PRICE = process.env.NODE_ENV === "production" ? 1000 : 50;

export enum ORDER_STATE {
  INVOICE_NOT_FOUND = "INVOICE_NOT_FOUND",
  INVOICE_NOT_PAID = "INVOICE_NOT_PAID",
  WEBLN_WALLET_DETECTED = "WEBLN_WALLET_DETECTED",

  DALLE_GENERATING = "DALLE_GENERATING",
  DALLE_UPLOADING = "DALLE_UPLOADING",
  DALLE_SAVING = "DALLE_SAVING",
  DALLE_GENERATED = "DALLE_GENERATED",
  DALLE_FAILED = "DALLE_FAILED",

  INVOICE_CANCELLED = "INVOICE_CANCELLED",
  USER_ERROR = "USER_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  REFUND_RECIEVED = "REFUND_RECIEVED",
}

export const MESSAGE: { [key in ORDER_STATE]: string } = {
  INVOICE_NOT_FOUND: "Invoice not found",
  INVOICE_NOT_PAID: "Order received! Waiting for payment...",
  WEBLN_WALLET_DETECTED: "WebLN wallet detected! Waiting for confirmation",

  DALLE_GENERATING:
    "Payment received! Dalle-2 is currently generating images...",
  DALLE_UPLOADING: "Images generated! Uploading images to cloud...",
  DALLE_SAVING: "Saving images.",
  DALLE_GENERATED: "Dalle-2 has generated images.",
  DALLE_FAILED:
    "Dalle-2 failed to generate images. Your payment has been refunded.",

  INVOICE_CANCELLED: "Invoice was cancelled",
  USER_ERROR: "An error occured",
  SERVER_ERROR: "An error occured on the server",
  REFUND_RECIEVED: "Refund recieved",
};

export const ORDER_PROGRESS: { [key in ORDER_STATE]?: number } = {
  INVOICE_NOT_FOUND: 0,

  INVOICE_NOT_PAID: 20,
  WEBLN_WALLET_DETECTED: 40,
  DALLE_GENERATING: 60,
  DALLE_UPLOADING: 80,
  DALLE_SAVING: 90,

  DALLE_FAILED: 0,
  INVOICE_CANCELLED: 0,
  USER_ERROR: 0,
  SERVER_ERROR: 0,
};

const sendMockImages = async (res, prompt) => {
  const images = [
    "https://cdn.openai.com/labs/images/3D%20render%20of%20a%20cute%20tropical%20fish%20in%20an%20aquarium%20on%20a%20dark%20blue%20background,%20digital%20art.webp?v=1",
    "https://cdn.openai.com/labs/images/An%20armchair%20in%20the%20shape%20of%20an%20avocado.webp?v=1",
    "https://cdn.openai.com/labs/images/An%20expressive%20oil%20painting%20of%20a%20basketball%20player%20dunking,%20depicted%20as%20an%20explosion%20of%20a%20nebula.webp?v=1",
    "https://cdn.openai.com/labs/images/A%20photo%20of%20a%20white%20fur%20monster%20standing%20in%20a%20purple%20room.webp?v=1",
  ];
  await res.status(StatusCodes.OK).send({
    status: ORDER_STATE.DALLE_GENERATED,
    message: MESSAGE.DALLE_GENERATED,
    images: images,
  });
};

const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  next(createError(StatusCodes.UNAUTHORIZED, "Unauthorized user"));
};

export const init = (config: Config) => {
  const app = express();

  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());

  app.use(
    cors({
      credentials: true, // allow session cookie from browser to pass through
      origin: [
        "http://localhost:3000",
        "https://micropay.ai",
        "https://lightning-api-frontend.onrender.com",
      ], // allow to server to accept request from different origin
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
      // allowedHeaders: "Content-Type, Authorization, X-Requested-With",
    })
  );

  app.set("trust proxy", true);
  app.use(cookieParser());

  app.use(express.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded
  app.use(express.json()); // parse application/json

  app.use(
    session({
      store: new (ConnectRedis(session))({ client: connection }),
      resave: false,
      saveUninitialized: false,
      secret: "SECRET",
      // name: "micropay-auth",
      cookie: {
        // maxAge: 1000 * 60 * 60 * 24 * 1,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "development" ? false : true,
      }, // 1 day expiration
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser(function (user, cb) {
    cb(null, user.id);
  });

  passport.deserializeUser(async function (id: string, cb) {
    console.log("deserialize: ", id);
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            followers: true,
            following: true,
          },
        },
      },
    });

    cb(null, user);
  });

  passport.use(
    new LnurlAuth.Strategy(async function (linkingPublicKey: string, done) {
      const account = await prisma.account.upsert({
        where: {
          linkingPublicKey,
        },
        update: {
          linkingPublicKey,
        },
        create: {
          type: "lnurl-auth",
          linkingPublicKey,
          user: {
            create: {
              name: linkingPublicKey.slice(0, 10),
              username: linkingPublicKey.slice(0, 10),
              email: null,
              image: null,
            },
          },
        },
        include: {
          user: {
            include: {
              _count: {
                select: {
                  followers: true,
                  following: true,
                },
              },
            },
          },
        },
      });
      done(null, account.user);
    })
  );

  app.use(passport.authenticate("lnurl-auth"));

  const map = {
    session: new Map(),
  };

  app.get("/api/auth/lightning", async (req, res) => {
    console.log("Lightning auth route test");
    let k1 = generatek1();
    map.session.set(k1, req.session);

    console.log("Lightning auth route test 1");

    const lnauth = await prisma.lnAuth.create({
      data: {
        k1,
      },
    });

    console.log("Lightning auth route test 2");

    return res.status(200).json({
      status: "OK",
      url: encodedUrl(
        process.env.NODE_ENV === "development"
          ? "https://6466-2607-fea8-5a1-4f00-55ee-c6f5-b58a-841f.ngrok.io/api/auth/lightning/callback"
          : "https://api.micropay.ai/api/auth/lightning/callback",
        "login",
        lnauth.k1
      ),
    });
  });

  app.get(
    "/api/auth/lightning/callback", // THIS CANNOT BE CHANGED BECAUSE USERS WILL NOT BE ABLE TO LOGIN AGAIN
    async (
      req: Request<
        unknown,
        unknown,
        unknown,
        { sig: string; k1: string; key: string }
      >,
      res
    ) => {
      // https://github.com/stackernews/stacker.news/blob/master/pages/api/lnauth.js
      if (req.query.k1 || req.query.key || req.query.sig) {
        let session: Request["session"] | null = null;
        session = map.session.get(req.query.k1);

        try {
          const sig = Buffer.from(req.query.sig, "hex");
          const k1 = Buffer.from(req.query.k1, "hex");
          const key = Buffer.from(req.query.key, "hex");
          const signature = secp256k1.signatureImport(sig);

          if (!secp256k1.ecdsaVerify(signature, k1, key))
            return res
              .status(400)
              .json({ status: "ERROR", reason: "invalid signature" });

          const auth = await prisma.lnAuth.findUnique({
            where: { k1: req.query.k1 },
          });

          if (
            !auth ||
            auth.linkingPublicKey ||
            auth.createdAt < new Date(Date.now() - 1000 * 60 * 60) // 1 hour
          ) {
            return res
              .status(400)
              .json({ status: "ERROR", reason: "token expired" });
          }

          // session.lnurlAuth = session.lnurlAuth || {};
          // session.user = session.user || {};
          // session.lnurlAuth.linkingPublicKey = req.query.key;

          const account = await prisma.account.upsert({
            where: {
              linkingPublicKey: req.query.key,
            },
            create: {
              type: "lnurl-auth",
              linkingPublicKey: req.query.key,
              user: {
                create: {
                  name: req.query.key.slice(0, 10),
                  username: req.query.key.slice(0, 10),
                  email: null,
                  image: null,
                },
              },
            },
            update: {
              type: "lnurl-auth",
              linkingPublicKey: req.query.key,
            },
            include: {
              user: true,
            },
          });

          // session.user = account.user;
          session.passport = session.passport || {};
          session.passport.user = account.user.id;

          return new Promise<void>((resolve, reject) => {
            return session.save((error) => {
              if (error) return reject(error);
              // Overwrite the req.session object.
              // Fix when the express-session option "resave" is set to true.
              req.session = session;
              res.status(200).json({ status: "OK" });
              resolve();
            });
          });
        } catch (error) {
          console.log("ERROR");
          console.log(error);
        }
      }

      console.log("ERROR RETURN");

      // https://github.com/lnurl/luds/blob/luds/04.md#wallet-to-service-interaction-flow
      let reason = "signature verification failed";
      if (!req.query.sig) {
        reason = "no sig query variable provided";
      } else if (!req.query.k1) {
        reason = "no k1 query variable provided";
      } else if (!req.query.key) {
        reason = "no key query variable provided";
      }
      return res.status(400).json({ status: "ERROR", reason });
    }
  );

  function encodedUrl(iurl, tag, k1) {
    const url = new URL(iurl);
    url.searchParams.set("tag", tag);
    url.searchParams.set("k1", k1);
    // bech32 encode url
    const words = bech32.toWords(Buffer.from(url.toString(), "utf8"));
    return bech32.encode("lnurl", words, 1023);
  }

  function generatek1() {
    return randomBytes(32).toString("hex");
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: "/api/auth/google/callback",
      },
      async function (accessToken, refreshToken, profile, done) {
        const account = await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: profile.id,
            },
          },
          update: {
            refresh_token: refreshToken,
            access_token: accessToken,
          },
          create: {
            type: "oauth",
            provider: "google",
            providerAccountId: profile.id,
            refresh_token: refreshToken,
            access_token: accessToken,
            user: {
              create: {
                name: profile.displayName,
                username: profile.emails[0].value.split("@")[0],
                email: profile.emails[0].value,
                // emailVerified: profile.emails[0].verified,
                image: profile.photos[0].value,
              },
            },
          },
          include: {
            user: true,
          },
        });
        return done(null, account.user);
      }
    )
  );

  passport.use(
    new DiscordStrategy(
      {
        clientID: config.discordClientId,
        clientSecret: config.discordClientSecret,
        callbackURL: "/api/auth/discord/callback",
        scope: ["identify", "email"],
      },
      async function (accessToken, refreshToken, profile, done) {
        console.log(profile);
        console.log(accessToken, refreshToken);
        const account = await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "discord",
              providerAccountId: profile.id,
            },
          },
          update: {
            refresh_token: refreshToken,
            access_token: accessToken,
          },
          create: {
            type: "oauth",
            provider: "discord",
            providerAccountId: profile.id,
            refresh_token: refreshToken,
            access_token: accessToken,
            user: {
              create: {
                name: profile.username,
                email: profile.email,
                image: profile.image_url,
                username: profile.username,
              },
            },
          },
          include: {
            user: true,
          },
        });
        return done(null, account.user);
      }
    )
  );

  app.get("/", async (req, res, next) => {
    res.status(StatusCodes.OK).send("Hello World");
  });

  app.get("/api/me", isAuthenticated, async (req, res, next) => {
    res.status(StatusCodes.OK).send(req.user);
  });

  app.put(
    "/api/me",
    isAuthenticated,
    async (
      req: Request<
        unknown,
        unknown,
        { name?: string; username?: string; image?: string },
        unknown
      >,
      res
    ) => {
      const user = await prisma.user.update({
        where: {
          id: req.user.id,
        },
        data: {
          name: req.body.name,
          username: req.body.username,
          image: req.body.image,
        },
      });
      res.status(StatusCodes.OK).send(user);
    }
  );

  app.delete("/api/auth", isAuthenticated, async (req, res, next) => {
    res.clearCookie("connect.sid");
    req.logOut(function (err) {
      if (err) return next(err);
      return res.status(StatusCodes.OK).send("Logged out");
    });
  });

  app.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  app.get(
    "/api/auth/discord",
    passport.authenticate("discord", { scope: ["identify", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/error",
      session: true,
    }),
    function (req, res) {
      res.redirect(hostURL());
    }
  );

  app.get(
    "/api/auth/discord/callback",
    passport.authenticate("discord", {
      failureRedirect: "/error",
      session: true,
    }),
    function (req, res) {
      res.redirect(hostURL());
    }
  );

  app.post(
    "/api/generations/:id/like",
    isAuthenticated,
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const { id } = req.params;
      const imageId = req.params.id;
      const userId = req.user.id;

      if (!id)
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "missing id" });

      try {
        const like = await prisma.like.create({
          data: {
            userId,
            imageId,
          },
        });
        return res.json({ like });
      } catch (e) {
        console.error(e);
      }
    }
  );

  app.delete(
    "/api/generations/:id/like",
    isAuthenticated,
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const { id } = req.params;

      const imageId = req.params.id;
      const userId = req.user.id;

      if (!id)
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "missing id" });

      try {
        const like = await prisma.like.delete({
          where: {
            userId_imageId: {
              userId,
              imageId,
            },
          },
        });
        return res.json({ like });
      } catch (e) {
        console.error(e);
      }
    }
  );

  app.get(
    "/api/generations/:id",
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const { id } = req.params;

      if (!id)
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "missing id" });

      try {
        const image = await prisma.image.findUnique({
          where: {
            id,
          },
          include: {
            task: {
              include: {
                model: true,
              },
            },
            user: {
              select: {
                id: true,
                username: true,
                image: true,
              },
            },
          },
        });
        return res.json({ image });
      } catch (e) {
        console.error(e);
      }
    }
  );

  app.get(
    "/api/generations",
    async (
      req: Request<
        unknown,
        unknown,
        unknown,
        { userId: string; skip: string; take: string; liked: string }
      >,
      res
    ) => {
      const { skip, take, userId, liked } = req.query;

      if (liked === "true") {
        try {
          const images = await prisma.image.findMany({
            include: {
              likes: {
                where: {
                  userId: userId,
                },
              },
              user: {
                select: {
                  id: true,
                  username: true,
                  image: true,
                },
              },
              model: true,
              task: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            // skip: parseInt(skip) || 0,
            // take: parseInt(take) || 30,
          });

          // Doing skip / take in memory in javascript.
          // Couldn't figure out how to do it in prisma
          // TODO: Ideally this would be done in the database
          const likes = images
            .filter((i) => {
              return i.likes.some((l) => l.userId === userId);
            })
            .splice(parseInt(skip) || 0, parseInt(skip) + parseInt(take) || 30);

          return res.json({ images: likes });
        } catch (e) {
          console.error(e);
        }
      }

      if (userId) {
        try {
          const images = await prisma.image.findMany({
            where: {
              userId: userId,
            },
            include: {
              likes: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  image: true,
                },
              },
              model: true,
              task: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            skip: parseInt(skip) || 0,
            take: parseInt(take) || 30,
          });
          return res.json({ images });
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          const images = await prisma.image.findMany({
            include: {
              likes: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  image: true,
                },
              },
              model: true,
              task: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            skip: parseInt(skip) || 0,
            take: parseInt(take) || 30,
          });
          return res.json({ images });
        } catch (e) {
          console.error(e);
        }
      }
    }
  );

  app.get(
    "/api/user/:id",
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const id = req.params.id;
      console.log("id", req.params);

      if (!id)
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "missing id" });

      try {
        const user = await prisma.user.findUnique({
          where: {
            id,
          },
          include: {
            images: true,
            followers: true,
            following: true,
          },
        });

        const reducedUser = exclude(user, [
          "sats",
          "email",
          "emailVerified",
          "name",
        ]);
        // TODO: Include follower and following count
        return res.json({ user: reducedUser });
      } catch (e) {
        console.error(e);
      }
    }
  );

  // follow a user endpoint
  app.post(
    "/api/user/:id/follow",
    isAuthenticated,
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const followingId = req.params.id;
      const followerId = req.user.id;

      if (!followingId)
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "missing id" });

      try {
        const follow = await prisma.follows.create({
          data: {
            followerId,
            followingId,
          },
        });
        return res.json({ follow });
      } catch (e) {
        console.error(e);
      }
    }
  );

  // unfollow a user endpoint
  app.post(
    "/api/user/:id/unfollow",
    isAuthenticated,
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const followingId = req.params.id;
      const followerId = req.user.id;

      if (!followingId)
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "missing id" });

      try {
        const follow = await prisma.follows.delete({
          where: {
            followerId_followingId: {
              followerId,
              followingId,
            },
          },
        });
        return res.json({ follow });
      } catch (e) {
        console.error(e);
      }
    }
  );

  app.get(
    "/api/models",
    async (req: Request<unknown, unknown, unknown, unknown>, res) => {
      const models = await prisma.model.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          author: true,
          authorUrl: true,
          unitPriceUSD: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return res.json({ models });
    }
  );

  const getPrice = async (modelId: string, numImages: number) => {
    // // https://openai.com/pricing
    // const model = await prisma.model.findUnique({
    //   where: {
    //     id: modelId,
    //   },
    // });
  };

  app.post(
    "/api/task",
    isAuthenticated,
    async (
      req: Request<unknown, unknown, TaskParams, { ids: string }>,
      res
    ) => {
      console.log(req.body);

      const params = {
        prompt: req.body.prompt,
        negative_prompt: req.body.negative_prompt,
        width: req.body.width,
        height: req.body.height,
        guidance_scale: req.body.guidance_scale,
        num_inference_steps: req.body.num_inference_steps,
        num_images: req.body.num_images,
        file_type: req.body.file_type,
        modelId: req.body.modelId,
        userId: req.user.id,
      };

      // first get the model price
      const model = await prisma.model.findUnique({
        where: {
          id: req.body.modelId,
        },
      });

      if (!model) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "model not found",
        });
      }

      const price = await pricing.getPrice(req.body.modelId, params);

      if (BigInt(price) > req.user.sats) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: `insufficient funds, add ${
            BigInt(price) - req.user.sats
          } more sats to continue`,
        });
      }

      const task = await prisma.task.create({
        data: {
          params: {
            prompt: req.body.prompt,
            negative_prompt: req.body.negative_prompt,
            width: req.body.width,
            height: req.body.height,
            guidance_scale: req.body.guidance_scale,
            num_inference_steps: req.body.num_inference_steps,
            num_images: req.body.num_images,
            file_type: req.body.file_type,
          },
          user: {
            connect: {
              id: req.user.id,
            },
          },
          model: {
            connect: {
              id: req.body.modelId,
            },
          },
        },
      });

      const job = await generateQueue.add("generate", params, {
        jobId: task.id,
      });

      return res.json({ id: task.id });
    }
  );

  app.get("/api/task/:id", async (req, res) => {
    const id = req.params.id;
    const job = await generateQueue.getJob(id);

    if (!job) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Not found" });
    }

    const status = await job.getState();

    if (status === "completed") {
      const images = await prisma.image.findMany({
        where: { taskId: id },
      });
      return res.json({ id, status, images });
    }
    return res.json({ id, status });
  });

  app.get(
    "/api/tasks",
    async (req: Request<unknown, unknown, unknown, { ids: string }>, res) => {
      if (!req.query.ids) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .send({ message: "Need to pass ids in query parameters" });
      }
      const { ids } = req.query;
      const idsArray = ids.split(",");

      const tasks = await Promise.all(
        idsArray.map(async (id) => {
          const job = await generateQueue.getJob(id);

          if (!job) {
            return { id, status: "failed" };
          }
          const status = await job.getState();

          if (status === "completed") {
            const images = await prisma.image.findMany({
              where: { taskId: id },
              include: {
                likes: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                    image: true,
                  },
                },
                model: true,
                task: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            });

            return { id, status, images, params: job.data };
          }
          return { id, status, params: job.data };
        })
      );

      return res.json({ tasks });
    }
  );

  app.get("/api/pricing", async (req, res) => {
    const bitcoinPrice = await axios.get(
      "https://api.coindesk.com/v1/bpi/currentprice.json"
    );
    const bitcoinPriceUSD = bitcoinPrice.data.bpi.USD.rate_float;

    return res.json({
      bitcoinPriceUSD,
    });
  });

  app.get(
    "/api/invoice",
    isAuthenticated,
    // invoiceLimiter,
    async (
      req: Request<
        unknown,
        unknown,
        unknown,
        { amount: string; quick: string }
      >,
      res
    ) => {
      if (!req.query.amount) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .send({ error: "Missing amount" });
      }

      const amount = parseInt(req.query.amount);

      if (!Number.isInteger(amount)) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .send({ error: "Amount must be an integer" });
      }

      try {
        const invoice = await lightning.createInvoice(
          `Deposit for https://micropay.ai`,
          amount
        );

        await prisma.invoice.create({
          data: {
            invoiceId: invoice.id,
            amount: amount,
            request: invoice.request,
            quick: req.query.quick === "true",
            user: {
              connect: {
                id: req.user.id,
              },
            },
          },
        });

        await checkInvoiceQueue.add(
          "checkInvoice",
          {
            id: invoice.id,
          },
          {
            attempts: 21,
            delay: 5000,
            backoff: {
              type: "exponential",
              delay: 1000,
            },
          }
        );

        return res.status(StatusCodes.OK).send({
          id: invoice.id,
          request: invoice.request,
        });
      } catch (e) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: "Error creating invoice" });
      }
    }
  );

  app.get(
    "/api/invoice/:id",
    isAuthenticated,
    apiLimiter,
    async (req: Request<{ id: string }>, res) => {
      try {
        const invoice = await lightning.getInvoice(req.params.id);

        if (invoice.is_confirmed) {
          const invoiceRecord = await prisma.invoice.findUnique({
            where: {
              invoiceId: req.params.id,
            },
          });

          if (!invoiceRecord.confirmed) {
            await prisma.invoice.update({
              where: {
                invoiceId: req.params.id,
              },
              data: {
                confirmed: true,
                confirmedAt: new Date(invoice.confirmed_at),
              },
            });
          }
        }

        return res.status(StatusCodes.OK).send({
          confirmed: invoice.is_confirmed,
          amount: invoice.tokens,
        });
      } catch (e) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .send({ error: "Invoice not found" });
      }
    }
  );

  app.post(
    "/invoice",
    async (
      req: Request<unknown, unknown, { prompt: string }, unknown>,
      res
    ) => {
      const { prompt } = req.body;

      try {
        // https://bitcoin.stackexchange.com/questions/85951/whats-the-maximum-size-of-the-memo-in-a-ln-payment-request

        const preimage = randomBytes(32);
        const id = sha256(preimage);
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + 600); // 10 minutes to pay invoice

        const invoice = await lightning.createHodlInvoice(
          id,
          `Dalle-2 generate: "${prompt.substring(0, 300)}"`,
          DEFAULT_PRICE,
          expiresAt
        );

        const { data, error } = await supabase
          .from<Order>("Orders")
          .insert([
            {
              invoice_id: invoice.id,
              invoice_preimage: preimage.toString("hex"),
              invoice_request: invoice.request,
              satoshis: invoice.tokens,
              prompt: prompt,
              environment: process.env.NODE_ENV,
              model: "dalle",
            },
          ])
          .single();

        if (error) {
          return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send({ error: error.message });
        }

        const text = `
        🧾 New Order request
        ENV: ${process.env.NODE_ENV}
        Invoice Request: ${invoice.request}
        Invoice Tokens: ${invoice.tokens}
        Prompt: ${prompt}
        `;
        if (process.env.NODE_ENV === "production") {
          await telegramBot.sendMessageToAdmins(text);
        }
        console.log("Invoice generated: ", invoice);
        return res.status(StatusCodes.OK).send({
          id: invoice.id,
          uuid: data.uuid,
          request: invoice.request,
        });
      } catch (e) {
        console.log(e);
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: e.message });
      }
    }
  );

  app.post("/check-prompt", async (req, res) => {
    const { prompt } = req.body;
    const flagged = await dalle2.checkPrompt(prompt);
    res.status(StatusCodes.OK).send(flagged);
  });

  app.post(
    "/generate/stable-diffusion",
    sdLimiter,
    async (
      req: Request<unknown, unknown, { prompt: string }, unknown>,
      res
    ) => {
      if (!req.cookies.counter) {
        req.cookies.counter = 0;
      }

      const { prompt } = req.body;

      try {
        const { error, data } = await supabase
          .from<Order>("Orders")
          .insert([
            {
              prompt: prompt,
              environment: process.env.NODE_ENV,
              model: "stable-diffusion",
            },
          ])
          .single();

        if (error) {
          return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send({ error: error.message });
        }

        // read counter variable from cookie
        if (req.cookies.counter >= 3)
          return res.status(StatusCodes.FORBIDDEN).send({
            error: "You have reached your limit of 3 requests",
          });

        const job = await stableDiffusionQueue.add(
          "generate",
          {
            prompt,
          },
          { jobId: data.uuid }
        );

        res.cookie("counter", parseInt(req.cookies.counter) + 1, {
          maxAge: 315360000000,
          sameSite: "none",
          secure: true,
          domain:
            process.env.NODE_ENV === "production"
              ? ".micropay.ai"
              : "localhost",
        });

        return res.status(200).send({
          status: "success",
          message: "Generation started... GET $url to monitor progress",
          id: data.uuid,
          url:
            getHost(req) +
            "/generate/stable-diffusion/" +
            data.uuid +
            "/status",
        });
      } catch (e) {
        console.log(e);
        return res.status(500).send({ error: e.message });
      }
    }
  );

  app.get(
    "/generate/stable-diffusion/:id/status",
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const { id } = req.params;
      try {
        const { data: order, error } = await supabase
          .from<Order>("Orders")
          .select("*")
          .match({ uuid: id })
          .limit(1)
          .single();

        return res.status(200).send({
          message: "Generating Images",
          images: order?.results || [],
        });
      } catch (e) {
        console.log(e);
        return res.status(500).send({ error: e.message });
      }
    }
  );

  app.get("/dalle2-test", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send({ error: "Not allowed" });
    }

    // Generate images
    const prompts = [
      "a store front that has the word 'openai' written on it",
      "an armchair in the shape of an avocado",
      "a male mannequin dressed in an orange and black flannel shirt and black jeans",
      "a female mannequin dressed in a black leather jacket and hold pleated skirt",
      "a living room with two white armchairs and a painting of the colosseum. the painting is mounted above a modern fireplace.",
      "a loft bedroom with a white bed next to a nightstand. there is a fish tank beside the bed.",
    ];
    const i = Math.floor(Math.random() * prompts.length);

    let prompt = prompts[i];

    try {
      let flagged = await dalle2.checkPrompt(prompt);
      if (flagged) {
        const ERROR_MESSAGE =
          "Prompt is flagged by OpenAI's moderation system: ";
        res.status(StatusCodes.BAD_REQUEST).send({ error: ERROR_MESSAGE });
      } else {
        if (process.env.MOCK_IMAGES === "true") {
          return sendMockImages(res, prompt);
        } else {
          const images = await dalle2.generate(prompt);
          console.log(images);
          return res.status(StatusCodes.OK).send({ images });
        }
      }
    } catch (e) {
      if (e.error) {
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: JSON.stringify(e.error, null, 2) });
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: e });
    }
  });

  app.post(
    "/subscribe",
    async (req: Request<unknown, unknown, { email: string }, unknown>, res) => {
      const { email } = req.body;
      const { data, error } = await supabase.from("subscribers").insert([
        {
          email,
        },
      ]);

      return res.status(StatusCodes.OK).send({
        status: "success",
      });
    }
  );

  app.post(
    "/feedback",
    async (
      req: Request<
        unknown,
        unknown,
        { uuid: string; rating: number; feedback: string; email: string },
        unknown
      >,
      res
    ) => {
      const { uuid, rating, feedback, email } = req.body;
      // Update order to indicate that images have been generated
      const { data: updatedOrder, error } = await supabase
        .from<Order>("Orders")
        .update({ rating, feedback, email })
        .match({ uuid })
        .single();

      if (error) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: error.message });
      }

      const feedbackText = `
      🗣 User Feedback Received: 
      Unique ID: ${uuid.slice(0, 10)}
      Feedback: ${feedback}
      Rating: ${rating}
      Email: ${email}
      `;

      if (process.env.NODE_ENV === "production") {
        await telegramBot.sendMessageToAdmins(feedbackText);
        console.log(feedbackText);
      }

      return res.status(StatusCodes.OK).send({
        status: "success",
      });
    }
  );

  //Write a function to accept a GET request for config.mockImages value from the config file
  app.get("/mock-images", async (req, res) => {
    if (process.env.NODE_ENV === "development") {
      res.status(StatusCodes.OK).send(config.mockImages);
    }
  });

  app.post(
    "/refund",
    async (
      req: Request<
        unknown,
        unknown,
        { invoiceId: string; refundInvoice: string },
        unknown
      >,
      res
    ) => {
      const { invoiceId, refundInvoice } = req.body;

      // Update order to indicate that refund transaction recieved
      const { data: updatedOrder, error } = await supabase
        .from<Order>("Orders")
        .update({ refundInvoice })
        .match({ invoice_id: invoiceId })
        .single();

      if (error) {
        console.log("Error updating order: ", error);
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ status: ORDER_STATE.SERVER_ERROR, message: error.message });
      }

      await telegramBot.sendMessageToAdmins(
        "Refund request recieved for " + invoiceId
      );

      await telegramBot.sendMessageToAdmins(refundInvoice);

      return res.status(StatusCodes.OK).send({
        status: ORDER_STATE.REFUND_RECIEVED,
        message: MESSAGE.REFUND_RECIEVED,
      });
    }
  );

  /*

  Flow:
  1. User enters prompt
  2. Request is sent to server POST /generate
  3. Server generates invoice
  4. Server sends invoice to user
  5. User pays invoice
  6. Server recieves payment
  7. Server generates images
  8. Server sends images to user
  */

  /**
   * @param {string} id - Invoice id
   */
  app.get("/generate/:id/status", async (req, res) => {
    const { id } = req.params;
    const webln = req.query.webln == "true";

    try {
      // get invoice from lnd
      const invoice = await lightning.getInvoice(id);

      // Check if invoice found (sanity check)
      if (!invoice)
        return res.status(StatusCodes.NOT_FOUND).send({
          status: ORDER_STATE.INVOICE_NOT_FOUND,
          message: MESSAGE.INVOICE_NOT_FOUND,
        });

      if (invoice.is_canceled) {
        console.log({
          status: ORDER_STATE.DALLE_FAILED,
          message: MESSAGE.DALLE_FAILED,
          progress: ORDER_PROGRESS.DALLE_FAILED,
          invoice: invoice.request,
        });
        return res.status(StatusCodes.OK).send({
          status: ORDER_STATE.DALLE_FAILED,
          message: MESSAGE.DALLE_FAILED,
          progress: ORDER_PROGRESS.DALLE_FAILED,
        });
      }

      // Check if invoice is paid
      if (!invoice.is_held && !invoice.is_confirmed) {
        if (webln) {
          console.log({
            status: ORDER_STATE.WEBLN_WALLET_DETECTED,
            message: MESSAGE.WEBLN_WALLET_DETECTED,
            progress: ORDER_PROGRESS.WEBLN_WALLET_DETECTED,
            invoice: invoice.request,
          });
          return res.status(StatusCodes.OK).send({
            status: ORDER_STATE.WEBLN_WALLET_DETECTED,
            message: MESSAGE.WEBLN_WALLET_DETECTED,
            progress: ORDER_PROGRESS.WEBLN_WALLET_DETECTED,
          });
        } else {
          console.log({
            status: ORDER_STATE.INVOICE_NOT_PAID,
            message: MESSAGE.INVOICE_NOT_PAID,
            progress: ORDER_PROGRESS.INVOICE_NOT_PAID,
            invoice: invoice.request,
          });
          return res.status(StatusCodes.OK).send({
            status: ORDER_STATE.INVOICE_NOT_PAID,
            message: MESSAGE.INVOICE_NOT_PAID,
            progress: ORDER_PROGRESS.INVOICE_NOT_PAID,
          });
        }
      }

      // 1. Check if image has already been generated
      const { data: order, error } = await supabase
        .from<Order>("Orders")
        .select("*")
        .match({ invoice_id: id })
        .limit(1)
        .single();

      if (error) {
        console.error("Error getting order: ", error);
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ status: ORDER_STATE.SERVER_ERROR, message: error.message });
      }

      // 2. If image has been generated, send it to user
      if (order.results) {
        return res.status(StatusCodes.OK).send({
          status: ORDER_STATE.DALLE_GENERATED,
          message: MESSAGE.DALLE_GENERATED,
          progress: ORDER_PROGRESS.DALLE_GENERATED,
          images: order.results,
        });
      }

      let job: Job;
      // 4. If invoice has been paid, check the generation queue
      job = await generationQueue.getJob(id);

      // 3. If image has not been generated, check if invoice has been paid
      if (invoice.is_held) {
        if (process.env.MOCK_IMAGES === "true") {
          await lightning.settleHodlInvoice(order.invoice_preimage);

          const images = [
            "https://cdn.openai.com/labs/images/3D%20render%20of%20a%20cute%20tropical%20fish%20in%20an%20aquarium%20on%20a%20dark%20blue%20background,%20digital%20art.webp?v=1",
            "https://cdn.openai.com/labs/images/An%20armchair%20in%20the%20shape%20of%20an%20avocado.webp?v=1",
            "https://cdn.openai.com/labs/images/An%20expressive%20oil%20painting%20of%20a%20basketball%20player%20dunking,%20depicted%20as%20an%20explosion%20of%20a%20nebula.webp?v=1",
            "https://cdn.openai.com/labs/images/A%20photo%20of%20a%20white%20fur%20monster%20standing%20in%20a%20purple%20room.webp?v=1",
          ];

          return res.status(StatusCodes.OK).send({
            status: ORDER_STATE.DALLE_GENERATED,
            message: MESSAGE.DALLE_GENERATED,
            images: images,
          });
        }

        let job: Job;
        // 4. If invoice has been paid, check the generation queue
        job = await generationQueue.getJob(id);

        // 3. If image has not been generated, check if invoice has been paid
        if (process.env.MOCK_IMAGES === "true") {
          await sleep(2000);
          return sendMockImages(res, order.prompt);
        }

        if (!job) {
          // 5. If job is not in queue, add it to the queue
          job = await generationQueue.add(
            "generate",
            {
              prompt: order.prompt,
            },
            { jobId: id }
          );
        }
        await job.updateProgress(ORDER_PROGRESS.DALLE_GENERATING);
        await job.update({
          ...job.data,
          message: MESSAGE.DALLE_GENERATING,
          status: ORDER_STATE.DALLE_GENERATING,
        });

        // 6. If job is in queue, but not done, send progress
        return res.status(StatusCodes.OK).send({
          status: job.data.status,
          message: job.data.message,
          progress: job.progress,
          images: [],
        });
      } else if (invoice.is_canceled) {
        return res.status(StatusCodes.OK).send({
          status: ORDER_STATE.INVOICE_CANCELLED,
          message: MESSAGE.INVOICE_CANCELLED,
          progress: ORDER_PROGRESS.INVOICE_CANCELLED,
        });
      } else {
        console.error("SERVER ERROR 1");
        return res.status(StatusCodes.OK).send({
          status: ORDER_STATE.SERVER_ERROR,
          message: MESSAGE.SERVER_ERROR,
          progress: ORDER_PROGRESS.SERVER_ERROR,
        });
      }
    } catch (e) {
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send({ error: e.message });
    }
  });

  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    // (req, res, next) => {
    // const routePromise = fn(req, res, next);
    // if (routePromise.catch) {
    //   routePromise.catch((err) => next(err));
    // }
    // // }
    next(createError(404));
  });

  // error handler
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      message: err.message,
      error: process.env.NODE_ENV === "development" ? err : {},
    });
    next();
  });

  app.use(Sentry.Handlers.errorHandler());

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  return app;
};
