import axios from "axios";

interface RequestBody {
  task_type: string;
  prompt: {
    caption: string;
    batch_size: number;
  };
}

export interface Task {
  object: string;
  id: string;
  created: number;
  task_type: string;
  status: string;
  status_information: {};
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

export interface ImageGenerations {
  object: string;
  data: ImageData[];
}

export class Dalle {
  apiKey: string;
  url: string;
  constructor({ apiKey }: { apiKey: string }) {
    this.apiKey = apiKey;
    this.url = "https://labs.openai.com/api/labs/tasks";
  }

  async generate(prompt: string) {
    const body: RequestBody = {
      task_type: "text2im",
      prompt: { caption: prompt, batch_size: 4 },
    };

    return new Promise<ImageGenerations | null>(async (resolve, reject) => {
      try {
        console.log("Sending request to Dall-e 2", body);
        const response = await axios(this.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          data: body,
        });

        const task = response.data as Task;

        const refreshIntervalId = setInterval(async () => {
          try {
            const response = await axios(`${this.url}/${task.id}`, {
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
              },
            });

            const data: Task = await response.data;

            if (data.status === "rejected") {
              console.log("Task rejected");
              console.log(data);
              clearInterval(refreshIntervalId);
              resolve(data.status_information as ImageGenerations);
            } else if (data.status === "succeeded") {
              console.log("Dalle-2 generated: ", data);
              const generations = data.generations;
              clearInterval(refreshIntervalId);
              resolve(generations as ImageGenerations);
            }
          } catch (e) {
            console.error(response);
            return reject(
              "Dall-e 2 couldn't generate images based upon your caption."
            );
          }
        }, 3000);
      } catch (e) {
        console.error(e);
        return reject(
          "Dall-e 2 couldn't generate images based upon your caption."
        );
      }
    });
  }
}
