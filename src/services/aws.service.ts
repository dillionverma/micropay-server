import aws from "aws-sdk";

export default class AWS {
  private s3: aws.S3;

  constructor(accessKey: string, secretKey: string) {
    aws.config.credentials = new aws.Credentials(accessKey, secretKey);
    this.s3 = new aws.S3();
  }

  uploadImageBufferToS3 = async (
    buffer: Buffer,
    key: string,
    bucketName: string
  ): Promise<string> => {
    try {
      const params = {
        ContentType: "image/png",
        ContentLength: buffer.length, // or response.header["content-length"] if available for the type of file downloaded
        Bucket: bucketName,
        Body: buffer,
        Key: key,
      };
      await this.s3.putObject(params).promise();
      return `https://${bucketName}.s3.amazonaws.com/${key}`;
    } catch (e) {
      console.error("Error uploading to S3", e);
    }
  };
}
