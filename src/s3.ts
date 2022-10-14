import aws from "aws-sdk";
import axios from "axios";
import { config } from "./config";

aws.config.credentials = new aws.Credentials(
  config.awsAccessKey,
  config.awsSecretKey
);
const s3 = new aws.S3();

export const BUCKET_NAME = "dalle2-lightning";

export const uploadFileToS3 = async (
  url: string,
  bucket: string = BUCKET_NAME,
  key: string
): Promise<string> => {
  return axios
    .get(url, { responseType: "arraybuffer", responseEncoding: "binary" })
    .then(async (response) => {
      const params = {
        ContentType: "image/png",
        ContentLength: response.data.length.toString(), // or response.header["content-length"] if available for the type of file downloaded
        Bucket: bucket,
        Body: response.data,
        Key: key,
      };
      await s3.putObject(params).promise();
      return `https://${bucket}.s3.amazonaws.com/${key}`;
    })
    .catch((e) => {
      console.log(e);
      console.log("error");
      return "";
    });
};
