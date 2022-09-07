import axios from "axios";

interface RequestBody {
  task_type: string;
  prompt: {
    caption: string;
    batch_size: number;
  };
}

export interface ImageGenerations {
  object: string;
  data: ImageData[];
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

export interface ImageData {
  id: string;
  object: string;
  created: number;
  generation_type: string;
  generation: { image_path: string };
  task_id: string;
  prompt_id: string;
  is_public: boolean;
}

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

export class Dalle2 {
  private bearerToken: string;
  private url: string;
  constructor(bearerToken: string) {
    this.bearerToken = bearerToken;
    this.url = "https://labs.openai.com/api/labs";
  }

  async generate(prompt: string): Promise<string[]> {
    const body: RequestBody = {
      task_type: "text2im",
      prompt: {
        caption: prompt,
        batch_size: 4,
      },
    };

    let task: Task;
    try {
      const response = await axios(`${this.url}/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          "Content-Type": "application/json",
        },
        data: body,
      });
      task = response.data as Task;
    } catch (error) {
      console.error("ERROR DURING GENERATION");
      if (error.response) {
        // console.log(error.response.data);
        // console.log(error.response.status);
        // console.log(error.response.statusText);

        throw new DalleError(
          error.response.data.error.message as DalleErrorResponse
        );
      }
      throw new DalleError("Unknown error during initial request");
    }

    // console.log("task sent to OpenAI", task);
    task = await this.getTask(task.id);
    return await new Promise(async (resolve, reject) => {
      try {
        const refreshIntervalId = setInterval(async () => {
          task = await this.getTask(task.id);

          switch (task.status) {
            case "succeeded":
              console.log("Task succeeded", {
                id: task.id,
                status: task.status_information,
              });
              clearInterval(refreshIntervalId);
              const images = task.generations.data.map(
                (image: ImageData) => image.generation.image_path
              );
              return resolve(images);
            case "rejected":
              console.log("Task rejected", {
                id: task.id,
                status: task.status_information,
              });
              clearInterval(refreshIntervalId);
              return reject(new DalleError(task.status_information.message));
            case "pending":
              console.log("Task pending", {
                id: task.id,
                status: task.status_information,
              });
          }
        }, 3000);
      } catch (error) {
        console.error("ERROR DURING TASK MONITORING");
        if (error.response) {
          // console.log(error.response.data);
          // console.log(error.response.status);
          // console.log(error.response.statusText);
          return new DalleError(error.response.data);
        }
        return new DalleError("Unknown error task monitoring");
      }
    });
  }

  async getTask(taskId: string): Promise<Task> {
    const response = await axios(`${this.url}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
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

  async getCredits(): Promise<CreditsResponse> {
    const response = await axios(`${this.url}/billing/credit_summary`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }
}
