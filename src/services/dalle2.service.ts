import axios, { AxiosRequestHeaders } from "axios";
import { assert } from "console";
import fs from "fs";

interface RequestBody {
  task_type: string;
  prompt: {
    caption: string;
    batch_size: number;
  };
}

interface ModerationRequestBody {
  input: string;
}

export interface ImageGenerations {
  object: string;
  data: ImageGeneration[];
}

export interface Moderation {
  id: string;
  model: string;
  results: [
    {
      categories: {
        hate: boolean;
        "hate/threatening": boolean;
        "self-harm": boolean;
        sexual: boolean;
        "sexual/minors": boolean;
        violence: boolean;
        "violence/graphic": boolean;
      };
      category_scores: {
        hate: number;
        "hate/threatening": number;
        "self-harm": number;
        sexual: number;
        "sexual/minors": number;
        violence: number;
        "violence/graphic": number;
      };
      flagged: boolean;
    }
  ];
}

export interface Task {
  object: string;
  id: string;
  created: number;
  task_type: string;
  status: string;
  status_information: { type: string; message: string; code: string };
  prompt_id: string;
  generations: ImageGenerations;
  prompt: {
    id: string;
    ojbect: string;
    created: number;
    prompt_type: string;
    prompt: { caption: string };
    parent_generation_id: string | null;
  };
}

export interface CreditsResponse {
  aggregate_credits: number;
  next_grant_ts: number;
  breakdown: { free: number; paid_dalle_15_115: number };
  object: string;
}

export interface ImageGeneration {
  id: string;
  object: string;
  created: number;
  generation_type: string;
  generation: { image_path: string };
  task_id: string;
  prompt_id: string;
  is_public: boolean;
}

/**
 * DalleErrorResponse is the error response from the Dalle API
 * Example:
  {
    error: {
      message: 'Incorrect API key provided: sess-0fV*********************************x6Jc. You can find your API key at https://beta.openai.com.',
      type: 'invalid_request_error',
      param: null,
      code: 'invalid_api_key'
    }
  }
 */
export interface DalleErrorResponse {
  message: string;
  type: string;
  code: string;
  param: string;
}
export class DalleError extends Error {
  private error;
  constructor(error) {
    super();
    this.error = error;
  }
}

export interface GenerateResponse {
  generationId: string;
  publicUrl: string;
  downloadUrl: string;
  imageBuffer: Buffer;
}

/**
 * Dalle2 is the class for interacting with the Dalle API
 */
export default class Dalle2 {
  private bearerToken: string;
  private secretKey: string;
  private url: string;
  private apiPrefix: string;
  private generationHeaders: AxiosRequestHeaders;
  private moderationHeaders: AxiosRequestHeaders;

  constructor(bearerToken: string, secretKey: string) {
    this.bearerToken = bearerToken;
    this.secretKey = secretKey;
    this.url = "https://labs.openai.com";
    this.apiPrefix = "api/labs";
    this.generationHeaders = {
      Authorization: `Bearer ${this.bearerToken}`,
      "Content-Type": "application/json",
    };
    this.moderationHeaders = {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Gets the download url for the image
   * @param generationId the id of the generation
   * @returns {string} the url to download the image
   */
  downloadUrl(generationId: string): string {
    return `${this.url}/${this.apiPrefix}/generations/${generationId}/download`;
  }

  /**
   * Downloads the generated image
   * @param generationId  the id of the generation
   * @returns {Promise<Buffer>} the image buffer
   */
  async download(generationId: string): Promise<Buffer> {
    const response = await axios(this.downloadUrl(generationId), {
      method: "GET",
      headers: this.generationHeaders,
      responseType: "arraybuffer",
    });
    return response.data;
  }

  /**
   * Downloads the generated image as a file
   * @param generationId the id of the generation
   * @param filename the filename to save the image to
   */
  async downloadFile(generationId: string, filename: string): Promise<void> {
    const data = await this.download(generationId);
    fs.writeFile(filename, data, "binary", (err) => {
      if (!err) {
        console.log(`${filename} created successfully!`);
      } else {
        console.log(err);
      }
    });
  }

  /**
   * Creates public page to share the generated image
   * @param generationId the id of the generation
   * @returns {Promise<ImageGeneration>} the image data
   */
  async publish(generationId: string): Promise<string> {
    const res = await axios(
      `${this.url}/${this.apiPrefix}/generations/${generationId}/share`,
      {
        method: "POST",
        headers: this.generationHeaders,
      }
    );

    const task: ImageGeneration = res.data;
    assert(task.is_public === true); // Assert that the image is public

    // Return the public url
    const id = generationId.split("generation-")[1];
    return `${this.url}/s/${id}`;
  }

  /**
   * Creates a task to generate an image
   * @param prompt the prompt to generate the image
   * @returns {Promise<Task>} the task
   */

  async checkPrompt(prompt: string) {
    const requestBody: ModerationRequestBody = {
      input: prompt,
    };
    try {
      const res = await axios(`https://api.openai.com/v1/moderations`, {
        method: "POST",
        headers: this.moderationHeaders,
        data: requestBody,
      });
      const data: Moderation = await res.data;
      console.log(JSON.stringify(data, null, 2));
      return data["results"][0]["flagged"] ? true : false;
    } catch (err) {
      throw err;
    }
  }

  async createTask(prompt: string): Promise<Task> {
    let task: Task;

    // 1. Create a task to generate the images
    try {
      const response = await axios(`${this.url}/${this.apiPrefix}/tasks`, {
        method: "POST",
        headers: this.generationHeaders,
        data: {
          task_type: "text2im",
          prompt: {
            caption: prompt,
            batch_size: 4,
          },
        } as RequestBody,
      });
      task = response.data;
      console.log("Task created", {
        id: task.id,
        prompt: prompt,
        status: task.status_information,
      });
      return task;
    } catch (error) {
      console.error("Error occured while creating task: ", error);
      if (error.response) {
        throw new DalleError(
          error.response.data.error.message as DalleErrorResponse
        );
      }
      throw new DalleError("Unknown error during initial request");
    }
  }

  /**
   * Gets a task by id
   * @param taskId the id of the task
   * @returns {Promise<Task>} the task
   */
  async getTask(taskId: string): Promise<Task> {
    const response = await axios(
      `${this.url}/${this.apiPrefix}/tasks/${taskId}`,
      {
        method: "GET",
        headers: this.generationHeaders,
      }
    );
    return response.data;
  }

  /**
   * Gets the number of Dalle credits available
   * @returns {Promise<CreditsResponse>} the credits response
   */
  async getCredits(): Promise<CreditsResponse> {
    const response = await axios(
      `${this.url}/${this.apiPrefix}/billing/credit_summary`,
      {
        method: "GET",
        headers: this.generationHeaders,
      }
    );
    return response.data;
  }

  /**
   * Generates 4 images given a prompt
   * @param prompt the prompt to generate the image
   * @returns {Promise<string[]>} the generated images
   */
  public async generate(prompt: string): Promise<GenerateResponse[]> {
    return this._generateAndPublish(prompt);
  }

  /**
   * Generates and publicly shares the Dalle-2 images given a prompt
   * @param prompt the prompt to generate the image
   * @returns {Promise<string[]>} the generated images
   */
  private async _generateAndPublish(
    prompt: string
  ): Promise<GenerateResponse[]> {
    let task: Task;

    // 1. Create a task to generate images
    task = await this.createTask(prompt);

    // 2. Get the task from the Dalle API (sanity check to ensure it's created)
    task = await this.getTask(task.id);

    // 3. Wait for the task to complete
    return await new Promise(async (resolve, reject) => {
      try {
        const refreshIntervalId = setInterval(async () => {
          task = await this.getTask(task.id);

          switch (task.status) {
            // 4. Once the task is complete, download the images
            case "succeeded":
              console.log("Task succeeded", {
                id: task.id,
                status: task.status_information,
              });
              clearInterval(refreshIntervalId);

              // 5. Publish all images
              const images = await Promise.all(
                task.generations.data.map(async (image: ImageGeneration) => {
                  return {
                    generationId: image.id,
                    publicUrl: await this.publish(image.id),
                    downloadUrl: this.downloadUrl(image.id),
                    imageBuffer: await this.download(image.id),
                  };
                })
              );

              return resolve(images);

            // If the task fails, throw an error
            case "rejected":
              console.log("Task rejected", {
                id: task.id,
                status: task.status_information,
              });
              clearInterval(refreshIntervalId);
              return reject(new DalleError(task.status_information.message));

            // If the task is pending, poll again
            case "pending":
              console.log("Task pending", {
                id: task.id,
                status: task.status_information,
              });
          }
        }, 5000);
      } catch (error) {
        console.error("Error occured while polling task: ", error);
        if (error.response) {
          return new DalleError(error.response.data);
        }
        return new DalleError("Unknown error task monitoring");
      }
    });
  }

  /**
   * Checks if the Dalle API is up and running
   * @returns {Promise<boolean>} true if the API is up and running
   */
  async isTokenValid(): Promise<boolean> {
    try {
      const response = await axios(
        `${this.url}/${this.apiPrefix}/billing/credit_summary`,
        {
          method: "GET",
          headers: this.generationHeaders,
          validateStatus: () => true, // don't throw exception if status < 100 or status > 300 (default behavior).
        }
      );

      if (response.data.error) {
        console.error(response.data.error.message);
        return false;
      }
      return true;
    } catch (error) {
      // Something wrong happened, probably not a valid token.
      // if error.response exists, that implies this is an Axios Error
      if (error.response) {
        console.error(new DalleError(error.response.data.error)); // data.error is the structure of the response from OpenAI
      }
    }
    return false;
  }

  // TODO: Can add back later.
  // async list(options = { limit: 50, fromTs: 0 }) {
  //   return await got
  //     .get(
  //       `${this.url}/tasks?limit=${options.limit}${
  //         options.fromTs ? `&from_ts=${options.fromTs}` : ""
  //       }`,
  //       {
  //         headers: {
  //           Authorization: "Bearer " + this.bearerToken,
  //         },
  //       }
  //     )
  //     .json();
  // }
}
