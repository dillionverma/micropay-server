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
