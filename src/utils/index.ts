import { Request } from "express";

export const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const getNRandomElements = (arr: any[], n: number) => {
  let random = [];
  for (let i = 0; i < n; i++) {
    random.push(getRandomElement(arr));
  }
  return random;
};

export const getRandomElement = (arr: any[]) =>
  arr[Math.floor(Math.random() * arr.length)];

export const getHost = (req: Request<any, any, any, any>) => {
  return `${req.protocol}://${req.get("host")}${req.originalUrl}`;
};

// Exclude keys from user
export const exclude = <User, Key extends keyof User>(
  user: User,
  keys: Key[]
): Omit<User, Key> => {
  for (let key of keys) {
    delete user[key];
  }
  return user;
};
