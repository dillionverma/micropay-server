export const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const getNRandomElements = (arr: any[], n: number) =>
  arr.sort(() => 0.5 - Math.random()).slice(0, n);

export const getRandomElement = (arr: any[]) =>
  arr[Math.floor(Math.random() * arr.length)];
